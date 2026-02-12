import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/overseer',
  '/publisher',
  '/settings',
];

// API routes that require authentication
const PROTECTED_API_ROUTES = [
  '/api/territories',
  '/api/houses',
  '/api/assignments',
  '/api/sync',
];

// Auth routes that should redirect if already authenticated
const AUTH_ROUTES = ['/login', '/register', '/forgot-password'];

// Routes that are part of auth flow but should be accessible when authenticated
const AUTH_FLOW_ROUTES = ['/update-password', '/auth/callback'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check route types
  const isProtectedRoute = PROTECTED_ROUTES.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  );
  const isProtectedApiRoute = PROTECTED_API_ROUTES.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  );
  const isAuthRoute = AUTH_ROUTES.some(route => pathname === route);
  const isAuthFlowRoute = AUTH_FLOW_ROUTES.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // Skip auth checks for auth flow routes
  if (isAuthFlowRoute) {
    return NextResponse.next();
  }

  // Only run auth checks for protected routes and API routes
  if (!isProtectedRoute && !isProtectedApiRoute && !isAuthRoute) {
    return NextResponse.next();
  }

  try {
    // Create Supabase client to check session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          },
        },
      }
    );

    // Get user (more secure than getSession)
    const { data: { user } } = await supabase.auth.getUser();
    const isAuthenticated = !!user;

    // API routes: return 401 if not authenticated
    if (isProtectedApiRoute && !isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Protected page routes: redirect to login
    if (isProtectedRoute && !isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Auth routes: redirect authenticated users to dashboard
    if (isAuthRoute && isAuthenticated) {
      const role = user?.user_metadata?.role || 'publisher';
      const redirectPath = role === 'overseer' || role === 'admin' ? '/overseer' : '/publisher';
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Proxy error:', error);
    // On error, allow the request to continue to avoid blocking the user
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // Match all request paths except:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - public folder files (manifest.json, icons, etc.)
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|service-worker.js|offline).*)',
  ],
};
