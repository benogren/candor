// /api/notes/generate/managerthemes/route.ts
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

interface ManagerThemesRequest {
  structuredAnalysis: [] | string; // Can be structured analysis or a summary string
  summary: string;
  userContext: UserContext;
  feedbackCount: number;
}

export async function POST(request: Request) {
  try {
    const { structuredAnalysis, userContext, feedbackCount } = await request.json() as ManagerThemesRequest;

    const analysisContent = JSON.stringify(structuredAnalysis, null, 2) || (structuredAnalysis as string);
    // console.log('JSON Analysis Content:', analysisContent);

    console.log(`=== Generating Manager Themes Content (${feedbackCount}) ===`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are an expert career coach, analyze the feedback provided to you."
        },
        { 
          role: "user", 
          content: `Create a comprehensive 360-degree Feedback Summary Report for ${userContext.userName} (${userContext.jobTitle})'s Manager based on this 360 feedback analysis.

          FEEDBACK ANALYSIS:
          ${analysisContent}

          Your Task:
          - Create a concise report summarizing the feedback for ${userContext.userName}'s manager.
          - Be specific, constructive, and focused on actionable themes from the feedback.
          - Include specific examples or quotes.
          - Create sections, such as: Overview, Key Strengths, Development Areas, Recommendations, and Questions to Ask ${userContext.userName}.
          - Use H3 headings for each section.
          - Do not include a Conclusion section.
          - This report will be for ${userContext.userName}'s manager, write it in the 3rd person as if you are speaking about to them.`     
        }
      ],
      max_tokens: 2000,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createManagerThemesFallback(userContext, analysisContent as string);
    const htmlContent = await marked.parse(markdownContent);

    return NextResponse.json({
      success: true,
      content: htmlContent
    });

  } catch (error) {
    console.error('Manager themes generation error:', error);
    
    // Fallback content
    try {
      const { summary, userContext } = await request.json() as ManagerThemesRequest;
      const fallbackMarkdown = createManagerThemesFallback(userContext, summary);
      const htmlContent = await marked.parse(fallbackMarkdown);
      
      return NextResponse.json({
        success: true,
        content: htmlContent,
        usedFallback: true
      });
    } catch (fallbackError) {
      return NextResponse.json(
        { error: 'Failed to generate manager themes content', fallbackError }, 
        { status: 500 }
      );
    }
  }
}

function createManagerThemesFallback(userContext: UserContext, summary: string): string {
  console.log('====== Using fallback content for themes generation ======');


  return `# Manager's Feedback Themes Analysis: ${userContext.userName}

## Executive Summary
Comprehensive theme analysis for ${userContext.userName} (${userContext.jobTitle}) based on colleague feedback.

## Key Theme Insights
${summary.substring(0, 400)}...

## Strength Themes to Reinforce
- Areas where ${userContext.userName} excels and should be recognized
- Positive patterns to continue encouraging

## Development Themes to Coach
- Growth areas requiring your support as a manager
- Themes that need targeted coaching conversations

## Manager Action Items
- **Recognition**: Acknowledge specific strengths identified in themes
- **Coaching**: Address development areas through structured conversations  
- **Support**: Provide resources and development opportunities
- **Monitoring**: Track progress on key theme areas

## Next Steps for Manager
Focus on having theme-based conversations that combine recognition of strengths with supportive coaching on development areas.`;
}