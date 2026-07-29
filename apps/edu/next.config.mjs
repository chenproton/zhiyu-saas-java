/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  distDir: '.next',
  typescript: {
    // 部署时跳过类型检查，由 pnpm typecheck 在提交前/CI 中保证；可节省 ~30s 构建时间
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
  async redirects() {
    return [
      {
        source: '/job/landing',
        destination: '/job/student',
        permanent: true,
      },
    ]
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
        source: '/templates/:path*',
        destination: `${apiProxy}/templates/:path*`,
      },
      {
        source: '/kkfileview/:path*',
        destination: `http://127.0.0.1:8012/kkfileview/:path*`,
      },
      {
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
