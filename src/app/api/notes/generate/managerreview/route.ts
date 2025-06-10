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

interface ManagerReviewRequest {
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
      feedbackCount, 
      metadata 
    } = await request.json() as ManagerReviewRequest;

    console.log(`=== Generating Manager Review Content (${feedbackCount} feedback responses) ===`);

    // Use structured analysis if available, otherwise fall back to summary
    const analysisContent = structuredAnalysis 
      ? formatStructuredAnalysisForAI(structuredAnalysis, userContext, metadata)
      : summary;

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
${analysisContent}

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
[Summary of feedback key themes, nominations, ratings and scores, if available]

### Managerial Support
[What support, training, or resources you will provide to help ${userContext.userName} achieve these goals]

### Overall Rating and Rationale
[Performance rating with clear justification]

----- 

### Questions for Discussion
[Questions to facilitate a constructive discussion with ${userContext.userName} about their performance and development]

Write this in second person as a performance review.`
        }
      ],
      max_tokens: 4000,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || 
      createManagerReviewFallback(userContext, structuredAnalysis || { condensedSummary: summary || '' });
    const htmlContent = await marked.parse(markdownContent);

    return NextResponse.json({
      success: true,
      content: htmlContent
    });

  } catch (error) {
    console.error('Manager review generation error:', error);
    
    // Fallback content
    const { structuredAnalysis, userContext, summary } = await request.json();
    const fallbackMarkdown = createManagerReviewFallback(
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

function formatStructuredAnalysisForAI(
  analysis: StructuredFeedbackAnalysis, 
  userContext: UserContext,
  metadata?: { weeksAnalyzed: number; totalValueNominations: number; averageSentiment: number }
): string {
  // Create a concise, structured format that's easy for AI to parse
  // This should be much shorter than the original verbose summary
  
  return `**FEEDBACK ANALYSIS FOR ${userContext.userName.toUpperCase()}**

**OVERVIEW:**
${analysis.condensedSummary}

**STRENGTHS IDENTIFIED:**
${analysis.strengths.length > 0 
  ? analysis.strengths.map((strength, index) => `${index + 1}. ${strength}`).join('\n')
  : 'No specific strengths identified in feedback.'
}

**DEVELOPMENT OPPORTUNITIES:**
${analysis.developmentAreas.length > 0 
  ? analysis.developmentAreas.map((area, index) => `${index + 1}. ${area}`).join('\n')
  : 'No specific development areas identified in feedback.'
}

**KEY THEMES:**
- Feedback Received Themes: ${analysis.keyThemes.received.join(', ') || 'None identified'}
- Feedback Provided Themes: ${analysis.keyThemes.provided.join(', ') || 'None identified'}

**NOTABLE QUOTES:**
${analysis.notableQuotes.length > 0 
  ? analysis.notableQuotes.map((quote, index) => `${index + 1}. "${quote}"`).join('\n')
  : 'No notable quotes available.'
}

**PERFORMANCE INDICATORS:**
- Feedback Engagement: ${analysis.performanceIndicators.engagementLevel}
- Recognition Level: ${analysis.performanceIndicators.recognitionLevel}
- Peer Perception: ${analysis.performanceIndicators.sentimentLevel}

${metadata ? `**ADDITIONAL CONTEXT:**
- Analysis Period: ${metadata.weeksAnalyzed} weeks
- Value Nominations: ${metadata.totalValueNominations}
- Sentiment Score: ${(metadata.averageSentiment * 100).toFixed(1)}%` : ''}`;
}

function createManagerReviewFallback(
  userContext: UserContext, 
  analysis: Partial<StructuredFeedbackAnalysis> & { condensedSummary: string }
): string {
  return `# Performance Review: ${userContext.userName}

## Executive Summary
This performance assessment for ${userContext.userName} (${userContext.jobTitle}) is based on comprehensive feedback analysis${analysis.condensedSummary ? ': ' + analysis.condensedSummary : '.'}

## Detailed Assessment

### Strengths
${analysis.strengths && analysis.strengths.length > 0 
  ? analysis.strengths.map(strength => `- ${strength}`).join('\n')
  : '- [Strengths to be identified from feedback analysis]'
}

### Development Opportunities
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

### Feedback Summary
${analysis.performanceIndicators 
  ? `- **Engagement Level:** ${analysis.performanceIndicators.engagementLevel}
- **Recognition Level:** ${analysis.performanceIndicators.recognitionLevel}
- **Peer Perception:** ${analysis.performanceIndicators.sentimentLevel}`
  : '- [Feedback summary metrics to be added]'
}

## Managerial Support
- Regular one-on-one meetings to discuss progress and challenges
- Targeted training opportunities based on identified development areas
- Mentoring support for skill development
- Clear goal setting and milestone tracking

## Overall Rating and Rationale
**Rating:** [To be determined based on comprehensive assessment]

**Rationale:** ${userContext.userName} demonstrates [key strengths] while showing potential for growth in [development areas]. The feedback analysis indicates [overall performance summary].

---

## Questions for Discussion
1. How do you feel about the feedback themes that emerged from your colleagues?
2. Which of these strengths do you feel most confident about, and how can we leverage them further?
3. What support do you need to address the development opportunities identified?
4. What are your career goals for the next quarter, and how do they align with this feedback?
5. Are there any feedback patterns that surprised you, and how might we address them?`;
}