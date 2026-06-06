import { COIN_PEGS } from "./coinPegs";

export async function fetchEurUsd(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=euro-coin&vs_currencies=usd"
    );
    const data = await res.json();
    const eurUsd = data?.["euro-coin"]?.usd;
    if (eurUsd && eurUsd > 0.5 && eurUsd < 2.0) {
      return eurUsd;
    }
    return COIN_PEGS.eurc;
  } catch {
    return COIN_PEGS.eurc;
  }
}
