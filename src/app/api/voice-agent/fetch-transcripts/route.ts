// src/app/api/voice-agent/fetch-transcripts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // Moved to top-level import

// Define the expected structure of transcript items
interface TranscriptItem {
  role?: string;
  content?: string;
  speaker?: string;
  text?: string;
  message?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { voiceSessionId } = await request.json();

    if (!voiceSessionId) {
      return NextResponse.json(
        { error: 'Voice session ID is required' },
        { status: 400 }
      );
    }

    // Fetch voice session and recipients from database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get voice session recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from('voice_session_recipients')
      .select(`
        *,
        feedback_user_identities(name, email)
      `)
      .eq('voice_session_id', voiceSessionId);

    if (recipientsError) {
      console.error('Error fetching recipients:', recipientsError);
      return NextResponse.json(
        { error: 'Failed to fetch voice session data' },
        { status: 500 }
      );
    }

    // For each recipient, fetch transcript from ElevenLabs
    const transcriptResults = [];
    
    for (const recipient of recipients) {
      let transcript = '';
      let transcriptSource = 'none';
      let elevenLabsError = null;
      
      // Always try to fetch from ElevenLabs if we have a conversation ID
      if (recipient.elevenlabs_conversation_id && process.env.ELEVENLABS_API_KEY) {
        try {
          console.log(`Fetching transcript from ElevenLabs for conversation ${recipient.elevenlabs_conversation_id}`);
          
          const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${recipient.elevenlabs_conversation_id}`,
            {
              headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY!,
              },
            }
          );
          
          if (response.ok) {
            const conversationData = await response.json();
            console.log(`ElevenLabs response status: ${conversationData.status}`);
            
            // Extract transcript from conversation data
            if (conversationData.transcript && Array.isArray(conversationData.transcript)) {
              // Convert transcript array to readable format
              transcript = conversationData.transcript
                .map((item: TranscriptItem) => {
                  // Handle different possible transcript structures
                  if (typeof item === 'string') {
                    return item;
                  } else if (item.role && item.content) {
                    return `${item.role}: ${item.content}`;
                  } else if (item.speaker && item.text) {
                    return `${item.speaker}: ${item.text}`;
                  } else if (item.message) {
                    return item.message;
                  } else {
                    // Fallback: stringify the item
                    return JSON.stringify(item);
                  }
                })
                .join('\n');
              
              transcriptSource = 'elevenlabs';
              
              // Update database with fresh transcript
              const { error: updateError } = await supabase
                .from('voice_session_recipients')
                .update({ 
                  transcript: transcript,
                  transcript_fetched_at: new Date().toISOString()
                })
                .eq('id', recipient.id);
              
              if (updateError) {
                console.warn(`Failed to update transcript in database for recipient ${recipient.id}:`, updateError);
              }
            } else if (conversationData.status === 'processing' || conversationData.status === 'in-progress') {
              transcriptSource = 'processing';
              transcript = 'Conversation is still being processed by ElevenLabs';
            } else {
              transcriptSource = 'empty';
              transcript = 'No transcript available in ElevenLabs conversation data';
              console.warn(`No transcript found in ElevenLabs response for conversation ${recipient.elevenlabs_conversation_id}`);
            }
          } else {
            const errorText = await response.text();
            elevenLabsError = `HTTP ${response.status}: ${errorText}`;
            console.error(`ElevenLabs API error for conversation ${recipient.elevenlabs_conversation_id}: ${elevenLabsError}`);
            
            // Fallback to database transcript if ElevenLabs fails
            if (recipient.transcript && recipient.transcript.length > 0) {
              transcript = recipient.transcript;
              transcriptSource = 'database_fallback';
            }
          }
        } catch (error) {
          elevenLabsError = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed to fetch transcript from ElevenLabs for recipient ${recipient.id}:`, error);
          
          // Fallback to database transcript if ElevenLabs fails
          if (recipient.transcript && recipient.transcript.length > 0) {
            transcript = recipient.transcript;
            transcriptSource = 'database_fallback';
          }
        }
      } else {
        // No ElevenLabs conversation ID - check database
        if (recipient.transcript && recipient.transcript.length > 0) {
          transcript = recipient.transcript;
          transcriptSource = 'database_only';
        } else {
          transcriptSource = 'missing_conversation_id';
          transcript = 'No ElevenLabs conversation ID available';
        }
      }

      transcriptResults.push({
        recipientId: recipient.id,
        recipientName: recipient.feedback_user_identities?.name || 'Unknown',
        recipientEmail: recipient.feedback_user_identities?.email || '',
        transcript: transcript,
        hasTranscript: transcript.length > 0 && !transcript.startsWith('No transcript') && !transcript.startsWith('Conversation is still'),
        transcriptSource: transcriptSource,
        elevenLabsConversationId: recipient.elevenlabs_conversation_id || null,
        elevenLabsError: elevenLabsError,
        conversationDuration: recipient.conversation_duration || 0,
        completedAt: recipient.completed_at,
        discussed: recipient.discussed || false,
        lastTranscriptFetch: new Date().toISOString()
      });
    }

    const stats = {
      totalRecipients: transcriptResults.length,
      successfulTranscripts: transcriptResults.filter(t => t.hasTranscript).length,
      fromElevenLabs: transcriptResults.filter(t => t.transcriptSource === 'elevenlabs').length,
      fromDatabaseFallback: transcriptResults.filter(t => t.transcriptSource === 'database_fallback').length,
      fromDatabaseOnly: transcriptResults.filter(t => t.transcriptSource === 'database_only').length,
      processing: transcriptResults.filter(t => t.transcriptSource === 'processing').length,
      missingConversationId: transcriptResults.filter(t => t.transcriptSource === 'missing_conversation_id').length,
      elevenLabsErrors: transcriptResults.filter(t => t.elevenLabsError).length,
      missingTranscripts: transcriptResults.filter(t => !t.hasTranscript).length
    };

    return NextResponse.json({
      voiceSessionId,
      transcripts: transcriptResults,
      stats: stats,
      fetchedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in fetch-transcripts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}