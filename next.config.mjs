/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      tone: 'tone/build/esm/index.js'
    }
  }
};

export default nextConfig;