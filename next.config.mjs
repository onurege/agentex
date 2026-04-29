/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfjs-dist 5.x pure-ESM build (build/pdf.mjs); Next.js 14 webpack
  // varsayılan ayarda "Object.defineProperty called on non-object"
  // hatası üretiyor. SWC transpilation + .mjs auto-type belt & suspenders.
  transpilePackages: ["pdfjs-dist"],
  webpack: (config) => {
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: "javascript/auto",
    });
    return config;
  },
};

export default nextConfig;
