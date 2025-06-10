// /api/notes/generate/prep/route.ts
import { NextResponse } from 'next/server';
import { marked } from 'marked';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface UserContext {
  userName: string;
  jobTitle: string;
  company: string;
  industry: string;
}

interface PrepRequest {
  summary: string;
  userContext: {
    userName: string;
    jobTitle: string;
    company: string;
    industry: string;
  };
  feedbackCount: number;
  previousContext?: string;
}

export async function POST(request: Request) {
  try {
    const { summary, userContext, feedbackCount, previousContext = '' } = await request.json() as PrepRequest;

    console.log(`=== Generating Self 1:1 Prep Content (${feedbackCount}) ===`);
    console.log('Previous context length:', previousContext.length);

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { 
          role: "system", 
          content: "You are an expert coach helping employees prepare for 1:1 meetings with their manager. Create structured agendas that facilitate productive self-advocacy, development conversations, and build on previous discussions to show progress and continuity."
        },
        { 
          role: "user", 
          content: `Create a 1:1 meeting agenda and preparation for ${userContext.userName} (${userContext.jobTitle}) based on this feedback analysis and previous 1:1 preparation history.

          CURRENT FEEDBACK ANALYSIS:
          ${summary}

          PREVIOUS 1:1 CONTEXT:
          ${previousContext || 'No previous 1:1 notes available at this time.'}

          Create a 1:1 preparation for ${userContext.userName} as they prepare to meet with their manager:
          ${previousContext ? `- Include 2-3 Follow-ups from Previous 1:1` : ''}
          - Include key feedback insights with specific examples or quotes to share with their manager
          - Include development conversations and coaching questions to bring up with their manager
          - Include support and resources to ask for from their manager
          - Include action items to propose
          - Provide guidance for ${userContext.userName} on how to have conversations with their manager about both strengths and development areas
          - Use H3 headings for each section`
        }
      ],
      max_tokens: 2000,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createPrepFallback(userContext, summary, previousContext);
    const htmlContent = await marked.parse(markdownContent);

    return NextResponse.json({
      success: true,
      content: htmlContent
    });

  } catch (error) {
    console.error('Self-prep generation error:', error);
    
    // Fallback content
    const { summary, userContext, previousContext } = await request.json();
    const fallbackMarkdown = createPrepFallback(userContext, summary, previousContext);
    const htmlContent = await marked.parse(fallbackMarkdown);
    
    return NextResponse.json({
      success: true,
      content: htmlContent,
      usedFallback: true
    });
  }
}

function createPrepFallback(userContext: UserContext, summary: string, previousContext?: string): string {
  return `# 1:1 Meeting Preparation

## Discussion Topics
Based on recent feedback analysis for ${userContext.userName}:

${summary.substring(0, 300)}...

${previousContext ? `## Updates from Previous 1:1
Progress on previous action items and ongoing development goals.

` : ''}## Questions for My Manager
1. What aspects of recent feedback should I focus on first?
2. What resources or support would help me develop in these areas?
3. How can I better align my work with team priorities?
${previousContext ? '4. How am I progressing on goals from our last conversation?' : ''}

## Goals to Discuss
- Review recent accomplishments and contributions
- Address development areas from feedback
- Plan specific next steps for improvement
${previousContext ? '- Continue development from previous 1:1 discussions' : ''}

${previousContext ? `## Previous Goals Check-in
Review and update goals from last 1:1 meeting.

` : ''}## Action Items to Propose
Specific steps I can take to address feedback and grow professionally.`;
}