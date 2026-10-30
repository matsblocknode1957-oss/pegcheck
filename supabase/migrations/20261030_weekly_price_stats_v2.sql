-- weekly_price_stats v2 (2026-10-30)
-- Changes from v1 (20261014):
--   1. High/low restricted to readings with ≥2 non-zero price sources,
--      filtering single-source data blips (e.g. CoinGecko dropout on 27 Oct).
--      Legacy rows without source_prices are always included.
--   2. Stability band is now per-group (matches coinPegs.ts thresholds):
--        50 bps  — lusd, mkusd, alusd (high-variance)
--        30 bps  — DeFi / synthetic coins
--        20 bps  — all other fiat-backed coins (was 10 bps)
--   3. Column stability_pct kept for back-compat; semantics = "% near peg".
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
  WITH all_readings AS (
    SELECT
      slug,
      price,
      created_at,
      COALESCE(deviation_bps, 0) AS dev_bps,
      -- A reading qualifies as multi-source when it has ≥2 non-zero sources,
      -- or when source_prices is absent (pre-June-2026 legacy rows).
      (
        source_prices IS NULL
        OR (
          SELECT COUNT(*)
          FROM   jsonb_each_text(source_prices)
          WHERE  value IS NOT NULL
            AND  (CASE WHEN value ~ '^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$'
                       THEN value::numeric ELSE 0 END) > 0
        ) >= 2
      ) AS multi_source
    FROM price_history
    WHERE created_at >= since
  ),
  ordered AS (
    SELECT
      slug,
      price,
      dev_bps,
      multi_source,
      ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) AS rn,
      COUNT(*)     OVER (PARTITION BY slug)                      AS total
    FROM all_readings
  ),
  latest AS (
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
      -- High/low from multi-source readings only; fall back to all readings
      -- for coins that somehow have zero multi-source rows (shouldn't happen).
      COALESCE(MAX(o.price) FILTER (WHERE o.multi_source), MAX(o.price)) AS high_7d,
      COALESCE(MIN(o.price) FILTER (WHERE o.multi_source), MIN(o.price)) AS low_7d,
      COUNT(*)       AS reading_count,
      -- Near-peg %: fraction of all readings within the per-coin healthy band.
      ROUND(
        COUNT(*) FILTER (
          WHERE ABS(o.dev_bps) <=
            CASE o.slug
              WHEN 'lusd'    THEN 50  WHEN 'mkusd'  THEN 50  WHEN 'alusd'  THEN 50
              WHEN 'ethena'  THEN 30  WHEN 'frax'   THEN 30  WHEN 'gho'    THEN 30
              WHEN 'crvusd'  THEN 30  WHEN 'usdd'   THEN 30  WHEN 'eurc'   THEN 30
              WHEN 'dola'    THEN 30  WHEN 'bold'   THEN 30  WHEN 'usdf'   THEN 30
              WHEN 'u'       THEN 30  WHEN 'usdgo'  THEN 30  WHEN 'usd1'   THEN 30
              ELSE 20
            END
        ) * 100.0 / NULLIF(COUNT(*), 0),
        1
      ) AS stability_pct,
      AVG(ABS(o.dev_bps))
        FILTER (WHERE o.total >= 6 AND o.rn <= o.total / 2)
        AS early_avg,
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
