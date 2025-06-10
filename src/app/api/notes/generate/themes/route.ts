// /api/notes/generate/themes/route.ts
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

interface ThemesRequest {
  summary: string;
  userContext: UserContext;
  feedbackCount: number;
}

export async function POST(request: Request) {
  try {
    const { summary, userContext, feedbackCount } = await request.json() as ThemesRequest;

    console.log('=== Generating Individual Themes Content ===');

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are an expert feedback analyst creating comprehensive theme summaries for individual development use. Focus on actionable insights and clear development paths."
        },
        { 
          role: "user", 
          content: `Create a comprehensive feedback themes summary for ${userContext.userName} (${userContext.jobTitle}) based on this analysis.

FEEDBACK ANALYSIS:
${summary}

Create a well-structured themes summary with these sections:

### Feedback Themes Summary: ${userContext.userName}

#### Overview
[Summary of the ${feedbackCount} feedback responses and overall themes]

#### Top Strength Themes
[Top 3-4 recurring positive themes from colleagues]

#### Development Themes  
[Top 2-3 areas for growth with specific patterns identified]

#### Collaboration Themes
[How you're perceived in teamwork and cross-functional work]

#### Communication Themes
[Patterns in how colleagues experience your communication style]

#### Impact Themes
[How your work and contributions are viewed by others]

#### Actionable Theme-Based Recommendations
1. [Specific action based on strength themes to leverage]
2. [Specific action based on development themes to address]
3. [Specific action based on collaboration themes to improve]

#### Personal Development Plan
[Theme-based development suggestions and next steps]

Write this for personal development use. Be specific, constructive, and focused on actionable themes from the feedback.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createThemesFallback(userContext, summary);
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