import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PegCheck API — Stablecoin Data for Developers",
  description: "Stablecoin depeg monitoring API powered by Chainlink. 1,500+ data points, webhook alerts, on-chain event logging. Free 30 day trial from £99/month.",
};

export default function DevelopersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
