import type { Config } from "@netlify/functions";

export default async function handler() {
  const secret  = process.env.CRON_SECRET;
  const baseUrl = process.env.URL;

  if (!secret || !baseUrl) {
    const missing = ([!secret && "CRON_SECRET", !baseUrl && "URL"] as (string | false)[])
      .filter((v): v is string => v !== false);
    console.error("weekly-report-scheduler: missing env var(s):", missing.join(", "));
    return;
  }

  try {
    const res  = await fetch(`${baseUrl}/api/cron/weekly-report`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    const data = await res.json().catch(() => ({ error: "non-JSON response" }));
    console.log("weekly-report-scheduler:", res.status, JSON.stringify(data));
  } catch (err) {
    console.error(
      "weekly-report-scheduler fetch failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export const config: Config = {
  schedule: "0 8 * * 1",
};
