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

    console.log('=== Generating 1:1 Self-Prep Content ===');

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are an expert coach helping employees prepare for 1:1 meetings with their manager. Create structured agendas that facilitate productive self-advocacy and development conversations."
        },
        { 
          role: "user", 
          content: `Create a 1:1 meeting preparation guide for ${userContext.userName} (${userContext.jobTitle}) based on this feedback analysis.

FEEDBACK ANALYSIS:
${summary}

PREVIOUS CONTEXT:
${previousContext || 'First preparation session'}

Create a focused self-preparation guide with these sections:

### My 1:1 Preparation Notes

#### Key Feedback Themes to Discuss
[2-3 main themes from the feedback analysis]

#### Questions I Want to Ask My Manager
1. [Question about growth opportunities based on feedback]
2. [Question about priorities and expectations]
3. [Question about support needed]
4. [Question about career development]

#### Topics I Want to Raise
- [Achievement or contribution to highlight]
- [Challenge or roadblock to discuss]
- [Resource or support request]

#### My Development Goals
[Based on feedback analysis, what do I want to work on?]

#### Action Items to Propose
[Specific next steps I can suggest]

Write this in first person as self-preparation notes. Be specific and actionable. Base all suggestions on the ${feedbackCount} feedback responses analyzed.`
        }
      ],
      max_tokens: 800,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createPrepFallback(userContext, summary);
    const htmlContent = await marked.parse(markdownContent);

    return NextResponse.json({
      success: true,
      content: htmlContent
    });

  } catch (error) {
    console.error('Self-prep generation error:', error);
    
    // Fallback content
    const { summary, userContext } = await request.json();
    const fallbackMarkdown = createPrepFallback(userContext, summary);
    const htmlContent = await marked.parse(fallbackMarkdown);
    
    return NextResponse.json({
      success: true,
      content: htmlContent,
      usedFallback: true
    });
  }
}

function createPrepFallback(userContext: UserContext, summary: string): string {
  return `# 1:1 Meeting Preparation

## Discussion Topics
Based on recent feedback analysis for ${userContext.userName}:

${summary.substring(0, 300)}...

## Questions for My Manager
1. What aspects of recent feedback should I focus on first?
2. What resources or support would help me develop in these areas?
3. How can I better align my work with team priorities?

## Goals to Discuss
- Review recent accomplishments and contributions
- Address development areas from feedback
- Plan specific next steps for improvement`;
}