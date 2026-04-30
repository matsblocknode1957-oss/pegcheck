import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PegCheck — On-Chain Depeg Record",
  description: "Every stablecoin depeg event permanently logged on the Ethereum blockchain via smart contract. Immutable, public, verifiable by anyone.",
};

export default function OnchainLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
