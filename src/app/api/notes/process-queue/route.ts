// app/api/notes/process-queue/route.ts
// Simple queue processor that can run via cron or manual trigger

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerationJob {
  id: string;
  note_id: string;
  user_id: string;
  token: string;
  status: string;
  status_message?: string;
  retry_count: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface Note {
  id: string;
  title: string;
  content_type: string;
  creator_id: string;
  subject_member_id?: string;
  subject_invited_id?: string;
  metadata?: Record<string, unknown>;
  is_generating: boolean;
}

interface FeedbackResponse {
  rating_value?: number;
  text_response?: string;
  comment_text?: string;
  created_at: string;
  feedback_questions?: {
    question_text: string;
    question_type: string;
  } | null;
}

// This endpoint processes the queue - can be called by cron or manually
export async function POST() {
  try {
    // Get next job from queue
    const { data: jobs } = await supabase
      .from('generation_queue')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ message: 'No jobs in queue' });
    }

    const job = jobs[0] as GenerationJob;
    
    // Mark as processing
    await supabase
      .from('generation_queue')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString(),
        status_message: 'Processing started'
      })
      .eq('id', job.id);

    // Emit status update
    await emitStatusUpdate(job.note_id, 'processing', 'Fetching feedback data...');

    try {
      // Get note details
      const { data: note, error: noteError } = await supabase
        .from('notes')
        .select('*')
        .eq('id', job.note_id)
        .single();

      if (noteError || !note) {
        throw new Error('Note not found');
      }

      const noteData = note as Note;

      // Quick feedback fetch (last 30 days only)
      await emitStatusUpdate(job.note_id, 'processing', 'Analyzing feedback...');
      
      const feedbackData = await fetchRecentFeedback(job.user_id);
      
      // Generate content
      await emitStatusUpdate(job.note_id, 'processing', 'Generating content...');
      
      const content = await generateQuickContent(noteData, feedbackData);
      
      // Update note
      const { error: updateError } = await supabase
        .from('notes')
        .update({
          content: content,
          is_generating: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.note_id);

      if (updateError) {
        throw new Error(`Failed to update note: ${updateError.message}`);
      }

      // Mark job as completed
      await supabase
        .from('generation_queue')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          status_message: 'Generation completed successfully'
        })
        .eq('id', job.id);

      await emitStatusUpdate(job.note_id, 'completed', 'Content generation completed!');

      return NextResponse.json({ 
        success: true, 
        noteId: job.note_id,
        message: 'Content generated successfully'
      });

    } catch (generationError) {
      console.error('Generation error:', generationError);
      
      const errorMessage = generationError instanceof Error 
        ? generationError.message 
        : 'Unknown error occurred';
      
      // Mark job as failed
      await supabase
        .from('generation_queue')
        .update({ 
          status: 'failed',
          status_message: errorMessage,
          retry_count: job.retry_count + 1
        })
        .eq('id', job.id);

      await emitStatusUpdate(job.note_id, 'failed', 'Generation failed. Please try again.');

      // Reset note generating status
      await supabase
        .from('notes')
        .update({ is_generating: false })
        .eq('id', job.note_id);

      return NextResponse.json(
        { error: errorMessage, noteId: job.note_id }, 
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Queue processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Queue processing failed';
    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
}

// Simplified feedback fetching
async function fetchRecentFeedback(userId: string): Promise<FeedbackResponse[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('feedback_responses')
    .select(`
      rating_value,
      text_response,
      comment_text,
      created_at,
      feedback_questions!inner(question_text, question_type)
    `)
    .eq('recipient_id', userId)
    .eq('skipped', false)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(30); // Limit to 30 most recent items

  if (error) {
    console.error('Error fetching feedback:', error);
    return [];
  }

  // Transform the data to handle the joined relationship properly
  const transformedData = (data || []).map(item => ({
    ...item,
    feedback_questions: Array.isArray(item.feedback_questions) 
      ? item.feedback_questions[0] || null
      : item.feedback_questions
  }));

  return transformedData as FeedbackResponse[];
}

// Simplified content generation
async function generateQuickContent(note: Note, feedback: FeedbackResponse[]): Promise<string> {
  const feedbackSummary = feedback.length > 0 
    ? `Recent feedback (${feedback.length} responses): ${feedback.slice(0, 3).map(f => f.text_response || f.comment_text).filter(Boolean).join('. ')}`
    : 'No recent feedback available';

  const prompt = `
Create a professional ${note.content_type} for ${note.title}.

${feedbackSummary}

Requirements:
- Use clear, professional tone
- Include actionable sections
- Keep it concise but comprehensive
- Format as well-structured markdown

Content type: ${note.content_type}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Faster and cheaper
      messages: [
        { role: "system", content: "You are a professional feedback analyst. Create clear, actionable content." },
        { role: "user", content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.3
    });

    return completion.choices[0]?.message?.content || generateFallbackContent(note);
  } catch (openaiError) {
    console.error('OpenAI error:', openaiError);
    return generateFallbackContent(note);
  }
}

// Simple fallback content
function generateFallbackContent(note: Note): string {
  return `
# ${note.content_type === 'summary' ? 'Feedback Summary' : 
     note.content_type === 'prep' ? '1:1 Meeting Agenda' : 
     'Performance Review'}

## Overview
This ${note.content_type} has been generated automatically. Please customize as needed.

## Key Discussion Points
1. Current projects and priorities
2. Professional development opportunities  
3. Challenges and support needed
4. Goals for next period

## Action Items
- [ ] Review and discuss feedback
- [ ] Set specific goals
- [ ] Schedule follow-up

---
*Generated automatically - please review and customize*
`;
}

// Emit real-time status updates
async function emitStatusUpdate(noteId: string, status: string, message: string): Promise<void> {
  try {
    await supabase
      .from('generation_status')
      .insert({
        job_id: noteId,
        status: status,
        message: message,
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to emit status update:', error);
    // Don't throw - status updates are nice to have but not critical
  }
}