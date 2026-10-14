-- weekly_price_stats(since timestamptz)
-- Replaces the raw price_history SELECT in the weekly report.
-- Returns one aggregate row per slug for all readings in [since, now].
--
-- Columns:
--   latest_price    – most recent recorded price in the window
--   high_7d / low_7d – extremes over the window
--   reading_count   – number of price snapshots (0 means the coin is absent from the result)
--   stability_pct   – % of readings within the per-coin healthy band:
--                     50 bps for lusd / mkusd, 10 bps for all other coins.
--                     Rows with NULL deviation_bps (pre-June-2026 snapshots) are
--                     treated as deviation = 0 bps (at peg) for this column only.
--   trend_direction – 'up' / 'down' / 'stable'.
--                     Compares mean |deviation_bps| in the first half of readings
--                     vs the second half.  'up' = improving (recent < early × 0.9),
--                     'down' = worsening (recent > early × 1.1), else 'stable'.
--                     Returns 'stable' when fewer than 6 readings exist.
--
-- Usage: SELECT * FROM weekly_price_stats(NOW() - INTERVAL '7 days');
CREATE OR REPLACE FUNCTION weekly_price_stats(since timestamptz)
RETURNS TABLE (
  slug              text,
  latest_price      numeric,
  high_7d           numeric,
  low_7d            numeric,
  reading_count     bigint,
  stability_pct     numeric,
  trend_direction   text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ordered AS (
    -- Assign a chronological rank and total count per slug so we can split
    -- readings into first / second half for trend detection.
    SELECT
      slug,
      price,
      COALESCE(deviation_bps, 0)                                    AS dev_bps,
      ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at)     AS rn,
      COUNT(*)     OVER (PARTITION BY slug)                          AS total
    FROM price_history
    WHERE created_at >= since
  ),
  latest AS (
    -- Most recent price per slug within the window.
    SELECT DISTINCT ON (slug)
      slug,
      price AS latest_price
    FROM   price_history
    WHERE  created_at >= since
    ORDER  BY slug, created_at DESC
  ),
  agg AS (
    SELECT
      o.slug,
      MAX(o.price)   AS high_7d,
      MIN(o.price)   AS low_7d,
      COUNT(*)       AS reading_count,
      -- Stability: % of readings where |deviation_bps| is within the healthy band.
      ROUND(
        COUNT(*) FILTER (
          WHERE ABS(o.dev_bps) <=
            CASE o.slug WHEN 'lusd' THEN 50 WHEN 'mkusd' THEN 50 ELSE 10 END
        ) * 100.0 / NULLIF(COUNT(*), 0),
        1
      ) AS stability_pct,
      -- Trend: average |dev_bps| in the first half of chronologically-ordered rows.
      -- NULL when < 6 total readings (keeps trend = 'stable' in the CASE below).
      AVG(ABS(o.dev_bps))
        FILTER (WHERE o.total >= 6 AND o.rn <= o.total / 2)
        AS early_avg,
      -- Average |dev_bps| in the second half (last total/2 rows).
      AVG(ABS(o.dev_bps))
        FILTER (WHERE o.total >= 6 AND o.rn > o.total - o.total / 2)
        AS recent_avg
    FROM ordered o
    GROUP BY o.slug
  )
  SELECT
    a.slug,
    l.latest_price,
    a.high_7d,
    a.low_7d,
    a.reading_count,
    a.stability_pct,
    CASE
      WHEN a.early_avg IS NULL
        OR a.recent_avg IS NULL
        OR a.early_avg = 0   THEN 'stable'
      WHEN a.recent_avg < a.early_avg * 0.9  THEN 'up'
      WHEN a.recent_avg > a.early_avg * 1.1  THEN 'down'
      ELSE 'stable'
    END AS trend_direction
  FROM agg  a
  JOIN latest l ON l.slug = a.slug
$$;

REVOKE ALL ON FUNCTION weekly_price_stats(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION weekly_price_stats(timestamptz) TO service_role;
