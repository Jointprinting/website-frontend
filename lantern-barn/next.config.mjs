/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Sanity-hosted images (CMS)
      { protocol: "https", hostname: "cdn.sanity.io" },
      // Unsplash placeholders used before real photos are uploaded
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
