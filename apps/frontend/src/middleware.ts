import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // OAuth popup callbacks — không chặn (popup có thể không mang cookie đầy đủ)
  if (pathname.startsWith('/oauth')) {
    return NextResponse.next();
  }

  // Đọc token từ cookie
  const token = request.cookies.get('token')?.value;

  // Nếu cố gắng vào Dashboard mà CHƯA có token -> Đá về Login
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Nếu cố gắng vào Login mà ĐÃ có token -> Đá vào Dashboard
  if (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register')) {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Nếu cố gắng vào Trang chủ (Homepage) mà ĐÃ có token -> Đá vào Dashboard
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

// Cấu hình Middleware chỉ chạy trên các Route cụ thể
export const config = {
  matcher: ['/', '/dashboard/:path*', '/login', '/register', '/logout', '/oauth/:path*'],
};
