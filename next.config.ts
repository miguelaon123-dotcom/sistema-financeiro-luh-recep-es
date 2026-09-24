import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 0, // Sem cache antigo no navegador: reflete dados financeiros instantaneamente
      static: 30,
    },
  },
};

export default nextConfig;
