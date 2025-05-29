// src/app/api/notes/generate/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { marked } from 'marked';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Stage2Request {
  noteId: string;
  summary: string;
  userContext: {
    userName: string;
    jobTitle: string;
    company: string;
    industry: string;
  };
  feedbackCount: number;
  isManagerContent?: boolean;
  previousContext?: string; // For 1:1 prep continuity
}

interface Note {
  id: string;
  title: string;
  content_type: string;
  subject_member_id?: string;
  subject_invited_id?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Stage2Request;
    const { noteId, summary, userContext, feedbackCount } = body;

    console.log('=== Stage 2: Starting content generation ===');
    console.log('Note:', noteId, 'Content type: will be determined from DB');

    // Auth
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

    // Get note to determine content type
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .eq('creator_id', user.id)
      .single() as { data: Note | null, error: Error | null };

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const previousContext = '';

    let isManagerContent = false;
    // let managerId = '';
    // let recipientId = '';
    if (note.subject_invited_id != null || note.subject_member_id != null) {
      isManagerContent = true;
      // recipientId = note.subject_member_id || note.subject_invited_id || '';
      // managerId = user.id;
    }
    // Generate content with 30 second timeout
    const generationPromise = generateFinalContent(
      note.content_type,
      summary,
      userContext,
      feedbackCount,
      isManagerContent,
      previousContext
    );
    
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Content generation timeout')), 30000)
    );

    try {
      const content = await Promise.race([generationPromise, timeoutPromise]);
      
      // Convert to HTML
      const htmlContent = await marked.parse(content);
      
      // Update note
      const { data: updatedNote, error: updateError } = await supabase
        .from('notes')
        .update({
          content: htmlContent,
          is_generating: false,
          updated_at: new Date().toISOString(),
          metadata: {
            ...note.metadata,
            generated_at: new Date().toISOString(),
            feedback_count: feedbackCount,
            stage2_completed: true
          }
        })
        .eq('id', noteId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      console.log('=== Stage 2: Content generation complete ===');
      return NextResponse.json({
        success: true,
        note: updatedNote
      });

    } catch (genError) {
      console.error('Content generation failed:', genError);
      
      // Fallback to template content
      const fallbackContent = createFallbackContent(note.content_type, userContext, summary);
      const htmlContent = await marked.parse(fallbackContent);
      
      const { data: updatedNote } = await supabase
        .from('notes')
        .update({
          content: htmlContent,
          is_generating: false,
          updated_at: new Date().toISOString(),
          metadata: {
            ...note.metadata,
            generated_at: new Date().toISOString(),
            used_fallback: true,
            stage2_completed: true
          }
        })
        .eq('id', noteId)
        .select()
        .single();

      return NextResponse.json({
        success: true,
        note: updatedNote,
        usedFallback: true
      });
    }

  } catch (error) {
    console.error('Stage 2 error:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' }, 
      { status: 500 }
    );
  }
}

async function generateFinalContent(
  contentType: string,
  summary: string,
  userContext: { userName: string; jobTitle: string; company: string; industry: string },
  feedbackCount: number,
  isManagerContent: boolean,
  previousContext: string
): Promise<string> {
  
  console.log(`Generating ${contentType} content using AI...`);
  
  const prompt = createContentPrompt(
    contentType,
    summary,
    userContext,
    feedbackCount,
    isManagerContent,
    previousContext
  );

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      { 
        role: "system", 
        content: getSystemPrompt(contentType)
      },
      { role: "user", content: prompt }
    ],
    max_tokens: 1000,
    temperature: 0.4
  });

  return completion.choices[0]?.message?.content || 
         createFallbackContent(contentType, userContext, summary);
}

function createContentPrompt(
  contentType: string,
  summary: string,
  userContext: { userName: string; jobTitle: string; company: string; industry: string },
  feedbackCount: number,
  isManagerContent: boolean,
  previousContext: string
): string {
  
  const perspective = isManagerContent ? "This is being prepared for a manager about their employee" : "This is being prepared for an employee about themselves";
  const recipient = isManagerContent ? `${userContext.userName}'s manager` : userContext.userName;

  console.log(`Perspective: ${perspective}`);

  if (contentType === 'summary') {
    return `Create a comprehensive feedback summary for ${userContext.userName} (${userContext.jobTitle}) at ${userContext.company} based on this feedback analysis.
    
    FEEDBACK ANALYSIS:
    ${summary}
    
    Create a well-structured summary with these sections:
    ### Feedback Overview
    ### Quantitative Summary
    ### Qualitative Insights
    ### Key Patterns and Themes 
    ### Strengths
    ### Area for Improvement 
    ### Recommendations
    - Offer actionable steps they can take to improve
    - Highlight specific strengths to build on
    
    CONTEXT:
    Write this for ${recipient}.
    Context: ${perspective}. ${isManagerContent ? `Write this in the 3nd person` : `Write this in the 2nd person`}. 
    Be constructive, balanced, and growth-oriented. Include specific examples from the feedback analysis.`;

  } else if (contentType === 'prep') {
    return `
    Create a 1:1 meeting agenda for ${userContext.userName} (${userContext.jobTitle}) based on this feedback analysis.
    
    FEEDBACK ANALYSIS:
    ${summary}

    Create a focused agenda that builds on previous discussions and follows up on action items:

    ### 1:1 Agenda
    
    ${previousContext ? `PREVIOUS MEETING CONTEXT: ${previousContext}` : ''}

    #### Areas for Potential Growth or Improvement
    1. [Area 1]
      - [Question to ask ${isManagerContent ? 'your employee' : 'your manager'} about this area]
    2. [Area 2]
      - [Question to ask ${isManagerContent ? 'your employee' : 'your manager'} about this area]
    
    #### Challenges Identified in Feedback
    - [Challenge 1]
      - [Question to ask ${isManagerContent ? 'your employee' : 'your manager'} about this challenge]
    - [Challenge 2]
      - [Question to ask ${isManagerContent ? 'your employee' : 'your manager'} about this challenge]

    #### Professional Development Opportunities
    - [Opportunity 1]
      - [Question to ask ${isManagerContent ? 'your employee' : 'your manager'} about this opportunity]
    - [Opportunity 2]
      - [Question to ask ${isManagerContent ? 'your employee' : 'your manager'} about this opportunity]

    #### Other Questions to Ask ${isManagerContent ? 'Your Employee' : 'Your Manager'}
    1. ${isManagerContent ? `[Questions about employee motivation]` : '[Question 1]'}
    2. [Question 2]
    3. [Question 3]

    #### Action Items and Next Steps
    [leave space for action items and follow-ups]
    
    
    CONTEXT:
    This is for ${recipient}.
    Context: ${perspective}. ${isManagerContent ? ` ` : `Write this in the 1st person`}.
    Context: This is for a ${perspective}.
    Write actionable discussion points and specific questions.
    Do not include an Introduction, Summary, or Closing section.`;

  } else if (contentType === 'review') {
    return `
    Create ${isManagerContent ? 'a Performance review' : 'a Self-Evaluation'} for ${userContext.userName} based on this feedback analysis.
    
    FEEDBACK ANALYSIS:
    ${summary}

    Based on ${feedbackCount} feedback responses, create a comprehensive ${isManagerContent ? 'a performance review' : 'a self-evaluation'} structure with these sections:

    ${isManagerContent ? 
    `
    ### Executive Summary

    ### Detailed Assessment
    
    ### Feedback Analysis

    #### Notable Quotes

    #### Rating Highlights

    ### Recommendations

    ### Goals for Next Review Period

    ### Managerial Support

    ### Conclusion
    ` 
    : 
    `
    ### Executive Summary

    ### Accomplishments and Contributions

    ### Results

    ### Overall Imact

    ### What I Have Learned

    ### Obstacles

    ### Opportunities

    ### Goals

    ### Decisions

    ### Other Notes

    ---

    ### Questions and Discussion Points
    1. [Question 1]
    2. [Question 2]
    3. [Question 3]
    4. [Question 4]
    5. [Question 5]
    `
    }


    CONTEXT:
    This is for ${recipient}.
    Context: ${perspective}. ${isManagerContent ? `Write this in the 2nd person about the employee` : `Write this in the 1st person`}.
    Context: This is for a ${perspective}.
    Be comprehensive and development-focused.
    Include specific examples from the feedback analysis.
    `;
  }

  return `Create professional ${contentType} content for ${userContext.userName} based on the feedback analysis provided.`;
}

function getSystemPrompt(contentType: string): string {
  if (contentType === 'summary') {
    return "You are an experienced HR professional specializing in feedback analysis. Create balanced, constructive summaries that highlight both strengths and development opportunities.";
  } else if (contentType === 'prep') {
    return "You are an expert coach specializing in 1:1 meeting preparation. Create structured agendas that facilitate productive conversations and development.";
  } else if (contentType === 'review') {
    return "You are an experienced performance management specialist. Create comprehensive, fair reviews that support professional growth and development.";
  }
  
  return "You are a professional coach helping with career development and feedback analysis.";
}

function createFallbackContent(
  contentType: string,
  userContext: { userName: string; jobTitle: string; company: string },
  summary: string
): string {

  if (contentType === 'summary') {
    return `# Feedback Summary

## Overview
This summary is based on recent feedback for ${userContext.userName} (${userContext.jobTitle}) at ${userContext.company}.

## Key Insights
${summary.substring(0, 500)}...

## Areas of Focus
- Continue building on demonstrated strengths
- Address development opportunities identified in feedback
- Maintain strong professional relationships and communication

## Next Steps
- Review detailed feedback with manager or team
- Create specific development goals
- Schedule regular check-ins for progress tracking`;

  } else if (contentType === 'prep') {
    return `# 1:1 Meeting Agenda

## Discussion Topics
Based on recent feedback analysis for ${userContext.userName}:

## Feedback Highlights
${summary.substring(0, 300)}...

## Questions to Explore
1. What aspects of recent feedback resonate most?
2. Which areas would you like to focus on developing?
3. What support or resources would be most helpful?

## Action Planning
- Identify specific development goals
- Discuss resource needs and support
- Plan follow-up conversations and check-ins`;

  } else if (contentType === 'review') {
    return `# Performance Review Notes

## Summary
Review preparation for ${userContext.userName} (${userContext.jobTitle}) based on feedback analysis.

## Key Feedback Themes
${summary.substring(0, 400)}...

## Performance Highlights
- Review accomplishments and contributions
- Acknowledge strengths identified in feedback
- Discuss impact on team and organizational goals

## Development Focus
- Address growth areas from feedback
- Set specific development objectives
- Plan learning and improvement activities`;
  }

  return `# ${contentType.charAt(0).toUpperCase() + contentType.slice(1)} Content

Generated content for ${userContext.userName} based on feedback analysis.

${summary}`;
}