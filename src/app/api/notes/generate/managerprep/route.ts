// /api/notes/generate/managerprep/route.ts
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

interface ManagerPrepRequest {
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
    const { summary, userContext, feedbackCount, previousContext = '' } = await request.json() as ManagerPrepRequest;

    console.log(`=== Generating Manager 1:1 Prep Content (${feedbackCount}) ===`);
    console.log('Previous context length:', previousContext.length);

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { 
          role: "system", 
          content: "You are an experienced leadership coach helping managers prepare for effective 1:1 meetings. Focus on coaching, development, creating psychological safety, and building on previous conversations to show continuity and progress."
        },
        { 
          role: "user", 
          content: `Create a 1:1 meeting agenda and preparation for ${userContext.userName}'s manager based on this feedback analysis and previous conversation history.

          CURRENT FEEDBACK ANALYSIS:
          ${summary}

          PREVIOUS 1:1 CONTEXT:
          ${previousContext || 'No previous 1:1 notes available at this time.'}

          Create a manager's 1:1 preparation:
          ${previousContext ? `- Include 2-3 Follow-ups from Previous 1:1` : ''}
          - Include key feedback insights with specific examples or quotes
          - Include recognition and appreciation points
          - Include development conversations and coaching questions
          - Include support and resources to offer
          - Include action items to propose
          - Provide guidance for the manager on how to have constructive conversations about both strengths and development areas
          - Use H3 headings for each section`
        }
      ],
      max_tokens: 2000,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createManagerPrepFallback(userContext, summary, previousContext);
    const htmlContent = await marked.parse(markdownContent);

    return NextResponse.json({
      success: true,
      content: htmlContent
    });

  } catch (error) {
    console.error('Manager prep generation error:', error);
    
    // Fallback content
    const { summary, userContext, previousContext } = await request.json();
    const fallbackMarkdown = createManagerPrepFallback(userContext, summary, previousContext);
    const htmlContent = await marked.parse(fallbackMarkdown);
    
    return NextResponse.json({
      success: true,
      content: htmlContent,
      usedFallback: true
    });
  }
}

function createManagerPrepFallback(userContext: UserContext, summary: string, previousContext?: string): string {
  return `# Manager 1:1 Preparation: ${userContext.userName}

## Key Discussion Points
Based on recent feedback analysis:

${summary.substring(0, 300)}...

${previousContext ? `## Follow-up from Previous 1:1
Review previous action items and continue ongoing development discussions.

` : ''}## Questions to Ask
1. How are you feeling about your current projects and responsibilities?
2. What challenges are you facing that I can help with?
3. What development opportunities are you most interested in?
${previousContext ? '4. How are you progressing on items we discussed last time?' : ''}

## Recognition
- Acknowledge recent contributions and strengths
- Discuss positive feedback received
${previousContext ? '- Recognize progress made since last meeting' : ''}

## Development Focus
- Address growth areas constructively
- Explore learning and development options
${previousContext ? '- Continue previous development conversations' : ''}`;
}