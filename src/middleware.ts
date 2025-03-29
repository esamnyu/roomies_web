import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// List of paths that don't require authentication (keep your existing list)
const publicPaths = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',  // Supabase auth callback
  '/invite',  // For invitation links
  '/api/auth/register', // Keep if still using custom backend registration
  '/api/auth/login', // Keep if still using custom backend login
  '/api/auth/forgot-password', // Keep for password reset flow
  '/api/auth/reset-password', // Keep for password reset flow
  '/api/invitations',  // Allow checking invitations without auth
  '/api/debug-cookies',
  '/api/test-auth',
];


export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is updated, update the request for downstream routes
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          // Set the cookie on the response
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the request for downstream routes
          request.cookies.delete(name);
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          // Remove the cookie from the response
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const { pathname } = request.nextUrl;
  console.log(`Middleware processing: ${pathname}`);

  // Refresh session (important for Server Components): https://supabase.com/docs/guides/auth/server-side/nextjs
  // getUser() validates the session and refreshes the token if necessary
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
      console.error(`Middleware getUser error: ${userError.message}`);
      // Handle potential errors during getUser, maybe log them differently
  }

  // --- Authentication Check ---
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path));
  const isStaticAsset = pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname.includes('favicon.ico');

  if (!user && !isPublicPath && !isStaticAsset) {
    // No user, not a public path, not a static asset -> PROTECT
    console.log(`Authentication required for: ${pathname}. Redirecting to login.`);

    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('callbackUrl', pathname); // Pass the intended path

    // For API routes, return 401 JSON instead of redirecting
    if (pathname.startsWith('/api/')) {
      console.log(`API authentication failed: ${pathname}`);
      // Ensure the response from NextResponse.json also includes updated cookies if any were set/removed
      const apiResponse = NextResponse.json(
          { error: 'Authentication required', path: pathname },
          { status: 401 }
      );
      // Copy cookies from the potentially modified 'response' object
      response.cookies.getAll().forEach(cookie => apiResponse.cookies.set(cookie));
      return apiResponse;
    }

    // For regular pages, redirect
    // Ensure the redirect response also includes updated cookies
    const redirectResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie));
    return redirectResponse;

  } else if (user) {
      console.log(`Active session found for user: ${user.id} at ${pathname}`);
      // You could potentially add user role checks here if needed
  } else {
      console.log(`Public path access: ${pathname}`);
  }

  // Return the potentially modified response (with updated cookies)
  return response;
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * We will handle static asset checks inside the middleware itself.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};