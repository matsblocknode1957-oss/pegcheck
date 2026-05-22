import { COIN_PEGS } from "./coinPegs";

export async function fetchEurUsd(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=usd&vs_currencies=eur"
    );
    const data = await res.json();
    const eurPerUsd = data?.usd?.eur;
    if (eurPerUsd && eurPerUsd > 0.5 && eurPerUsd < 2.0) {
      return 1 / eurPerUsd;
    }
    return COIN_PEGS.eurc;
  } catch {
    return COIN_PEGS.eurc;
  }
}
