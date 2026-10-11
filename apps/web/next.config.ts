import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Capture screenshots are served from Supabase Storage through short-lived signed URLs.
  images: { remotePatterns: [{ protocol: "http", hostname: "127.0.0.1" }, { protocol: "https", hostname: "*.supabase.co" }] },
};

export default config;
