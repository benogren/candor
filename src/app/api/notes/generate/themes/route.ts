// /api/notes/generate/themes/route.ts
import { NextResponse } from 'next/server';
import { marked } from 'marked';
import OpenAI from 'openai';
// import { json } from 'stream/consumers';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface UserContext {
  userName: string;
  jobTitle: string;
  company: string;
  industry: string;
}

interface ThemesRequest {
  structuredAnalysis: [] | string; // Can be structured analysis or a summary string
  summary: string;
  userContext: UserContext;
  feedbackCount: number;
}

export async function POST(request: Request) {
  try {
    const { structuredAnalysis, userContext, feedbackCount } = await request.json() as ThemesRequest;

    const analysisContent = JSON.stringify(structuredAnalysis, null, 2) || (structuredAnalysis as string);
    // console.log('JSON Analysis Content:', analysisContent);

    console.log(`=== Generating Individual Themes Content (${feedbackCount}) ===`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are an expert career coach, analyze the feedback provided to you."
        },
        { 
          role: "user", 
          content: `Create a comprehensive report for ${userContext.userName} (${userContext.jobTitle}) based on this 360 feedback analysis.

          FEEDBACK ANALYSIS:
          ${analysisContent}

          Your Task:
          - Create a concise report summarizing the feedback for ${userContext.userName}.
          - Be specific, constructive, and focused on actionable themes from the feedback.
          - Include specific examples or quotes.
          - Create sections, such as: Overview, Key Strengths, Development Areas, Recommendations, and Questions to Ask Your Manager.
          - Use H3 headings for each section.
          - Do not include a Conclusion section.
          - This report will be for ${userContext.userName}'s personal development use, write it in the 2nd person as if you are speaking directly to them.`
        }
      ],
      max_tokens: 2000,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createThemesFallback(userContext, analysisContent as string);
    const htmlContent = await marked.parse(markdownContent);

    return NextResponse.json({
      success: true,
      content: htmlContent
    });

  } catch (error) {
    console.error('Themes generation error:', error);
    
    // Fallback content
    try {
      const { summary, userContext } = await request.json() as ThemesRequest;
      const fallbackMarkdown = createThemesFallback(userContext, summary);
      const htmlContent = await marked.parse(fallbackMarkdown);
      
      return NextResponse.json({
        success: true,
        content: htmlContent,
        usedFallback: true
      });
    } catch (fallbackError) {
      return NextResponse.json(
        { error: 'Failed to generate themes content', fallbackError }, 
        { status: 500 }
      );
    }
  }
}

function createThemesFallback(userContext: UserContext, summary: string): string {
  console.log('====== Using fallback content for themes generation ======');


  return `# Feedback Themes Summary

## Overview
This summary analyzes recurring themes in recent feedback for ${userContext.userName} (${userContext.jobTitle}).

## Key Theme Insights
${summary.substring(0, 400)}...

## Strength Themes
- Continue building on demonstrated strengths
- Leverage positive feedback patterns

## Development Themes
- Focus on growth opportunities identified
- Address recurring areas mentioned in feedback

## Action-Oriented Recommendations
- Create theme-based development goals
- Seek targeted feedback and coaching
- Track progress on identified theme areas

## Next Steps
Focus on the most impactful themes identified and create specific development actions around them.`;
}