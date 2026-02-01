import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Skip auth check for API routes and static files
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get('claxton_auth');
  if (!authCookie?.value) {
    // Not authenticated — let the client-side AuthGuard handle the login UI
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
