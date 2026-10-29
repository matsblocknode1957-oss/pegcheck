export interface CmcEntry {
  id: number;
  symbol: string; // symbol CMC returns — verified against API response at runtime
}

// One batched call per cron run: GET /v2/cryptocurrency/quotes/latest?id=<ids>&convert=USD
// Response keyed by numeric ID; symbol is cross-checked before the price is used.
// Coins NOT in this map receive no CMC price (no ID confirmed).
export const CMC_IDS: Record<string, CmcEntry> = {
  usdt:   { id: 825,   symbol: "USDT"   },
  usdc:   { id: 3408,  symbol: "USDC"   },
  dai:    { id: 4943,  symbol: "DAI"    },
  usds:   { id: 33039, symbol: "USDS"   },
  ethena: { id: 29470, symbol: "USDe"   },
  pyusd:  { id: 27772, symbol: "PYUSD"  },
  fdusd:  { id: 26081, symbol: "FDUSD"  },
  rlusd:  { id: 34387, symbol: "RLUSD"  },
  tusd:   { id: 2563,  symbol: "TUSD"   },
  frax:   { id: 36039, symbol: "frxUSD" },
  gho:    { id: 23508, symbol: "GHO"    },
  crvusd: { id: 24927, symbol: "CRVUSD" },
  lusd:   { id: 9566,  symbol: "LUSD"   },
  usdp:   { id: 3330,  symbol: "USDP"   },
  usdd:   { id: 19891, symbol: "USDD"   },
  eurc:   { id: 20641, symbol: "EURC"   },
  dola:   { id: 19191, symbol: "DOLA"   },
  alusd:  { id: 8614,  symbol: "ALUSD"  },
  mkusd:  { id: 28094, symbol: "mkUSD"  },
  bold:   { id: 38407, symbol: "BOLD"   },
  usdg:   { id: 33793, symbol: "USDG"   },
};
