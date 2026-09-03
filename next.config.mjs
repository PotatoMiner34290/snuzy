/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Turbopack alias (used by `next dev`)
  turbopack: {
    resolveAlias: {
      tone: 'tone/build/esm/index.js'
    }
  },

  // Webpack alias (used by `next build` on Vercel production)
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      tone: new URL('./node_modules/tone/build/esm/index.js', import.meta.url).pathname
    };
    return config;
  }
};

export default nextConfig;