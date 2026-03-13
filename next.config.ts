import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
