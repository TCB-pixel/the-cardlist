/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
    // Allow local images with jpg/jpeg
    formats: ["image/webp", "image/avif"],
  },
};

export default nextConfig;
