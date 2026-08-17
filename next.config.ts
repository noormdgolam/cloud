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
  // nodemailer does internal dynamic requires that Next's output file
  // tracing can't statically follow, so it's silently dropped from the
  // standalone bundle's node_modules without this — confirmed missing via
  // `find .next/standalone -iname "*nodemailer*"` turning up nothing.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/nodemailer/**/*"],
  },
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
      // PreviewDialog's PDF fallback embeds this same-origin route in an
      // <iframe> — X-Frame-Options: DENY (from the blanket rule above)
      // blocks that too, not just cross-origin framing, so the PDF preview
      // shows "refused to connect". SAMEORIGIN still blocks any other site
      // from framing this route (the actual clickjacking risk); it just
      // stops blocking the app from framing its own content.
      {
        source: "/api/files/:id/download",
        headers: securityHeaders.map((h) => (h.key === "X-Frame-Options" ? { key: h.key, value: "SAMEORIGIN" } : h)),
      },
    ];
  },
};

export default nextConfig;
