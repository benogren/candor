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

    console.log(`=== Generating Self-Review Content (${feedbackCount}) ===`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are a career development expert helping employees write thoughtful self-evaluations that demonstrate self-awareness and growth mindset."
        },
        { 
          role: "user", 
          content: `Create a self-evaluation for ${userContext.userName} (${userContext.jobTitle}) based on this feedback analysis.

          FEEDBACK ANALYSIS:
          ${summary}

          Create a comprehensive self-evaluation with these sections:

          ## Self-Evaluation: ${userContext.userName}

          ### Executive Summary
          [Brief overview of your performance and key contributions this period. Do not include the number of weeks or number of feedback received, focus on the insights.]

          ### Detailed Assessment

          #### My Strengths
          [Based on feedback analysis - areas where I excel]

          #### My Areas for Improvement
          [Based on feedback analysis - areas where I want to grow]

          ### Feedback Analysis

          #### Notable Quotes
          [Key quotes from feedback that stood out and showcase your impact]

          #### Quantitative Feedback Summary
          [Summary of feedback ratings or scores, if available]

          #### Qualitative Feedback Summary
          [Summary of key themes from qualitative feedback]

          ### What I've Learned
          [Key insights and lessons from this period]

          ### Goals for Next Review Period
          - [Goal 1]
          - [Goal 2]
          - [Goal 3]

          ### Managerial Support
          [What support or resources you need from your manager to achieve these goals]

          ----- 

          ### Questions for Discussion
          1. [Question about development opportunities]
          2. [Question about role expansion or new challenges]
          3. [Question about team dynamics or collaboration]
          4. [Question about organizational priorities]
          5. [Question about support or resources needed]

          Write this in first person as a self-evaluation. Be honest, specific, and growth-oriented.`
        }
      ],
      max_tokens: 1400,
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