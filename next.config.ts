import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/stableguard",
        destination: "/stableguard-replay.html",
        permanent: false,
      },
      {
        source: "/positions",
        destination: "https://liquidlens.uk",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
