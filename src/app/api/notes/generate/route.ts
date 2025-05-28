// src/app/api/notes/generate/route.ts
import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { marked } from 'marked';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Much shorter timeout - 30 seconds max
const REQUEST_TIMEOUT = 30000;

interface Note {
  id: string;
  title: string;
  content: string;
  content_type: string;
  creator_id: string;
  subject_member_id?: string;
  subject_invited_id?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  is_generating?: boolean;
}

// Main handler function
export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { id } = body;

    console.log('=== STARTING SIMPLE GENERATION ===', id);

    if (!id) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    // Create Supabase client
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bearerToken = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get note
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .eq('creator_id', user.id)
      .single() as { data: Note | null, error: Error | null };

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    console.log('Note found:', note.content_type, 'generating:', note.is_generating);

    try {
      // Race against timeout
      const generationPromise = generateContentFast(supabase, note, user.id);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), REQUEST_TIMEOUT)
      );

      const content = await Promise.race([generationPromise, timeoutPromise]);
      
      // Convert to HTML
      const htmlContent = await marked.parse(content);
      
      // Update database
      const { data: updatedNote, error: updateError } = await supabase
        .from('notes')
        .update({
          content: htmlContent,
          is_generating: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      const duration = Date.now() - startTime;
      console.log(`=== GENERATION COMPLETE === ${duration}ms`);
      
      return NextResponse.json({ note: updatedNote }, { status: 200 });

    } catch (error) {
      console.error('Generation failed:', error);
      
      // ALWAYS update database to stop loading state
      const fallbackContent = createFallbackContent(note);
      const htmlContent = await marked.parse(fallbackContent);
      
      const { data: updatedNote } = await supabase
        .from('notes')
        .update({
          content: htmlContent,
          is_generating: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      const duration = Date.now() - startTime;
      console.log(`=== FALLBACK COMPLETE === ${duration}ms`);
      
      return NextResponse.json({ note: updatedNote }, { status: 200 });
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}

// Fast, simple content generation
async function generateContentFast(supabase: SupabaseClient, note: Note, userId: string): Promise<string> {
  console.log('Starting fast generation...');
  
  try {
    // Get basic user info
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('name, job_title')
      .eq('id', userId)
      .single();

    const userName = userProfile?.name || 'User';
    const jobTitle = userProfile?.job_title || 'Team Member';

    // Get recent feedback (limit to 10 items for speed)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentFeedback } = await supabase
      .from('feedback_responses')
      .select(`
        text_response,
        comment_text,
        rating_value,
        feedback_questions(question_text, question_type)
      `)
      .eq('recipient_id', userId)
      .eq('skipped', false)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .limit(10);

    console.log(`Found ${recentFeedback?.length || 0} recent feedback items`);

    // Create simple prompt
    const feedbackSummary = (recentFeedback || [])
      .filter(item => item.text_response || item.comment_text)
      .slice(0, 5)
      .map(item => `- ${item.text_response || item.comment_text}`)
      .join('\n');

    const hasRealFeedback = feedbackSummary.length > 20;
    
    if (!hasRealFeedback) {
      console.log('No meaningful feedback found, using template');
      return createTemplateContent(note, userName, jobTitle);
    }

    const prompt = createSimplePrompt(note.content_type, userName, jobTitle, feedbackSummary);
    
    console.log('Calling OpenAI with 20-second timeout...');
    
    // Single OpenAI call with aggressive timeout
    const openaiPromise = openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Faster model
      messages: [
        { role: "system", content: "You are a concise professional coach. Create clear, actionable content in markdown format." },
        { role: "user", content: prompt }
      ],
      max_tokens: 600, // Shorter content
      temperature: 0.3,
      stream: false
    });

    const openaiTimeout = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI timeout')), 20000)
    );

    const completion = await Promise.race([openaiPromise, openaiTimeout]);
    const content = completion.choices[0]?.message?.content;
    
    console.log('OpenAI completed successfully');
    return content || createTemplateContent(note, userName, jobTitle);

  } catch (error) {
    console.error('Fast generation failed:', error);
    // Always return template content on failure
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('name, job_title')
      .eq('id', userId)
      .single();

    return createTemplateContent(note, userProfile?.name || 'User', userProfile?.job_title || 'Team Member');
  }
}

// Create simple, focused prompts
function createSimplePrompt(contentType: string, userName: string, jobTitle: string, feedbackSummary: string): string {
  if (contentType === 'summary') {
    return `Create a concise feedback summary for ${userName} (${jobTitle}) based on this recent feedback:

${feedbackSummary}

Format as markdown with these sections:
## Key Strengths
## Areas for Growth  
## Recommendations

Keep it under 300 words, focus on actionable insights.`;
  
  } else if (contentType === 'prep') {
    return `Create a 1:1 meeting agenda for ${userName} (${jobTitle}) based on this feedback:

${feedbackSummary}

Format as markdown with these sections:
## Discussion Topics
## Questions to Ask
## Development Focus

Keep it under 300 words, focus on specific talking points.`;
  
  } else if (contentType === 'review') {
    return `Create self-evaluation notes for ${userName} (${jobTitle}) based on this feedback:

${feedbackSummary}

Format as markdown with these sections:
## Accomplishments
## Challenges & Learning
## Goals for Next Period

Keep it under 300 words, focus on reflection and growth.`;
  }

  return `Create professional ${contentType} content for ${userName}.`;
}

// Template content when no feedback or OpenAI fails
function createTemplateContent(note: Note, userName: string, jobTitle: string): string {
  if (note.content_type === 'summary') {
    return `# Feedback Summary

## Overview
This summary has been generated for ${userName} (${jobTitle}). 

## Key Areas to Explore
- Recent project contributions and achievements
- Collaboration and communication strengths
- Professional development opportunities
- Areas where additional support might be helpful

## Next Steps
- Gather more specific feedback from colleagues
- Schedule regular check-ins for ongoing development
- Set clear goals for the upcoming period

*This template can be customized based on specific feedback and observations.*`;

  } else if (note.content_type === 'prep') {
    return `# 1:1 Meeting Agenda

## Current Projects & Priorities
- Review progress on key initiatives
- Discuss any blockers or challenges
- Align on upcoming deadlines and deliverables

## Professional Development
- Explore learning opportunities and interests
- Discuss career goals and growth areas
- Identify skills to develop or strengthen

## Team & Collaboration
- Share feedback on team dynamics
- Discuss communication preferences
- Address any process improvements

## Questions for Discussion
1. What's going well in your current work?
2. Where do you need more support or resources?
3. What would you like to focus on developing?

*Customize this agenda based on recent feedback and current priorities.*`;

  } else if (note.content_type === 'review') {
    return `# Self-Evaluation Notes

## Key Accomplishments
- Major projects completed this period
- Notable contributions to team goals
- Skills developed or strengthened
- Positive feedback received

## Challenges & Learning
- Obstacles encountered and how they were addressed
- Areas where growth occurred through difficulty
- Lessons learned from setbacks or mistakes
- Support that was helpful during challenging times

## Goals for Next Period
- Specific skills to develop or improve
- Projects or responsibilities to take on
- Relationships to build or strengthen
- Ways to contribute more effectively to team success

## Support Needed
- Resources or training that would be helpful
- Areas where mentorship or guidance is desired
- Process improvements that could increase effectiveness

*Use this framework to prepare thoughtful self-reflection for your review discussion.*`;
  }

  return `# ${note.content_type.charAt(0).toUpperCase() + note.content_type.slice(1)}

Professional content for ${userName} (${jobTitle}).

This content has been generated as a starting template. Please customize based on your specific needs and recent feedback.`;
}

// Fallback content for complete failures
function createFallbackContent(note: Note): string {
  return `# ${note.title}

This content is being generated. Please refresh the page in a few moments to see your completed ${note.content_type}.

If this message persists, there may be a temporary issue with content generation. Please try creating a new ${note.content_type} or contact support.`;
}