import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Coolify Docker image only needs the traced runtime dependencies.
  output: "standalone",
  deploymentId: process.env.DEPLOYMENT_VERSION ?? process.env.SOURCE_COMMIT,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Accel-Buffering", value: "no" }],
      },
    ];
  },
};

export default nextConfig;
