// /api/notes/generate/review/route.ts
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
interface ReviewRequest {
  summary: string;
  userContext: {
    userName: string;
    jobTitle: string;
    company: string;
    industry: string;
  };
  feedbackCount: number;
}

export async function POST(request: Request) {
  try {
    const { summary, userContext, feedbackCount } = await request.json() as ReviewRequest;

    console.log('=== Generating Self-Review Content ===');

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are a career development expert helping employees write thoughtful self-evaluations that demonstrate self-awareness and growth mindset."
        },
        { 
          role: "user", 
          content: `Create a self-evaluation template for ${userContext.userName} (${userContext.jobTitle}) based on this feedback analysis.

FEEDBACK ANALYSIS:
${summary}

Create a comprehensive self-evaluation with these sections:

### Self-Evaluation: ${userContext.userName}

#### Executive Summary
[Brief overview of your performance and key contributions this period]

#### My Key Accomplishments
- [Major achievement 1 - with specific impact]
- [Major achievement 2 - with specific impact]
- [Major achievement 3 - with specific impact]

#### Feedback Reflection
Based on ${feedbackCount} feedback responses I received:
- [What feedback resonated most with me]
- [What surprised me in the feedback]
- [How the feedback aligns with my self-perception]

#### My Strengths
[Based on feedback analysis - areas where I excel]

#### Areas for My Development
[Based on feedback analysis - areas where I want to grow]

#### What I've Learned
[Key insights and lessons from this period]

#### My Goals for Next Period
- [Specific goal 1]
- [Specific goal 2]
- [Specific goal 3]

#### Questions for Discussion
1. [Question about development opportunities]
2. [Question about role expansion or new challenges]
3. [Question about team dynamics or collaboration]
4. [Question about organizational priorities]
5. [Question about support or resources needed]

Write this in first person as a self-evaluation. Be honest, specific, and growth-oriented.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createReviewFallback(userContext, summary);
    const htmlContent = await marked.parse(markdownContent);

    return NextResponse.json({
      success: true,
      content: htmlContent
    });

  } catch (error) {
    console.error('Self-review generation error:', error);
    
    // Fallback content
    const { summary, userContext } = await request.json();
    const fallbackMarkdown = createReviewFallback(userContext, summary);
    const htmlContent = await marked.parse(fallbackMarkdown);
    
    return NextResponse.json({
      success: true,
      content: htmlContent,
      usedFallback: true
    });
  }
}

function createReviewFallback(userContext: UserContext, summary: string): string {
  return `# Self-Evaluation

## Executive Summary
This evaluation reflects on my performance as ${userContext.jobTitle} and incorporates feedback from colleagues.

## Key Accomplishments
- [Accomplishment 1]
- [Accomplishment 2]
- [Accomplishment 3]

## Feedback Analysis
${summary.substring(0, 400)}...

## Development Goals
- Continue building on demonstrated strengths
- Address areas identified for improvement
- Develop new skills aligned with role requirements`;
}