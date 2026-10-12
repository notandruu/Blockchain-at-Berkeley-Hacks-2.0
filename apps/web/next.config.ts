import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Capture screenshots are served from Supabase Storage through short-lived signed URLs.
  // Hosted: the browser talks to one origin and Vercel proxies the API to the service
  // project, so there is no CORS and the SSE stream rides the same connection.
  async rewrites() {
    const origin = process.env.SERVICE_ORIGIN;
    if (!origin) return [];
    return [
      { source: "/api/:path*", destination: `${origin}/api/:path*` },
      { source: "/health", destination: `${origin}/health` },
    ];
  },
  images: { remotePatterns: [{ protocol: "http", hostname: "127.0.0.1" }, { protocol: "https", hostname: "*.supabase.co" }] },
};

export default config;
