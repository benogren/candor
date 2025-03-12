// src/app/api/feedback/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bearerToken = authHeader.substring(7);

  const token = request.nextUrl.searchParams.get('token');
  // console.log('*****Token:', token);
  
  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
      { status: 400 }
    );
  }
  
  // Create a direct database client that doesn't use cookies
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
  if (userError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  
  console.log(`User authenticated as: ${user.id}`);
  
  try {
    // First, get the token data regardless of whether it's been used
    const { data: tokenData, error: tokenError } = await supabase
      .from('auth_tokens')
      .select('*')
      .eq('token', token)
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .single();

      // console.log('*****Token Data:', tokenData);
    
    if (tokenError || !tokenData) {
      console.error('Error verifying token:', tokenError);
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = tokenData.user_id;
    const sessionId = tokenData.session_id;
    let isNewSession = false;
    
    // Get the user details
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email, name')
      .eq('id', userId)
      .single();

      // console.log('*****User Data:', userData);
    
    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // If token has been used before, check if session is still active
    if (tokenData.used_at !== null) {
      // Only allow reuse if there's a session
      if (!sessionId) {
        return NextResponse.json(
          { error: 'Token has already been used' },
          { status: 401 }
        );
      }
      
      // Check if the feedback session exists and is not completed
      const { data: sessionData, error: sessionError } = await supabase
        .from('feedback_sessions')
        .select('status')
        .eq('id', sessionId)
        .single();
        
      if (sessionError || !sessionData) {
        return NextResponse.json(
          { error: 'Feedback session not found' },
          { status: 404 }
        );
      }
      
      // If session is completed, don't allow reuse
      if (sessionData.status === 'completed') {
        return NextResponse.json(
          { error: 'Feedback session has already been completed' },
          { status: 401 }
        );
      }
      
      // console.log('*****Resuming existing session:', sessionId);
    } else {
      // If token was never used before, mark it as used now
      await supabase
        .from('auth_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenData.id);
        
      isNewSession = true;
    }

    // Update the feedback session status if this is the first time using the token
    if (sessionId && isNewSession) {
      const now = new Date().toISOString();
      await supabase
        .from('feedback_sessions')
        .update({ status: 'in_progress', started_at: now })
        .eq('id', sessionId)
        .is('started_at', null);
    }
    
    // Create a response that will redirect to the appropriate page
    const redirectUrl = sessionId 
      ? `/feedback/select-recipients?session=${sessionId}` 
      : '/feedback';

      // console.log('*****Redirect URL:', redirectUrl);
      
    // const response = NextResponse.redirect(new URL(redirectUrl, request.url));
    const response = NextResponse.json({ 
      success: true, 
      redirectTo: redirectUrl
    });

    // console.log('*****Response:', response);
    
    // Create a JWT token for the feedback session
    const feedbackToken = Buffer.from(JSON.stringify({
      userId: userData.id,
      email: userData.email,
      name: userData.name,
      sessionId: sessionId,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    })).toString('base64');

    // console.log('*****Feedback Token:', feedbackToken);
    
    // Set the token as a cookie
    response.cookies.set('feedback_auth', feedbackToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    // console.log('*****Response Cookies:', response.cookies);
    
    return response;
    
  } catch (error) {
    console.error('Error authenticating user:', error);
    return NextResponse.json(
      { error: 'Authentication failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}