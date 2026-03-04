/** @type {import("next").NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["langsmith"],
  },
};

export default nextConfig;
