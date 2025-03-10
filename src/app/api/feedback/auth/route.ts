// src/app/api/feedback/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
// import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  
  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
      { status: 400 }
    );
  }
  
  // Create a direct database client that doesn't use cookies
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Using the service role key for admin access
  );
  
  try {
    // Verify the token
    const { data: tokenData, error: tokenError } = await supabase
      .from('auth_tokens')
      .select('*')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .is('used_at', null)
      .single();
    
    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
    
    // Get the user details
    const { data: userData, error: userError } = await supabase
      .from('company_members')
      .select('id, email, name')
      .eq('id', tokenData.user_id)
      .single();
    
    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Mark the token as used
    await supabase
      .from('auth_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id);
    
    // Get the session ID if available
    const sessionId = tokenData.session_id;
    
    // Update the feedback session if exists
    if (sessionId) {
      await supabase
        .from('feedback_sessions')
        .update({ 
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .is('started_at', null);
    }
    
    // Create a response that will redirect to the appropriate page
    const redirectUrl = sessionId 
      ? `/feedback/select-recipients?session=${sessionId}` 
      : '/feedback';
      
    const response = NextResponse.redirect(new URL(redirectUrl, request.url));
    
    // Create a JWT token for the feedback session
    const feedbackToken = Buffer.from(JSON.stringify({
      userId: userData.id,
      email: userData.email,
      name: userData.name,
      sessionId: sessionId,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    })).toString('base64');
    
    // Set the token as a cookie
    response.cookies.set('feedback_auth', feedbackToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    
    return response;
    
  } catch (error) {
    console.error('Error authenticating user:', error);
    return NextResponse.json(
      { error: 'Authentication failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}