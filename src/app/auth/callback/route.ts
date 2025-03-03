// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  
  // Handle different types of auth callbacks
  const code = requestUrl.searchParams.get('code');
  const token = requestUrl.searchParams.get('token');
  const type = requestUrl.searchParams.get('type');
  
  // Create a response that will redirect to dashboard
  const response = NextResponse.redirect(
    new URL('/dashboard', request.url)
  );
  
  try {
    // Create a Supabase client
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    if (code) {
      // This is a standard auth code exchange
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('Error exchanging code for session:', error);
        return NextResponse.redirect(
          new URL('/auth/login?error=Unable to verify your account', request.url)
        );
      }
      
      if (data.session) {
        // Set cookies manually if needed
        response.cookies.set('sb-access-token', data.session.access_token, {
          path: '/',
          maxAge: data.session.expires_in,
          sameSite: 'lax',
          // secure: process.env.NODE_ENV === 'production',
          secure: true,
          httpOnly: true,
        });
        
        if (data.session.refresh_token) {
          response.cookies.set('sb-refresh-token', data.session.refresh_token, {
            path: '/',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            sameSite: 'lax',
            // secure: process.env.NODE_ENV === 'production',
            secure: true,
            httpOnly: true,
          });
        }
      }
    } else if (token && type === 'signup') {
      // This is an email verification flow
      // Directly verify the email token instead of relying on Supabase's redirect
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      });
      
      if (error) {
        console.error('Error verifying email:', error);
        return NextResponse.redirect(
          new URL('/auth/login?error=Unable to verify your email', request.url)
        );
      }
      
      // If verification was successful, redirect to login with a success message
      return NextResponse.redirect(
        new URL('/auth/login?message=Email verified! You can now sign in', request.url)
      );
    }
    
    // Default redirect to dashboard
    return response;
  } catch (error) {
    console.error('Unexpected error in auth callback:', error);
    return NextResponse.redirect(
      new URL('/auth/login?error=An unexpected error occurred', request.url)
    );
  }
}