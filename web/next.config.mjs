/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fully client-side app -> static export; deploys free on any static
  // host (Render static site / Vercel). `next dev` is unaffected.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
