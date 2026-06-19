import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Disable Next.js automatic trailing-slash redirect so /socket.io/ is not
  // redirected to /socket.io (which breaks socket.io handshake).
  skipTrailingSlashRedirect: true,
  async rewrites() {
    // Proxy socket.io requests to the standalone realtime service on port 3003.
    // In production, set REALTIME_SERVICE_URL to your Supabase Realtime URL.
    const dest = process.env.REALTIME_SERVICE_URL || "http://localhost:3003";
    return [
      { source: "/socket.io/", destination: `${dest}/socket.io/` },
      { source: "/socket.io/:path*", destination: `${dest}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
