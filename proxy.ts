import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value
        },
        set(name, value, options) {
          res.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name, options) {
          res.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const path = req.nextUrl.pathname

  // Keep coarse session protection here for cookie-backed areas. The /admin
  // dashboard uses the browser Supabase session and bearer-authenticated API
  // checks, so protecting it here would redirect valid localStorage-backed
  // sessions before the page can verify admin access.
  const protectedRoutes = ['/student']

  const isProtected = protectedRoutes.some((route) => path.startsWith(route))

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session && (path === '/login' || path === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/student/:path*',
    '/teacher/:path*',
    '/login',
    '/signup',
  ],
}