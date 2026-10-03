/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a production build run alongside `next dev` (e.g. NEXT_DIST_DIR=.next-build)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Self-contained server bundle for Docker / any Node host
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "ethers"],
  },
  // Hardhat sources live in the repo but are not part of the web app
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/artifacts/**", "**/cache/**", "**/.next*/**"],
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        source: "/commitx-manual.pdf",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

module.exports = nextConfig;
