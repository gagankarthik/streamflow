import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Original protected and public paths - kept for context if needed later
// const protectedPaths = [
//   '/dashboard',
//   '/projects',
//   '/tickets',
//   '/profile',
//   '/notifications',
// ];
// const publicPaths = ['/login', '/signup', '/forgot-password'];

export function middleware(request: NextRequest) {
   return NextResponse.next();
}
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (public assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|assets).*)',
  ],
};