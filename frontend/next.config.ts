import type { NextConfig } from "next";

const apiProxyTarget = (
  process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.30.83.192"],
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        // Keep browser requests same-origin; only Next connects to private FastAPI.
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
