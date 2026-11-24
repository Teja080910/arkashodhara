import { NextResponse } from 'next/server';

export function middleware(request) {
  const url = request.nextUrl.clone();
  url.pathname = '/admin/social-planner';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/social', '/admin/social/:path*'],
};
