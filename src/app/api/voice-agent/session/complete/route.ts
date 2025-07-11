// src/app/api/voice-agent/session/complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { voiceSessionId, feedbackSessionId } = await req.json();

    if (!voiceSessionId || !feedbackSessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: voiceSessionId, feedbackSessionId' },
        { status: 400 }
      );
    }

    // Get all completed teammate transcripts
    const { data: teammateRecords, error: teammateError } = await supabase
      .from('voice_session_recipients')
      .select('recipient_id, transcript, conversation_duration, completed_at')
      .eq('voice_session_id', voiceSessionId)
      .eq('discussed', true);

    if (teammateError) throw teammateError;

    // Combine all transcripts for processing
    const combinedTranscript = teammateRecords?.map(record => 
      `=== Feedback for Recipient ${record.recipient_id} ===\n` +
      `Duration: ${record.conversation_duration || 180} seconds\n` +
      `Completed: ${record.completed_at}\n` +
      `Transcript:\n${record.transcript}\n\n`
    ).join('') || '';

    // Update voice session with final status and combined transcript
    const { error: updateError } = await supabase
      .from('voice_feedback_sessions')
      .update({
        status: 'processing',
        combined_transcript: combinedTranscript,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', voiceSessionId);

    if (updateError) throw updateError;

    // Update the main feedback session status
    const { error: feedbackSessionError } = await supabase
      .from('feedback_sessions')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', feedbackSessionId);

    if (feedbackSessionError) throw feedbackSessionError;

    return NextResponse.json({
      success: true,
      message: 'Voice session completed successfully',
      teammatesCompleted: teammateRecords?.length || 0,
      readyForProcessing: true
    });

  } catch (error) {
    console.error('Error completing voice session:', error);
    return NextResponse.json(
      { 
        error: 'Failed to complete voice session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}