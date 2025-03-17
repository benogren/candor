// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  // Path matching for feedback routes that require authentication
  if (
    request.nextUrl.pathname.startsWith('/feedback/select-recipients') ||
    request.nextUrl.pathname.startsWith('/feedback/questions') ||
    request.nextUrl.pathname === '/feedback/complete'
  ) {
    // Check for feedback authentication token
    const feedbackAuth = request.cookies.get('feedback_auth');

    // console.log('*****Feedback Auth:', feedbackAuth);
    
    if (!feedbackAuth || !feedbackAuth.value) {
      // Redirect to login if no token
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
    
    try {
      // Validate the token
      const tokenData = JSON.parse(
        Buffer.from(feedbackAuth.value, 'base64').toString()
      );
      
      // Check if token is expired
      if (tokenData.exp && tokenData.exp < Math.floor(Date.now() / 1000)) {
        // Token expired, redirect to login
        const response = NextResponse.redirect(new URL('/auth/login', request.url));
        response.cookies.delete('feedback_auth');
        return response;
      }
      
      // Token is valid, proceed
      return NextResponse.next();
    } catch (error) {
      // Invalid token, redirect to login
      console.error('Invalid feedback_auth token:', error);
      const response = NextResponse.redirect(new URL('/auth/login', request.url));
      response.cookies.delete('feedback_auth');
      return response;
    }
  }

  // For API routes, continue with the existing Supabase authentication
  if (request.nextUrl.pathname.startsWith('/api/')) {
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
            // If the cookie is updated, update the request and response
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
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: CookieOptions) {
            // If the cookie is removed, update the request and response
            request.cookies.delete(name);
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.delete({
              name,
              ...options,
            });
          },
        },
      }
    );

    // Refresh the session if it exists
    await supabase.auth.getSession();

    return response;
  }
  
  // For all other routes, proceed normally
  return NextResponse.next();
}

// Configure which paths should be processed by the middleware
export const config = {
  matcher: [
    '/api/:path*',
    '/feedback/:path*',
    '/feedback/questions/',
    '/feedback/complete'
  ],
};