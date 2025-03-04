// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

// List of paths that don't require authentication
const publicPaths = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',  // Supabase auth callback
  '/invite',  // For invitation links
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/invitations',  // Allow checking invitations without auth
];

export async function middleware(request: NextRequest) {
  // Check if the path is public
  const { pathname } = request.nextUrl;
  
  // Allow access to static files and public routes without authentication
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/static') || 
    pathname.startsWith('/api/test') ||
    publicPaths.some(path => pathname === path || pathname.startsWith(path))
  ) {
    return NextResponse.next();
  }

  // Create a Supabase client for the middleware
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });

  // Check if user is authenticated with Supabase
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Handle session refresh if needed
  if (session?.expires_at && session.expires_at < Math.floor(Date.now() / 1000)) {
    // Session is expired, try to refresh it
    const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
    if (!refreshedSession) {
      // If refresh failed, redirect to login
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // If there's no session and the path is not public, redirect to login
  if (!session && !publicPaths.some(path => pathname.startsWith(path))) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};