import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About PegCheck — How It Works",
  description: "PegCheck monitors stablecoin peg health in real time across 21 stablecoins using up to 6 price sources including Chainlink. Be first to know when a stablecoin depegs.",
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
