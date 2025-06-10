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

    console.log('=== Generating Manager Review Content ===');

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

            ### Performance Review: ${userContext.userName}

            #### Executive Summary
            [Overall assessment of ${userContext.userName}'s performance this period]

            #### Key Accomplishments and Impact
            - [Major contribution 1 with business impact]
            - [Major contribution 2 with business impact]
            - [Major contribution 3 with business impact]

            #### 360-Degree Feedback Analysis
            Based on ${feedbackCount} feedback responses from colleagues:
            - [Key positive themes from feedback]
            - [Areas of strength consistently mentioned]
            - [Opportunities for growth identified]

            #### Performance Strengths
            [Specific strengths with examples from feedback]

            #### Development Opportunities
            [Areas for improvement with specific, actionable guidance]

            #### Goal Achievement
            [Assessment of how well they met previous goals]

            #### Goals for Next Review Period
            - [Specific, measurable goal 1]
            - [Specific, measurable goal 2]
            - [Specific, measurable goal 3]

            #### Manager Support and Resources
            [What support, training, or resources you will provide]

            #### Overall Rating and Rationale
            [Performance rating with clear justification]

            Write this as a comprehensive performance review from the manager's perspective. Be fair, specific, and development-focused. Include both recognition and constructive feedback.`
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