/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  distDir: '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@zhiyu/ui', '@zhiyu/api-client', '@zhiyu/shared-types'],
  env: {
    NEXT_PUBLIC_DEFAULT_PLATFORM: 'portal',
  },
  experimental: {
    proxyClientMaxBodySize: '150mb',
  },
  async rewrites() {
    const apiProxy = process.env.API_PROXY_URL || 'http://127.0.0.1:8080'
    return [
      {
        source: '/api/:path*',
        destination: `${apiProxy}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiProxy}/uploads/:path*`,
      },
      {
        source: '/kkfileview/:path*',
        destination: `http://127.0.0.1:8012/kkfileview/:path*`,
      },
        source: '/portal/career',
        destination: '/job/positions',
      },
      {
        source: '/portal/scene',
        destination: '/scene',
      },
      {
        source: '/portal/ability',
        destination: '/evaluation/landing',
      },
      {
        source: '/portal/course',
        destination: '/lesson/admin/system',
      },
      {
        source: '/portal/apps/career',
        destination: '/job/positions',
      },
      {
        source: '/portal/apps/scene',
        destination: '/scene',
      },
      {
        source: '/explore',
        destination: '/job/positions',
      },
      {
        source: '/explore/:path*',
        destination: '/job/positions/:path*',
      },
    ]
  },
}

export default nextConfig
