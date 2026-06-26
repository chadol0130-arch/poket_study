/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage public bucket for Pokémon sprites.
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
