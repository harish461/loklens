import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow LAN IP and localhost origins during development so /_next/static/* and /_next/webpack-hmr
  // are not blocked with 403 Forbidden when accessing http://192.168.1.15:3000/admin.
  allowedDevOrigins: ['192.168.1.15', '192.168.1.*', '127.0.0.1', 'localhost'],
  // Image delivery (custom loader over pre-generated sizes, architecture §5) is set up with the frontend.
  images: {
    localPatterns: [{ pathname: '/api/media/file/**' }],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
