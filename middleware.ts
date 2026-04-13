import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Tag every request so Sentry alerts/filters can be scoped by area
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    Sentry.setTag('area', 'admin');
  } else {
    Sentry.setTag('area', 'public');
  }

  // Exclude login page from protection (fix for RED FLAG #2)
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  // Protect all other /admin routes and /api/admin routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    // Check both cookie AND Authorization header (fix for RED FLAG #1)
    const token = request.cookies.get('admin_token')?.value
                || request.headers.get('Authorization')?.replace('Bearer ', '');

    const validToken = process.env.ADMIN_TOKEN;

    if (!validToken || token !== validToken) {
      // For API routes, return 401
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // For page routes, redirect to login
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
