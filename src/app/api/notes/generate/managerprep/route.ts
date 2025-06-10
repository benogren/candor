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

    console.log('=== Generating Manager Prep Content ===');

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are an experienced leadership coach helping managers prepare for effective 1:1 meetings. Focus on coaching, development, and creating psychological safety for honest conversations."
        },
        { 
          role: "user", 
          content: `Create a 1:1 meeting preparation guide for ${userContext.userName}'s manager based on this feedback analysis.

FEEDBACK ANALYSIS:
${summary}

PREVIOUS CONTEXT:
${previousContext || 'First 1:1 preparation for this employee'}

Create a manager's preparation guide with these sections:

### 1:1 Preparation: ${userContext.userName}

#### Key Feedback Insights
[2-3 most important insights from the ${feedbackCount} feedback responses]

#### Coaching Questions to Ask
1. [Open-ended question about their experience with recent projects]
2. [Question about challenges they're facing]
3. [Question about their development goals and interests]
4. [Question about support they need from you]

#### Recognition and Appreciation
- [Specific strengths to acknowledge from feedback]
- [Recent contributions to highlight]

#### Development Conversations
- [Growth area to discuss constructively]
- [Skills development opportunity to explore]

#### Support and Resources
- [What support can you offer?]
- [Resources or training to suggest]

#### Action Items to Propose
[Specific next steps you can commit to as their manager]

Write this as guidance for the manager. Be specific about how to have constructive conversations about both strengths and development areas.`
        }
      ],
      max_tokens: 900,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createManagerPrepFallback(userContext, summary);
    const htmlContent = await marked.parse(markdownContent);

    return NextResponse.json({
      success: true,
      content: htmlContent
    });

  } catch (error) {
    console.error('Manager prep generation error:', error);
    
    // Fallback content
    const { summary, userContext } = await request.json();
    const fallbackMarkdown = createManagerPrepFallback(userContext, summary);
    const htmlContent = await marked.parse(fallbackMarkdown);
    
    return NextResponse.json({
      success: true,
      content: htmlContent,
      usedFallback: true
    });
  }
}

function createManagerPrepFallback(userContext: UserContext, summary: string): string {
  return `# Manager 1:1 Preparation: ${userContext.userName}

## Key Discussion Points
Based on recent feedback analysis:

${summary.substring(0, 300)}...

## Questions to Ask
1. How are you feeling about your current projects and responsibilities?
2. What challenges are you facing that I can help with?
3. What development opportunities are you most interested in?

## Recognition
- Acknowledge recent contributions and strengths
- Discuss positive feedback received

## Development Focus
- Address growth areas constructively
- Explore learning and development options`;
}