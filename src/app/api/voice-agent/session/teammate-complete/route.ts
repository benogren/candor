// src/app/api/voice-agent/session/teammate-complete/route.ts - Updated to store ElevenLabs conversation ID
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { voiceSessionId, recipientId, conversationId, transcript, duration } = await request.json();

    console.log('****** Received data:', {
      voiceSessionId,
      recipientId,
      conversationId,
      transcriptLength: transcript?.length || 0,
      duration: duration || 'not provided'
    });

    if (!voiceSessionId || !recipientId) {
      return NextResponse.json(
        { error: 'Voice session ID and recipient ID are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('Marking teammate complete:', {
      voiceSessionId,
      recipientId,
      conversationId: conversationId || 'not provided',
      transcriptLength: transcript?.length || 0,
      duration: duration || 'not provided'
    });

    // Update the voice session recipient with completion data
    const { error: updateError } = await supabase
      .from('voice_session_recipients')
      .update({
        discussed: true,
        completed_at: new Date().toISOString(),
        conversation_duration: duration || 180,
        transcript: transcript || null,
        elevenlabs_conversation_id: conversationId || null, // Store the ElevenLabs conversation ID
        updated_at: new Date().toISOString()
      })
      .eq('voice_session_id', voiceSessionId)
      .eq('recipient_id', recipientId);

    if (updateError) {
      console.error('Error updating voice session recipient:', updateError);
      return NextResponse.json(
        { error: 'Failed to update voice session recipient' },
        { status: 500 }
      );
    }

    console.log('Successfully stored completion data including ElevenLabs conversation ID:', conversationId);

    // Check if all recipients are complete
    const { data: allRecipients, error: recipientsError } = await supabase
      .from('voice_session_recipients')
      .select('discussed')
      .eq('voice_session_id', voiceSessionId);

    if (recipientsError) {
      console.error('Error checking recipients completion:', recipientsError);
      return NextResponse.json(
        { error: 'Failed to check session completion' },
        { status: 500 }
      );
    }

    const allComplete = allRecipients.every(r => r.discussed);

    return NextResponse.json({
      success: true,
      recipientCompleted: true,
      allRecipientsComplete: allComplete,
      conversationId: conversationId,
      storedData: {
        discussed: true,
        duration: duration || 180,
        transcriptLength: transcript?.length || 0,
        hasElevenLabsId: !!conversationId
      }
    });

  } catch (error) {
    console.error('Error in teammate-complete:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}