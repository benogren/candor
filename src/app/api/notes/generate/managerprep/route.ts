// /api/notes/generate/managerprep/route.ts
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

interface ManagerPrepRequest {
  summary: string;
  userContext: {
    userName: string;
    jobTitle: string;
    company: string;
    industry: string;
  };
  feedbackCount: number;
  previousContext?: string;
  structuredAnalysis?: [] | string; // Optional structured analysis or summary string
}

export async function POST(request: Request) {
  try {
    const { structuredAnalysis, userContext, feedbackCount, previousContext } = await request.json() as ManagerPrepRequest;

    console.log(`=== Generating Manager 1:1 Prep Content (${feedbackCount}) ===`);

    const JSONAnalysisContent = JSON.stringify(structuredAnalysis, null, 2) || (structuredAnalysis as string);
    const condensedPreviousContent = smartTruncateContext(previousContext ?? '', 400);

    console.log(condensedPreviousContent);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are an experienced leadership coach helping managers prepare for effective 1:1 meetings. Focus on coaching, development, creating psychological safety, and building on previous conversations to show continuity and progress."
        },
        { 
          role: "user", 
          content: `Create a 1:1 meeting agenda and preparation for ${userContext.userName}'s manager based on this feedback analysis and previous conversation history.

          CURRENT FEEDBACK ANALYSIS:
          ${JSONAnalysisContent}

          PREVIOUS 1:1 CONTEXT:
          ${previousContext ? condensedPreviousContent : 'No previous 1:1 notes available at this time.'}

          Create a manager's 1:1 preparation:
          ${previousContext ? `- Include 2-3 Follow-ups from Previous 1:1` : ''}
          - Include key feedback insights with specific examples or quotes
          - Include recognition and appreciation points
          - Include development conversations and coaching questions
          - Include support and resources to offer
          - Include action items to propose
          - Provide guidance for the manager on how to have constructive conversations about both strengths and development areas
          
          Use H3 headings for each section header`
        }
      ],
      max_tokens: 1800,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createManagerPrepFallback(userContext, structuredAnalysis as string, previousContext);
    const htmlContent = await marked.parse(markdownContent);

    return NextResponse.json({
      success: true,
      content: htmlContent
    });

  } catch (error) {
    console.error('Manager prep generation error:', error);
    
    // Fallback content
    const { summary, userContext, previousContext } = await request.json();
    const fallbackMarkdown = createManagerPrepFallback(userContext, summary, previousContext);
    const htmlContent = await marked.parse(fallbackMarkdown);
    
    return NextResponse.json({
      success: true,
      content: htmlContent,
      usedFallback: true
    });
  }
}

function createManagerPrepFallback(userContext: UserContext, summary: string, previousContext?: string): string {
  console.log('******* Using fallback for manager 1:1 preparation content *******');
  return `# Manager 1:1 Preparation: ${userContext.userName}

## Key Discussion Points
Based on recent feedback analysis:

${summary.substring(0, 300)}...

${previousContext ? `## Follow-up from Previous 1:1
Review previous action items and continue ongoing development discussions.

` : ''}## Questions to Ask
1. How are you feeling about your current projects and responsibilities?
2. What challenges are you facing that I can help with?
3. What development opportunities are you most interested in?
${previousContext ? '4. How are you progressing on items we discussed last time?' : ''}

## Recognition
- Acknowledge recent contributions and strengths
- Discuss positive feedback received
${previousContext ? '- Recognize progress made since last meeting' : ''}

## Development Focus
- Address growth areas constructively
- Explore learning and development options
${previousContext ? '- Continue previous development conversations' : ''}`;
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