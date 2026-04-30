import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PegCheck — Real-time Stablecoin Health Monitor",
  description: "Real-time stablecoin depeg monitoring powered by Chainlink. Median pricing across 1,500+ data points. Instant alerts for USDT, USDC, USDS, PYUSD, FDUSD, RLUSD, TUSD and Ethena.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
       <link rel="icon" href="/favicon.svg" type="image/svg+xml" /> 
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-6K32B1GK8L"></script>
        <script dangerouslySetInnerHTML={{__html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-6K32B1GK8L');
        `}} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}