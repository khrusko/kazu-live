import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./data/network.json", "./data/roads.json"],
    "/api/*": ["./data/network.json", "./data/roads.json"],
  },
};

export default nextConfig;
