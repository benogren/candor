// /api/notes/generate/prep/route.ts
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

interface PrepRequest {
  summary: string;
  userContext: {
    userName: string;
    jobTitle: string;
    company: string;
    industry: string;
  };
  feedbackCount: number;
  previousContext?: string;
  structuredAnalysis?: [] | string;
}

export async function POST(request: Request) {
  try {
    const { structuredAnalysis, userContext, feedbackCount, previousContext = '' } = await request.json() as PrepRequest;

    console.log(`=== Generating Self 1:1 Prep Content (${feedbackCount}) ===`);
    
    const JSONAnalysisContent = JSON.stringify(structuredAnalysis, null, 2) || (structuredAnalysis as string);
    const condensedPreviousContent = smartTruncateContext(previousContext ?? '', 400);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are an expert coach helping employees prepare for 1:1 meetings with their manager. Create structured agendas that facilitate productive self-advocacy, development conversations, and build on previous discussions to show progress and continuity."
        },
        { 
          role: "user", 
          content: `Create a 1:1 meeting agenda and preparation for ${userContext.userName} (${userContext.jobTitle}) based on this feedback analysis and previous 1:1 preparation history.

          CURRENT FEEDBACK ANALYSIS:
          ${JSONAnalysisContent}

          PREVIOUS 1:1 CONTEXT:
          ${previousContext ? condensedPreviousContent : 'No previous 1:1 notes available at this time.'}

          Create a 1:1 preparation for ${userContext.userName} as they prepare to meet with their manager:
          ${previousContext ? `- Include 2-3 Follow-ups from Previous 1:1` : ''}
          - Include key feedback insights with specific examples or quotes to share with their manager
          - Include development conversations and coaching questions to bring up with their manager
          - Include support and resources to ask for from their manager
          - Include action items to propose
          - Provide guidance for ${userContext.userName} on how to have conversations with their manager about both strengths and development areas

          Use H3 headings for each section header`
        }
      ],
      max_tokens: 2000,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createPrepFallback(userContext, structuredAnalysis as string, previousContext);
    const htmlContent = await marked.parse(markdownContent);

    return NextResponse.json({
      success: true,
      content: htmlContent
    });

  } catch (error) {
    console.error('Self-prep generation error:', error);
    
    // Fallback content
    const { summary, userContext, previousContext } = await request.json();
    const fallbackMarkdown = createPrepFallback(userContext, summary, previousContext);
    const htmlContent = await marked.parse(fallbackMarkdown);
    
    return NextResponse.json({
      success: true,
      content: htmlContent,
      usedFallback: true
    });
  }
}

function createPrepFallback(userContext: UserContext, summary: string, previousContext?: string): string {
  return `# 1:1 Meeting Preparation

## Discussion Topics
Based on recent feedback analysis for ${userContext.userName}:

${summary.substring(0, 300)}...

${previousContext ? `## Updates from Previous 1:1
Progress on previous action items and ongoing development goals.

` : ''}## Questions for My Manager
1. What aspects of recent feedback should I focus on first?
2. What resources or support would help me develop in these areas?
3. How can I better align my work with team priorities?
${previousContext ? '4. How am I progressing on goals from our last conversation?' : ''}

## Goals to Discuss
- Review recent accomplishments and contributions
- Address development areas from feedback
- Plan specific next steps for improvement
${previousContext ? '- Continue development from previous 1:1 discussions' : ''}

${previousContext ? `## Previous Goals Check-in
Review and update goals from last 1:1 meeting.

` : ''}## Action Items to Propose
Specific steps I can take to address feedback and grow professionally.`;
}

function smartTruncateContext(previousContext: string, maxLength: number = 400): string {
  if (!previousContext || previousContext.length <= maxLength) return previousContext;
  
  // Extract key actionable content first
  const actionablePatterns = [
    /(?:action items?|next steps?|goals?|follow[- ]?up)[^.!?]*[.!?]/gi,
    /(?:^|\n)(?:\*|-|\d+\.)\s+[^\n]{20,}/gm,  // Bullet points
    /(?:will|should|need to|plan to|decided to)[^.!?]*[.!?]/gi,
    /(?:progress|completed|achieved|improved)[^.!?]*[.!?]/gi,
    /(?:challenge|difficulty|focus|priority)[^.!?]*[.!?]/gi
  ];
  
  const extracted = [];
  for (const pattern of actionablePatterns) {
    const matches = previousContext.match(pattern);
    if (matches) {
      extracted.push(...matches.slice(0, 2).map(match => match.trim()));
    }
  }
  
  if (extracted.length > 0) {
    const result = extracted.join(' ').substring(0, maxLength);
    return result + (result.length >= maxLength ? '...' : '');
  }
  
  // Fallback: smart truncation at sentence boundary
  const sentences = previousContext.split(/[.!?]+/).filter(s => s.trim().length > 10);
  let result = '';
  for (const sentence of sentences) {
    if ((result + sentence).length > maxLength - 20) break;
    result += sentence.trim() + '. ';
  }
  
  return result.trim() || previousContext.substring(0, maxLength);
}