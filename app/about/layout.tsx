import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About PegCheck — How It Works",
  description: "PegCheck monitors stablecoin peg health in real time across 25 stablecoins using up to 7 price sources including Chainlink and CoinMarketCap. Be first to know when a stablecoin depegs.",
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
