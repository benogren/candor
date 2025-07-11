// src/app/api/voice-agent/save-responses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Define types based on your table structures
type FeedbackRecipient = {
  id: string; // UUID from feedback_recipients table
  recipient_id: string; // The actual user ID
  recipient_name?: string;
  session_id: string;
  status?: string;
};

type VoiceSessionRecipient = {
  id: string; // UUID from voice_session_recipients table  
  recipient_id: string; // The actual user ID (same as in feedback_recipients)
  session_id: string;
};

export async function POST(request: NextRequest) {
  try {
    const { sessionId, voiceSessionId, responses } = await request.json();

    console.log('****** Received data:', {
      sessionId,
      voiceSessionId,
      responsesCount: responses?.length || 0
    });

    if (!sessionId || !responses) {
      return NextResponse.json(
        { error: 'Session ID and responses are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get feedback recipients for this session
    const { data: feedbackRecipients, error: feedbackRecipientsError } = await supabase
      .from('feedback_recipients')
      .select('*')
      .eq('session_id', sessionId);

    if (feedbackRecipientsError) {
      console.error('Error fetching feedback recipients:', feedbackRecipientsError);
      return NextResponse.json(
        { error: 'Failed to fetch feedback recipients' },
        { status: 500 }
      );
    }

    // Get voice session recipients to map the IDs
    const { data: voiceRecipients, error: voiceRecipientsError } = await supabase
      .from('voice_session_recipients')
      .select('*')
      .eq('voice_session_id', voiceSessionId);

    if (voiceRecipientsError) {
      console.error('Error fetching voice recipients:', voiceRecipientsError);
      return NextResponse.json(
        { error: 'Failed to fetch voice recipients' },
        { status: 500 }
      );
    }

    console.log(`Feedback recipients: ${feedbackRecipients?.length || 0}`);
    console.log(`Voice recipients: ${voiceRecipients?.length || 0}`);

    console.log('Processing voice responses and creating new questions...');

    // Create new questions and save responses
    const responsesToSave = [];
    let questionsCreated = 0;
    
    for (const recipientResponse of responses) {
      // Find the voice recipient record first
      const voiceRecipient: VoiceSessionRecipient | undefined = voiceRecipients?.find((r: VoiceSessionRecipient) => 
        r.id === recipientResponse.recipientId
      );
      
      if (!voiceRecipient) {
        console.warn(`Voice recipient not found for ID: ${recipientResponse.recipientId}`);
        continue;
      }

      // Now find the corresponding feedback recipient using the actual user ID
      const feedbackRecipient: FeedbackRecipient | undefined = feedbackRecipients?.find((r: FeedbackRecipient) => 
        r.recipient_id === voiceRecipient.recipient_id
      );
      
      if (!feedbackRecipient) {
        console.warn(`Feedback recipient not found for user ID: ${voiceRecipient.recipient_id}`);
        continue;
      }

      console.log(`Mapping voice recipient ${recipientResponse.recipientId} -> user ${voiceRecipient.recipient_id} -> feedback recipient ${feedbackRecipient.id}`);

      for (const response of recipientResponse.responses) {
        try {
          // Create a new question in the database for each response
          const { data: newQuestion, error: questionError } = await supabase
            .from('feedback_questions')
            .insert({
              company_id: null, // Global scope
              question_text: response.questionText,
              question_type: response.questionType,
              scope: 'global',
              active: true,
              question_subtype: 'voice',
              is_admin_manageable: false,
              question_description: `Auto-generated from voice conversation about ${recipientResponse.recipientName}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (questionError) {
            console.error('Error creating question:', questionError);
            console.error('Question data:', response.questionText);
            continue; // Skip this response if question creation fails
          }

          console.log('Created new voice question:', newQuestion.id, '-', response.questionText);
          questionsCreated++;

          // Now save the response using the feedback recipient ID (not voice recipient ID)
          responsesToSave.push({
            recipient_id: feedbackRecipient.id, // Use the feedback_recipients.id
            session_id: sessionId,
            question_id: newQuestion.id,
            rating_value: response.ratingValue || null,
            text_response: response.textResponse || null,
            has_comment: response.hasComment || false,
            comment_text: response.commentText || null,
            skipped: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        } catch (error) {
          console.error('Error creating question for response:', error);
          console.error('Response data:', response);
          continue; // Skip this response and continue with others
        }
      }
    }

    console.log(`Created ${questionsCreated} new voice questions`);
    console.log(`Preparing to save ${responsesToSave.length} responses`);

    // Mark any existing feedback responses for this session as skipped
    // This handles the case where a user started the traditional survey but then used the AI agent
    console.log('Checking for existing feedback responses to mark as skipped...');
    
    const { data: existingResponses, error: existingResponsesError } = await supabase
      .from('feedback_responses')
      .select('id')
      .eq('session_id', sessionId)
      .eq('skipped', false);

    if (existingResponsesError) {
      console.error('Error fetching existing responses:', existingResponsesError);
      return NextResponse.json(
        { error: 'Failed to fetch existing responses' },
        { status: 500 }
      );
    }

    if (existingResponses && existingResponses.length > 0) {
      console.log(`Found ${existingResponses.length} existing responses to mark as skipped`);
      
      const { error: updateExistingError } = await supabase
        .from('feedback_responses')
        .update({ 
          skipped: true,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('skipped', false);

      if (updateExistingError) {
        console.error('Error updating existing responses to skipped:', updateExistingError);
        return NextResponse.json(
          { error: 'Failed to update existing responses' },
          { status: 500 }
        );
      }

      console.log(`Successfully marked ${existingResponses.length} existing responses as skipped`);
    } else {
      console.log('No existing responses found to mark as skipped');
    }

    // Save all responses
    if (responsesToSave.length > 0) {
      const { error: saveError } = await supabase
        .from('feedback_responses')
        .insert(responsesToSave);

      if (saveError) {
        console.error('Error saving responses:', saveError);
        return NextResponse.json(
          { error: 'Failed to save responses' },
          { status: 500 }
        );
      }

      console.log('Successfully saved', responsesToSave.length, 'voice responses');
    }

    // Update feedback recipients status to completed
    const feedbackRecipientIds: string[] = feedbackRecipients?.map((r: FeedbackRecipient) => r.id) || [];
    if (feedbackRecipientIds.length > 0) {
      const { error: updateRecipientsError } = await supabase
        .from('feedback_recipients')
        .update({ status: 'completed' })
        .in('id', feedbackRecipientIds);

      if (updateRecipientsError) {
        console.warn('Error updating feedback recipient status:', updateRecipientsError);
      }
    }

    // Update feedback session status to completed
    const { error: updateSessionError } = await supabase
      .from('feedback_sessions')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateSessionError) {
      console.warn('Error updating session status:', updateSessionError);
    }

    // Update voice session status to completed
    if (voiceSessionId) {
      const { error: updateVoiceSessionError } = await supabase
        .from('voice_feedback_sessions')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', voiceSessionId);

      if (updateVoiceSessionError) {
        console.warn('Error updating voice session status:', updateVoiceSessionError);
      }
    }

    return NextResponse.json({
      success: true,
      questionsCreated: questionsCreated,
      responsesCount: responsesToSave.length,
      sessionId,
      status: 'completed'
    });

  } catch (error) {
    console.error('Error in save-responses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}