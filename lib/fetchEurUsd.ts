const CHAINLINK_EUR_USD = "0xb49f677943BC038e9857d61E7d053CaA2C1734C1";
const MAINNET_RPC = "https://ethereum-rpc.publicnode.com";
const MAX_AGE_SECONDS = 90000;

export async function fetchEurUsd(): Promise<number | null> {
  // Primary: Chainlink EUR/USD mainnet feed (8 decimals, latestRoundData)
  try {
    const res = await fetch(MAINNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "eth_call",
        params: [{ to: CHAINLINK_EUR_USD, data: "0xfeaf968c" }, "latest"],
        id: 1,
      }),
      signal: AbortSignal.timeout(6000),
    });
    const json = await res.json();
    if (!json.error && json.result && json.result !== "0x") {
      const answerHex    = json.result.slice(2 + 64,  2 + 128); // slot 1 — int256 answer
      const updatedAtHex = json.result.slice(2 + 192, 2 + 256); // slot 3 — uint256 updatedAt
      const rate      = Number(BigInt("0x" + answerHex))    / 1e8;
      const updatedAt = Number(BigInt("0x" + updatedAtHex));
      const age = Math.floor(Date.now() / 1000) - updatedAt;
      if (rate > 0.5 && rate < 2.0 && age <= MAX_AGE_SECONDS) return rate;
    }
  } catch {
    // fall through
  }
  // Fallback: derive from BTC priced in USD and EUR (avoids euro-coin/EURC circularity)
  try {
    const cgKey = process.env.COINGECKO_API_KEY;
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur",
      {
        signal: AbortSignal.timeout(6000),
        ...(cgKey ? { headers: { "x-cg-demo-api-key": cgKey } } : {}),
      }
    );
    const data = await res.json();
    const btcUsd = data?.bitcoin?.usd;
    const btcEur = data?.bitcoin?.eur;
    if (btcUsd > 0 && btcEur > 0) {
      const rate = btcUsd / btcEur;
      if (rate > 0.5 && rate < 2.0) return rate;
    }
  } catch {
    // fall through
  }
  return null;
}
