/** @type {import('next').NextConfig} */
const noStoreHeaders = [
  {
    key: 'Cache-Control',
    value: 'no-store, max-age=0, must-revalidate',
  },
]

const htmlAppShellRoutes = [
  '/',
  '/dashboard',
  '/chapter/:chapterId',
  '/section/:sectionId',
  '/login',
  '/signup',
  '/book',
  '/reset-password',
  '/join-class',
  '/my-classes',
  '/resume/:token',
]

const nextConfig = {
  async headers() {
    return htmlAppShellRoutes.map((source) => ({
      source,
      headers: noStoreHeaders,
    }))
  },
}

module.exports = nextConfig
