import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 300, // 5 minutos de cache instantâneo no navegador para navegação zero-delay
      static: 300,
    },
  },
};

export default nextConfig;
