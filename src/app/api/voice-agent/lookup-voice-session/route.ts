// src/app/api/voice-agent/lookup-voice-session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // Added top-level import

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Look up the voice session using the regular feedback session ID
    const { data: voiceSession, error: voiceSessionError } = await supabase
      .from('voice_feedback_sessions')
      .select('*')
      .eq('feedback_session_id', sessionId)
      .single();

    if (voiceSessionError) {
      console.error('Error finding voice session:', voiceSessionError);
      return NextResponse.json(
        { error: 'Voice session not found for this feedback session' },
        { status: 404 }
      );
    }

    if (!voiceSession) {
      return NextResponse.json(
        { error: 'No voice session found for this feedback session' },
        { status: 404 }
      );
    }

    // Also fetch basic session info for context
    const { data: feedbackSession, error: sessionError } = await supabase
      .from('feedback_sessions')
      .select(`
        *,
        feedback_cycles(
          company_id,
          companies(name, industry)
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.warn('Could not fetch feedback session details:', sessionError);
    }

    return NextResponse.json({
      voiceSessionId: voiceSession.id,
      voiceSessionStatus: voiceSession.status,
      sessionId: sessionId,
      feedbackSession: feedbackSession || null,
      found: true
    });
  } catch (error) {
    console.error('Error in lookup-voice-session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}