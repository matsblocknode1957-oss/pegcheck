import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const TOKENS: Record<string, string> = {
  usdt:   "0xdac17f958d2ee523a2206206994597c13d831ec7",
  usdc:   "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  usds:   "0x6b175474e89094c44da98b954eedeac495271d0f",
  ethena: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3",
  pyusd:  "0x6c3ea9036406852006290770bedfcaba0e23a0e8",
  fdusd:  "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409",
  rlusd:  "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD",
  tusd:   "0x0000000000085d4780B73119b644AE5ecd22b376",
  frax:   "0x853d955aCEf822Db058eb8505911ED77F175b99e",
  gho:    "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f",
  crvusd: "0xf939E0A03FB07F59A73314E73794be0E57ac1b4E",
  lusd:   "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0",
  usdp:   "0x8E870D67F660D95d5be530380D0eC0bd388289E1",
  usdd:   "0x0C10bF8FcB7Bf5412187A595ab97a3609160b5c9",
  mkusd:  "0x4591DBfF62656E7859Afe5e45f6f47D3669fBB28",
  eurc:   "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c",
  dola:   "0x865377367054516e17014CcDed1e7d814EDC9ce4",
  alusd:  "0xBC6DA0FE9aD5f3b0d58160288917AA56653660e9",
  bold:   "0x6440f144b7e50D3567575d8a5Dc73e046a8f6f54",
};

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address || !ethers.isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const rpcUrl = process.env.ALCHEMY_RPC_URL;
  if (!rpcUrl) {
    return NextResponse.json({ error: "RPC not configured" }, { status: 500 });
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const balances: Record<string, { balance: string; decimals: number }> = {};

  await Promise.all(
    Object.entries(TOKENS).map(async ([slug, tokenAddress]) => {
      try {
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const [balance, decimals] = await Promise.all([
          contract.balanceOf(address) as Promise<bigint>,
          contract.decimals() as Promise<bigint>,
        ]);
        balances[slug] = { balance: balance.toString(), decimals: Number(decimals) };
      } catch {
        balances[slug] = { balance: "0", decimals: 18 };
      }
    })
  );

  return NextResponse.json({ balances });
}
