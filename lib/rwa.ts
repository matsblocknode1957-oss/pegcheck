import { ethers } from "ethers";

const FALLBACK_RPC = "https://ethereum-rpc.publicnode.com";

export interface RwaAsset {
  name: string;
  issuer: string;
  chain: string;
  nav: number | null;
  navUpdatedAt: string | null;
  navContinuous: boolean;
  supply: number | null;
  supplyUsd: number | null;
  oracleDivergence: boolean;
}

// ethers.Interface used only for ABI encoding/decoding — no provider
const I_GETPRICE = new ethers.Interface(["function getPrice() view returns (uint256)"]);
const I_GETASSET = new ethers.Interface(["function getAssetPrice(address) view returns (uint256)"]);
const I_LRD      = new ethers.Interface(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"]);
const I_DECIMALS = new ethers.Interface(["function decimals() view returns (uint8)"]);
const I_SUPPLY   = new ethers.Interface(["function totalSupply() view returns (uint256)"]);

// Plain fetch eth_call — tries primary RPC then falls back to public node.
async function ethCall(contract: string, data: string, primary: string): Promise<string | null> {
  const urls = primary.trim() ? [primary, FALLBACK_RPC] : [FALLBACK_RPC];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: contract, data }, "latest"], id: 1 }),
        signal:  AbortSignal.timeout(4000),
        cache:   "no-store",
      });
      const j = await res.json();
      if (j.error) {
        console.warn("[rwa] RPC error from", url, j.error.message ?? j.error.code);
        continue;
      }
      if (!j.result || j.result === "0x") return null;
      return j.result as string;
    } catch {
      // timeout or network error — try next URL
    }
  }
  return null;
}

async function attempt<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); }
  catch (e) { console.warn("[rwa]", label, e instanceof Error ? e.message : e); return null; }
}

async function erc20Supply(addr: string, primary: string): Promise<number | null> {
  const [decHex, supHex] = await Promise.all([
    ethCall(addr, I_DECIMALS.encodeFunctionData("decimals"),  primary),
    ethCall(addr, I_SUPPLY.encodeFunctionData("totalSupply"), primary),
  ]);
  if (!decHex || !supHex) return null;
  const dec = Number(I_DECIMALS.decodeFunctionResult("decimals",    decHex)[0]);
  const sup = I_SUPPLY.decodeFunctionResult("totalSupply", supHex)[0] as bigint;
  return Number(ethers.formatUnits(sup, dec));
}

const FB = (name: string, issuer: string): RwaAsset => ({
  name, issuer, chain: "Ethereum",
  nav: null, navUpdatedAt: null, navContinuous: false,
  supply: null, supplyUsd: null, oracleDivergence: false,
});

export async function fetchRwaAssets(): Promise<RwaAsset[]> {
  const rpc = (process.env.ALCHEMY_RPC_URL ?? "").trim();

  const [usdy, ousg, ustb, usyc] = await Promise.all([

    attempt("usdy", async () => {
      const ORACLE = "0xa0219aa5b31e65bc920b5b6dfb8edf0988121de0";
      const TOKEN  = "0x96f6ef951840721adbf46ac996b59e0235cb985c";
      const [priceHex, supply] = await Promise.all([
        ethCall(ORACLE, I_GETPRICE.encodeFunctionData("getPrice"), rpc),
        erc20Supply(TOKEN, rpc),
      ]);
      const nav = priceHex
        ? Number(ethers.formatUnits(I_GETPRICE.decodeFunctionResult("getPrice", priceHex)[0] as bigint, 18))
        : null;
      return { name: "USDY", issuer: "Ondo Finance", chain: "Ethereum",
               nav, navUpdatedAt: null as string | null, navContinuous: false,
               supply, supplyUsd: nav != null && supply != null ? nav * supply : null,
               oracleDivergence: false };
    }),

    attempt("ousg", async () => {
      const ORACLE = "0x9cad45a8bf0ed41ff33074449b357c7a1fab4094";
      const TOKEN  = "0x1b19c19393e2d034d8ff31ff34c81252fcbbee92";
      const [priceHex, supply] = await Promise.all([
        ethCall(ORACLE, I_GETASSET.encodeFunctionData("getAssetPrice", [TOKEN]), rpc),
        erc20Supply(TOKEN, rpc),
      ]);
      const nav = priceHex
        ? Number(ethers.formatUnits(I_GETASSET.decodeFunctionResult("getAssetPrice", priceHex)[0] as bigint, 18))
        : null;
      return { name: "OUSG", issuer: "Ondo Finance", chain: "Ethereum",
               nav, navUpdatedAt: null as string | null, navContinuous: false,
               supply, supplyUsd: nav != null && supply != null ? nav * supply : null,
               oracleDivergence: false };
    }),

    attempt("ustb", async () => {
      const ORACLE = "0xe4fa682f94610ccd170680cc3b045d77d9e528a8";
      const TOKEN  = "0x43415eb6ff9db7e26a15b704e7a3edce97d31c4e";
      const [lrdHex, supply] = await Promise.all([
        ethCall(ORACLE, I_LRD.encodeFunctionData("latestRoundData"), rpc),
        erc20Supply(TOKEN, rpc),
      ]);
      const nav = lrdHex
        ? Number(ethers.formatUnits(I_LRD.decodeFunctionResult("latestRoundData", lrdHex)[1] as bigint, 6))
        : null;
      return { name: "USTB", issuer: "Superstate", chain: "Ethereum",
               nav, navUpdatedAt: null as string | null, navContinuous: true,
               supply, supplyUsd: nav != null && supply != null ? nav * supply : null,
               oracleDivergence: false };
    }),

    attempt("usyc", async () => {
      const MAIN  = "0x4c48bcb2160F8e0aDbf9D4F3B034f1e36d1f8b3e";
      const ALT   = "0x74f2199aeb743f68f05943e5715a33eaf2b61f53";
      const TOKEN = "0x136471a34f6ef19fe571effc1ca711fdb8e49f2b";
      const lrdData = I_LRD.encodeFunctionData("latestRoundData");
      const decData = I_DECIMALS.encodeFunctionData("decimals");
      const [ml, md, al, ad, supply] = await Promise.all([
        ethCall(MAIN, lrdData, rpc),
        ethCall(MAIN, decData, rpc),
        ethCall(ALT,  lrdData, rpc),
        ethCall(ALT,  decData, rpc),
        erc20Supply(TOKEN, rpc),
      ]);
      let nav: number | null = null;
      let navUpdatedAt: string | null = null;
      if (ml && md) {
        const dec = Number(I_DECIMALS.decodeFunctionResult("decimals", md)[0]);
        const lrd = I_LRD.decodeFunctionResult("latestRoundData", ml);
        nav          = Number(ethers.formatUnits(lrd[1] as bigint, dec));
        navUpdatedAt = new Date(Number(lrd[3] as bigint) * 1000).toISOString();
      }
      const altNav = (al && ad)
        ? Number(ethers.formatUnits(
            I_LRD.decodeFunctionResult("latestRoundData", al)[1] as bigint,
            Number(I_DECIMALS.decodeFunctionResult("decimals", ad)[0]),
          ))
        : null;
      const oracleDivergence = nav != null && altNav != null
        ? Math.abs(nav - altNav) / nav > 0.001
        : false;
      return { name: "USYC", issuer: "Circle", chain: "Ethereum",
               nav, navUpdatedAt, navContinuous: false,
               supply, supplyUsd: nav != null && supply != null ? nav * supply : null,
               oracleDivergence };
    }),

  ]);

  return [
    usdy ?? FB("USDY", "Ondo Finance"),
    ousg ?? FB("OUSG", "Ondo Finance"),
    ustb ?? FB("USTB", "Superstate"),
    usyc ?? FB("USYC", "Circle"),
  ];
}
