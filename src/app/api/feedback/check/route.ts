// src/app/api/feedback/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get('sessionid');

    if (!sessionId) {
        return NextResponse.json(
            { error: 'Session ID is required' },
            { status: 400 }
        );
    }

    console.log('*****Session ID:', sessionId);

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bearerToken = authHeader.substring(7);

    // Create a direct database client that doesn't use cookies
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
    if (userError || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = user.id;
    const userEmail = user.email;
    const userName = user.user_metadata.name; 

    const feedbackAuth = request.cookies.get('feedback_auth');
    if (!feedbackAuth || !feedbackAuth.value) {
        try {
            const response = NextResponse.json({ 
                success: true, 
            });

            // First, get the token data regardless of whether it's been used
            const { data: tokenData, error: tokenError } = await supabase
            .from('auth_tokens')
            .select('*')
            .eq('user_id', user.id)
            .gt('expires_at', new Date().toISOString())
            .single();

            if (tokenError) {
                console.log('Error fetching token data:', tokenError);
            }
            
            if (!tokenData) {
                console.log('No token data found');

                const feedbackToken = Buffer.from(JSON.stringify({
                    userId: userId,
                    email: userEmail,
                    name: userName,
                    sessionId: sessionId,
                    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
                })).toString('base64');

                response.cookies.set('feedback_auth', feedbackToken, {
                    httpOnly: true,
                    maxAge: 60 * 60 * 24, // 24 hours
                    path: '/',
                    sameSite: 'lax',
                    secure: process.env.NODE_ENV === 'production'
                });

                return response;
            } else {
                console.log('Token data existed');
                return response;
            }

        } catch (error) {
            console.error('Error verifying token:', error);
            return NextResponse.json(
                { error: 'Invalid or expired token' },
                { status: 401 }
            );
        }
    } else {
        return NextResponse.json({ 
            success: true, 
        });
    }
}