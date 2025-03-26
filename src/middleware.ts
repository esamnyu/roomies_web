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
  // REMOVED: '/api/tasks', // Temporarily bypassing auth for tasks API
  '/api/debug-cookies', // Add this for debugging cookie issues
];

export async function middleware(request: NextRequest) {
  // Check if the path is public
  const { pathname } = request.nextUrl;

  // Add debugging for middleware processing
  console.log(`Middleware processing: ${pathname}`);

  // Allow access to static files and public routes without authentication
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/api/test') ||
    publicPaths.some(path => pathname === path || pathname.startsWith(path))
  ) {
    console.log(`Public path access: ${pathname}`);
    return NextResponse.next();
  }

  // Create a Supabase client for the middleware
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });

  try {
    // Check if user is authenticated with Supabase
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    // Log session information for debugging
    if (session) {
      console.log(`Active session found for user: ${session.user.id}`);
    } else {
      console.log(`No active session found for: ${pathname}`);
      if (sessionError) {
        console.error(`Session error: ${sessionError.message}`);
      }
    }

    // Handle session refresh if needed
    if (session?.expires_at && session.expires_at < Math.floor(Date.now() / 1000)) {
      console.log('Session expired, attempting refresh');
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.error(`Session refresh error: ${refreshError.message}`);
      }

      if (!refreshedSession) {
        console.log('Session refresh failed, redirecting to login');

        // For API routes, return JSON error instead of redirecting
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({
            error: 'Authentication required - session expired',
            path: pathname
          }, { status: 401 });
        }

        // For regular routes, redirect to login
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(redirectUrl);
      } else {
        console.log('Session refresh successful');
      }
    }

    // If there's no session and the path is not public, handle accordingly
    if (!session && !publicPaths.some(path => pathname === path || pathname.startsWith(path))) {
      console.log(`Authentication required for: ${pathname}`);

      // Special handling for API routes
      if (pathname.startsWith('/api/')) {
        console.log(`API authentication failed: ${pathname}`);
        return NextResponse.json({
          error: 'Authentication required',
          path: pathname,
          message: 'You must be logged in to access this API endpoint'
        }, { status: 401 });
      }

      // Redirect to login for regular routes
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return res;
  } catch (error) {
    console.error(`Middleware error: ${error instanceof Error ? error.message : 'Unknown error'}`);

    // For API routes, return a JSON error
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({
        error: 'Authentication error',
        message: 'An error occurred while checking authentication'
      }, { status: 500 });
    }

    // For regular routes, redirect to login
    const redirectUrl = new URL('/login', request.url);
    return NextResponse.redirect(redirectUrl);
  }
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