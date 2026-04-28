import type { Config } from "@netlify/functions";

export default async function handler() {
  const baseUrl = process.env.URL || "https://pegcheck.uk";

  const res = await fetch(`${baseUrl}/api/reset-calls`);
  const data = await res.json();
  console.log("Reset calls result:", JSON.stringify(data));
  return;
}

export const config: Config = {
  schedule: "0 0 1 * *",
};
