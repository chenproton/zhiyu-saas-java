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
    NEXT_PUBLIC_DEFAULT_PLATFORM: 'saas',
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
    ]
  },
}

export default nextConfig
