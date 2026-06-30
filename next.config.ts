import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  // @ts-expect-error serverActionsBodySizeLimit existe en runtime mais manque dans les types bundlés
  experimental: { serverActionsBodySizeLimit: '20mb' },
};

export default nextConfig;
