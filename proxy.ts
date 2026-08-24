import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const protectedPrefixes = [
  '/dashboard',
  '/field',
  '/settings',
  '/overseer',
  '/publisher',
];
const authRoutes = new Set(['/login', '/register', '/forgot-password']);

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const authRoute = authRoutes.has(pathname);
  if (!protectedRoute && !authRoute) return NextResponse.next();

  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        for (const cookie of cookies) request.cookies.set(cookie.name, cookie.value);
        response = NextResponse.next({ request });
        for (const cookie of cookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (protectedRoute && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    const { data: membership } = await supabase
      .from('congregation_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (authRoute && membership) {
      return NextResponse.redirect(
        new URL(membership.role === 'publisher' ? '/field' : '/dashboard', request.url),
      );
    }

    if (protectedRoute && !membership) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'membership');
      return NextResponse.redirect(loginUrl);
    }

    if (membership?.role === 'publisher' && (pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname.startsWith('/overseer'))) {
      return NextResponse.redirect(new URL('/field', request.url));
    }

    if (membership && membership.role !== 'publisher' && (pathname === '/field' || pathname.startsWith('/field/') || pathname.startsWith('/publisher'))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|sw.js|manifest.webmanifest|offline).*)',
  ],
};
