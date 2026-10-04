import { NextResponse } from "next/server";
import { ethers } from "ethers";

export const dynamic = "force-dynamic";

const FALLBACK_RPC = "https://ethereum-rpc.publicnode.com";

const GETPRICE_ABI = ["function getPrice() view returns (uint256)"];
const GETASSET_ABI = ["function getAssetPrice(address) view returns (uint256)"];
const LRD_ABI = [
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "function decimals()        view returns (uint8)",
];
const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function decimals()    view returns (uint8)",
];

async function attempt<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

async function fetchSupply(provider: ethers.JsonRpcProvider, address: string): Promise<number | null> {
  const c = new ethers.Contract(address, ERC20_ABI, provider);
  const [dec, sup] = await Promise.all([
    attempt(() => c.decimals()),
    attempt(() => c.totalSupply()),
  ]);
  if (dec == null || sup == null) return null;
  return Number(ethers.formatUnits(sup, Number(dec)));
}

export async function GET() {
  const rpcUrl  = (process.env.ALCHEMY_RPC_URL ?? "").trim() || FALLBACK_RPC;
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const [usdy, ousg, ustb, usyc] = await Promise.all([

    attempt(async () => {
      const oracle = new ethers.Contract("0xa0219aa5b31e65bc920b5b6dfb8edf0988121de0", GETPRICE_ABI, provider);
      const [raw, supply] = await Promise.all([
        attempt(() => oracle.getPrice()),
        fetchSupply(provider, "0x96f6ef951840721adbf46ac996b59e0235cb985c"),
      ]);
      const nav = raw != null ? Number(ethers.formatUnits(raw, 18)) : null;
      return {
        name: "USDY", issuer: "Ondo Finance", chain: "Ethereum",
        nav, navUpdatedAt: null as string | null, navContinuous: false,
        supply, supplyUsd: nav != null && supply != null ? nav * supply : null,
        oracleDivergence: false,
      };
    }),

    attempt(async () => {
      const OUSG_ADDR = "0x1b19c19393e2d034d8ff31ff34c81252fcbbee92";
      const oracle = new ethers.Contract("0x9cad45a8bf0ed41ff33074449b357c7a1fab4094", GETASSET_ABI, provider);
      const [raw, supply] = await Promise.all([
        attempt(() => oracle.getAssetPrice(OUSG_ADDR)),
        fetchSupply(provider, OUSG_ADDR),
      ]);
      const nav = raw != null ? Number(ethers.formatUnits(raw, 18)) : null;
      return {
        name: "OUSG", issuer: "Ondo Finance", chain: "Ethereum",
        nav, navUpdatedAt: null as string | null, navContinuous: false,
        supply, supplyUsd: nav != null && supply != null ? nav * supply : null,
        oracleDivergence: false,
      };
    }),

    attempt(async () => {
      const oracle = new ethers.Contract("0xe4fa682f94610ccd170680cc3b045d77d9e528a8", LRD_ABI, provider);
      const [lrd, supply] = await Promise.all([
        attempt(() => oracle.latestRoundData()),
        fetchSupply(provider, "0x43415eb6ff9db7e26a15b704e7a3edce97d31c4e"),
      ]);
      const nav = lrd != null ? Number(ethers.formatUnits(lrd[1], 6)) : null;
      return {
        name: "USTB", issuer: "Superstate", chain: "Ethereum",
        nav, navUpdatedAt: null as string | null, navContinuous: true,
        supply, supplyUsd: nav != null && supply != null ? nav * supply : null,
        oracleDivergence: false,
      };
    }),

    attempt(async () => {
      const MAIN = "0x4c48bcb2160F8e0aDbf9D4F3B034f1e36d1f8b3e";
      const ALT  = "0x74f2199aeb743f68f05943e5715a33eaf2b61f53";
      const mc = new ethers.Contract(MAIN, LRD_ABI, provider);
      const ac = new ethers.Contract(ALT,  LRD_ABI, provider);
      const [ml, md, al, ad, supply] = await Promise.all([
        attempt(() => mc.latestRoundData()),
        attempt(() => mc.decimals()),
        attempt(() => ac.latestRoundData()),
        attempt(() => ac.decimals()),
        fetchSupply(provider, "0x136471a34f6ef19fe571effc1ca711fdb8e49f2b"),
      ]);
      let nav: number | null = null;
      let navUpdatedAt: string | null = null;
      if (ml != null && md != null) {
        nav         = Number(ethers.formatUnits(ml[1], Number(md)));
        navUpdatedAt = new Date(Number(ml[3]) * 1000).toISOString();
      }
      const altNav = al != null && ad != null ? Number(ethers.formatUnits(al[1], Number(ad))) : null;
      const oracleDivergence = nav != null && altNav != null
        ? Math.abs(nav - altNav) / nav > 0.001
        : false;
      return {
        name: "USYC", issuer: "Hashnote", chain: "Ethereum",
        nav, navUpdatedAt, navContinuous: false,
        supply, supplyUsd: nav != null && supply != null ? nav * supply : null,
        oracleDivergence,
      };
    }),

  ]);

  const fb = (name: string, issuer: string) => ({
    name, issuer, chain: "Ethereum",
    nav: null, navUpdatedAt: null, navContinuous: false,
    supply: null, supplyUsd: null, oracleDivergence: false,
  });

  const assets = [
    usdy ?? fb("USDY", "Ondo Finance"),
    ousg ?? fb("OUSG", "Ondo Finance"),
    ustb ?? fb("USTB", "Superstate"),
    usyc ?? fb("USYC", "Hashnote"),
  ];

  return NextResponse.json(
    { assets, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
  );
}
