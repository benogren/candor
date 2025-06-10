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

interface StructuredFeedbackAnalysis {
  strengths: string[];
  developmentAreas: string[];
  keyThemes: {
    received: string[];
    provided: string[];
  };
  performanceIndicators: {
    engagementLevel: string;
    recognitionLevel: string;
    sentimentLevel: string;
  };
  notableQuotes: string[];
  condensedSummary: string;
}

interface ReviewRequest {
  summary?: string; // Keep for backward compatibility
  structuredAnalysis?: StructuredFeedbackAnalysis; // New structured format
  userContext: UserContext;
  feedbackCount: number;
  metadata?: {
    weeksAnalyzed: number;
    totalValueNominations: number;
    averageSentiment: number;
  };
}

export async function POST(request: Request) {
  try {
    const { 
      summary, 
      structuredAnalysis, 
      userContext, 
      feedbackCount
    } = await request.json() as ReviewRequest;

    console.log(`=== Generating Self-Review Content (${feedbackCount} feedback responses) ===`);

    const JSONAnalysisContent = JSON.stringify(structuredAnalysis, null, 2) || (structuredAnalysis);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are a career development expert helping employees write thoughtful self-evaluations that demonstrate self-awareness and growth mindset."
        },
        { 
          role: "user", 
          content: `Create a self-evaluation for ${userContext.userName} (${userContext.jobTitle}) based on this feedback analysis.

          FEEDBACK ANALYSIS:
          ${JSONAnalysisContent}

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
          [Questions to facilitate a constructive discussion with your manager about your performance goals and development]

          Write this in first person as a self-evaluation. Be honest, specific, and growth-oriented.`
        }
      ],
      max_tokens: 4000,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || 
      createReviewFallback(userContext, structuredAnalysis || { condensedSummary: summary || '' });
    const htmlContent = await marked.parse(markdownContent);

    return NextResponse.json({
      success: true,
      content: htmlContent
    });

  } catch (error) {
    console.error('Self-review generation error:', error);
    
    // Fallback content
    const { structuredAnalysis, userContext, summary } = await request.json();
    const fallbackMarkdown = createReviewFallback(
      userContext, 
      structuredAnalysis || { condensedSummary: summary || '' }
    );
    const htmlContent = await marked.parse(fallbackMarkdown);
    
    return NextResponse.json({
      success: true,
      content: htmlContent,
      usedFallback: true
    });
  }
}

function createReviewFallback(
  userContext: UserContext, 
  analysis: Partial<StructuredFeedbackAnalysis> & { condensedSummary: string }
): string {
  return `# Self-Evaluation: ${userContext.userName}

## Executive Summary
This self-evaluation reflects on my performance as ${userContext.jobTitle} and incorporates comprehensive feedback from colleagues${analysis.condensedSummary ? ': ' + analysis.condensedSummary : '.'}

## Detailed Assessment

### My Strengths
${analysis.strengths && analysis.strengths.length > 0 
  ? analysis.strengths.map(strength => `- ${strength}`).join('\n')
  : '- [Strengths to be identified from feedback analysis]'
}

### My Areas for Improvement
${analysis.developmentAreas && analysis.developmentAreas.length > 0 
  ? analysis.developmentAreas.map(area => `- ${area}`).join('\n')
  : '- [Development areas to be identified from feedback analysis]'
}

## Feedback Analysis

### Notable Quotes
${analysis.notableQuotes && analysis.notableQuotes.length > 0 
  ? analysis.notableQuotes.map(quote => `> "${quote}"`).join('\n\n')
  : '> [Notable feedback quotes to be added]'
}

### Quantitative Feedback Summary
${analysis.performanceIndicators 
  ? `- **Engagement Level:** ${analysis.performanceIndicators.engagementLevel}
- **Recognition Level:** ${analysis.performanceIndicators.recognitionLevel}
- **Peer Perception:** ${analysis.performanceIndicators.sentimentLevel}`
  : '- [Quantitative feedback metrics to be added]'
}

### Qualitative Feedback Summary
${analysis.keyThemes 
  ? `**Key Themes Received:** ${analysis.keyThemes.received.join(', ') || 'None identified'}

**Key Themes Provided:** ${analysis.keyThemes.provided.join(', ') || 'None identified'}`
  : '- [Qualitative feedback themes to be added]'
}

## What I've Learned
- The importance of continuous feedback in professional development
- How my contributions are perceived by colleagues and stakeholders
- Areas where I can leverage my strengths more effectively
- Specific development opportunities that align with my career goals

## Goals for Next Review Period
- Build upon identified strengths to increase impact
- Address development areas through targeted learning and practice
- Seek additional feedback and mentoring opportunities
- Contribute more actively to team collaboration and knowledge sharing

## Managerial Support
- Regular one-on-one meetings to discuss progress and challenges
- Access to training and development resources for identified growth areas
- Opportunities to take on stretch assignments that align with my development goals
- Clear feedback and guidance on performance expectations

---

## Questions for Discussion
1. What development opportunities do you see that align with both my strengths and the team's needs?
2. How can I better leverage my skills to contribute to our department's strategic objectives?
3. What feedback patterns surprise you, and how should we address them together?
4. What resources or support would be most valuable for my professional growth?
5. How do my career aspirations align with opportunities within our organization?`;
}