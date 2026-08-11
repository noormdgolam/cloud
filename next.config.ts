import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Only meaningful once served over HTTPS in production, but harmless locally.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Every request (including /api/upload) passes through proxy.ts for the
    // anonymous-session header — Next.js caps request bodies through that
    // layer at 10MB by default, silently truncating anything larger before
    // it reaches the route handler. Match this to MAX_SINGLE_SHOT_BYTES in
    // src/app/api/upload/route.ts.
    proxyClientMaxBodySize: "100mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
