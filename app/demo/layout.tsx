import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PegCheck API Demo — Live Stablecoin Data",
  description: "See the PegCheck stablecoin depeg monitoring API working in real time. Live data across 8 stablecoins powered by Chainlink.",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
