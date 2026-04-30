import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PegCheck — Developer Dashboard",
  description: "View your PegCheck API key, usage stats and calls remaining. Log in with your email to access your developer dashboard.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
