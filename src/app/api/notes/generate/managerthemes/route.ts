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
  summary: string;
  userContext: UserContext;
  feedbackCount: number;
}

export async function POST(request: Request) {
  try {
    const { summary, userContext, feedbackCount } = await request.json() as ManagerThemesRequest;

    console.log('=== Generating Manager Themes Content ===');

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are an experienced leadership coach helping managers understand feedback themes about their employees. Focus on actionable managerial insights and clear coaching opportunities."
        },
        { 
          role: "user", 
          content: `Create a comprehensive feedback themes analysis for ${userContext.userName}'s manager based on this feedback analysis.

FEEDBACK ANALYSIS:
${summary}

Create a manager-focused themes analysis with these sections:

### Manager's Feedback Themes Analysis: ${userContext.userName}

#### Executive Summary
[High-level overview of ${userContext.userName}'s performance themes from ${feedbackCount} feedback responses]

#### Key Strength Themes for Recognition
[Top 3-4 positive themes to acknowledge and reinforce as a manager]

#### Development Themes for Coaching
[Top 2-3 areas where ${userContext.userName} needs managerial support and coaching]

#### Team Collaboration Themes
[How ${userContext.userName} is perceived by colleagues and what this means for team dynamics]

#### Communication & Leadership Themes
[${userContext.userName}'s communication patterns and potential leadership development areas]

#### Performance Impact Themes  
[How ${userContext.userName}'s work affects team and business outcomes]

#### Manager Action Items by Theme
1. **Recognition Actions**: [Specific ways to acknowledge strength themes]
2. **Coaching Actions**: [Specific coaching conversations to have about development themes]
3. **Support Actions**: [Resources, training, or support to provide based on themes]
4. **Development Actions**: [Stretch assignments or growth opportunities aligned with themes]

#### Quarterly Development Focus
[Theme-based priorities for ${userContext.userName}'s development this quarter]

#### Success Metrics
[How to measure progress on the key themes identified]

Write this as actionable guidance for ${userContext.userName}'s manager. Be specific about managerial actions and coaching approaches based on the themes.`
        }
      ],
      max_tokens: 1200,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createManagerThemesFallback(userContext, summary);
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