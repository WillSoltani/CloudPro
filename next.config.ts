import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR
    ? { distDir: process.env.NEXT_DIST_DIR }
    : {}),
  poweredByHeader: false,
  // Security headers on the portfolio host only (www.soltani.org is a CloudFront redirect to the apex);
  // ChapterFlow's hosts keep their own policy.
  async headers() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "soltani.org" }],
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/book/home",
        destination: "/book/workspace",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
