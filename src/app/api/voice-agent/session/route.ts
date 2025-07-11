// src/app/api/voice-agent/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CreateVoiceSessionRequest {
  feedbackSessionId: string;
  teammates: Array<{
    id: string;
    name: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse request body
    const requestData: CreateVoiceSessionRequest = await request.json();
    const { feedbackSessionId, teammates } = requestData;
    
    if (!feedbackSessionId || !teammates || teammates.length === 0) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        details: 'feedbackSessionId and teammates are required'
      }, { status: 400 });
    }

    // Verify the feedback session exists and belongs to the user
    const { data: feedbackSession, error: sessionError } = await supabase
      .from('feedback_sessions')
      .select('id, provider_id, status')
      .eq('id', feedbackSessionId)
      .single();

    if (sessionError || !feedbackSession) {
      return NextResponse.json({ 
        error: 'Feedback session not found' 
      }, { status: 404 });
    }

    // Verify user is the provider of this session
    const { data: providerData, error: providerError } = await supabase
      .from('company_members')
      .select('id')
      .eq('id', feedbackSession.provider_id)
      .eq('id', user.id)
      .single();

    if (providerError || !providerData) {
      return NextResponse.json({ 
        error: 'Unauthorized to access this session' 
      }, { status: 403 });
    }

    // Check if voice session already exists
    const { data: existingVoiceSession, error: existingError } = await supabase
      .from('voice_feedback_sessions')
      .select('*')
      .eq('feedback_session_id', feedbackSessionId)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError;
    }

    let voiceSession;

    if (existingVoiceSession) {
      // Update existing session status if needed
      if (existingVoiceSession.status === 'failed') {
        const { data: updatedSession, error: updateError } = await supabase
          .from('voice_feedback_sessions')
          .update({ 
            status: 'initializing',
            error_message: null
          })
          .eq('id', existingVoiceSession.id)
          .select()
          .single();

        if (updateError) throw updateError;
        voiceSession = updatedSession;
      } else {
        voiceSession = existingVoiceSession;
      }
    } else {
      // Create new voice session
      const { data: newVoiceSession, error: createError } = await supabase
        .from('voice_feedback_sessions')
        .insert({
          feedback_session_id: feedbackSessionId,
          status: 'initializing'
        })
        .select()
        .single();

      if (createError) throw createError;
      voiceSession = newVoiceSession;
    }

    // Get existing voice session recipients
    const { data: existingRecipients, error: recipientsError } = await supabase
      .from('voice_session_recipients')
      .select('recipient_id')
      .eq('voice_session_id', voiceSession.id);

    if (recipientsError) throw recipientsError;

    const existingRecipientIds = new Set(
      (existingRecipients || []).map(r => r.recipient_id)
    );

    // Create voice session recipients for new teammates
    const newRecipients = teammates
      .filter(teammate => !existingRecipientIds.has(teammate.id))
      .map(teammate => ({
        voice_session_id: voiceSession.id,
        recipient_id: teammate.id,
        discussed: false
      }));

    if (newRecipients.length > 0) {
      const { error: insertRecipientsError } = await supabase
        .from('voice_session_recipients')
        .insert(newRecipients);

      if (insertRecipientsError) throw insertRecipientsError;
    }

    // Update voice session status to ready
    const { data: readySession, error: readyError } = await supabase
      .from('voice_feedback_sessions')
      .update({ status: 'in_progress' })
      .eq('id', voiceSession.id)
      .select()
      .single();

    if (readyError) throw readyError;

    return NextResponse.json({
      voiceSession: readySession,
      message: 'Voice session created successfully'
    });

  } catch (error) {
    console.error('Error creating voice session:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create voice session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve existing voice session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feedbackSessionId = searchParams.get('feedbackSessionId');
    
    if (!feedbackSessionId) {
      return NextResponse.json({ 
        error: 'Missing feedbackSessionId parameter' 
      }, { status: 400 });
    }

    // Get auth header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get voice session
    const { data: voiceSession, error: sessionError } = await supabase
      .from('voice_feedback_sessions')
      .select(`
        *,
        voice_session_recipients(
          recipient_id,
          discussed,
          discussion_start_time,
          discussion_end_time
        )
      `)
      .eq('feedback_session_id', feedbackSessionId)
      .single();

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json({ 
          voiceSession: null,
          message: 'No voice session found'
        });
      }
      throw sessionError;
    }

    return NextResponse.json({
      voiceSession,
      message: 'Voice session retrieved successfully'
    });

  } catch (error) {
    console.error('Error retrieving voice session:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve voice session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}