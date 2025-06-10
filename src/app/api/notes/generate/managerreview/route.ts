// /api/notes/generate/managerreview/route.ts
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
interface ManagerReviewRequest {
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
    const { summary, userContext, feedbackCount } = await request.json() as ManagerReviewRequest;

    console.log(`=== Generating Manager Review Content (${feedbackCount}) ===`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are an experienced HR professional helping managers write fair, comprehensive performance reviews that support employee development and provide clear, actionable feedback."
        },
        { 
          role: "user", 
          content: `Create a performance review template for ${userContext.userName} (${userContext.jobTitle}) based on this comprehensive feedback analysis.

            FEEDBACK ANALYSIS:
            ${summary}

            Create a manager's performance review with these sections:

            ## Performance Review: ${userContext.userName}

            ### Executive Summary
            [Brief overview of ${userContext.userName}'s performance and key contributions this period. Do not include the number of weeks or number of feedback received, focus on the insights.]

            ### Detailed Assessment

            #### Strengths
            [Based on feedback analysis - areas where ${userContext.userName} excels]

            #### Development Opportunities
            [Based on feedback analysis - areas where ${userContext.userName} can grow]

            ### Feedback Analysis

            #### Notable Quotes
            [Key quotes from feedback that stood out and showcase ${userContext.userName}'s impact and areas for growth]

            #### Quantitative Feedback Summary
            [Summary of feedback ratings or scores, if available]

            #### Qualitative Feedback Summary
            [Summary of key themes from qualitative feedback]

            ### Goals for Next Review Period
            - [Goal 1]
            - [Goal 2]
            - [Goal 3]

            ### Managerial Support
            [What support, training, or resources you will provide to help ${userContext.userName} achieve these goals]

            ### Overall Rating and Rationale
            [Performance rating with clear justification]

            ----- 

            ### Questions for Discussion
            1. [Question about development opportunities]
            2. [Question about role expansion or new challenges]
            3. [Question about team dynamics or collaboration]
            4. [Question about organizational priorities]
            5. [Question about support or resources needed]

            Write this in first person as a self-evaluation. Be honest, specific, and growth-oriented. Check for bias, clarity, fairness, and actionable insights. Include both recognition and constructive feedback.`
        }
      ],
      max_tokens: 1800,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createManagerReviewFallback(userContext, summary);
    const htmlContent = await marked.parse(markdownContent);

    return NextResponse.json({
      success: true,
      content: htmlContent
    });

  } catch (error) {
    console.error('Manager review generation error:', error);
    
    // Fallback content
    const { summary, userContext } = await request.json();
    const fallbackMarkdown = createManagerReviewFallback(userContext, summary);
    const htmlContent = await marked.parse(fallbackMarkdown);
    
    return NextResponse.json({
      success: true,
      content: htmlContent,
      usedFallback: true
    });
  }
}

function createManagerReviewFallback(userContext: UserContext, summary: string): string {
  return `# Performance Review: ${userContext.userName}

## Executive Summary
Performance assessment for ${userContext.userName} (${userContext.jobTitle}) based on comprehensive feedback analysis.

## Key Accomplishments
- [Accomplishment 1 with impact]
- [Accomplishment 2 with impact]
- [Accomplishment 3 with impact]

## 360-Degree Feedback Summary
${summary.substring(0, 500)}...

## Strengths
- [Strength 1 from feedback]
- [Strength 2 from feedback]

## Development Areas
- [Development area 1]
- [Development area 2]

## Goals for Next Period
- [Goal 1]
- [Goal 2]
- [Goal 3]`;
}