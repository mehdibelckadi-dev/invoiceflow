import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'https://lefse-production.up.railway.app'}/:path*`,
      },
    ]
  },
}

export default nextConfig
