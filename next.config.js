/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },
  async redirects() {
    return [
      // Misspelled FL region slugs cleaned up in TDL #604 follow-up
      // (mortgage_regions dup rows deleted; listings migrated to correct city).
      { source: '/altantis', destination: '/atlantis', permanent: true },
      { source: '/altomonte-springs', destination: '/altamonte-springs', permanent: true },
    ];
  },
};

module.exports = nextConfig;
