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
}

export async function POST(request: Request) {
  try {
    const { summary, userContext, feedbackCount, previousContext = '' } = await request.json() as ManagerPrepRequest;

    console.log('=== Generating Manager Prep Content ===');
    console.log('Previous context length:', previousContext.length);

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { 
          role: "system", 
          content: "You are an experienced leadership coach helping managers prepare for effective 1:1 meetings. Focus on coaching, development, creating psychological safety, and building on previous conversations to show continuity and progress."
        },
        { 
          role: "user", 
          content: `Create a comprehensive 1:1 meeting preparation guide for ${userContext.userName}'s manager based on this feedback analysis and previous conversation history.

CURRENT FEEDBACK ANALYSIS:
${summary}

PREVIOUS 1:1 CONTEXT:
${previousContext || 'This is the first 1:1 preparation for this employee - no previous context available'}

Create a manager's preparation guide with these sections:

### 1:1 Preparation: ${userContext.userName}

#### Key Feedback Insights
[2-3 most important insights from the ${feedbackCount} recent feedback responses]

${previousContext ? `#### Follow-up from Previous 1:1
[Reference specific items from the previous context that should be followed up on]
- Check progress on previous action items
- Address any ongoing concerns mentioned previously
- Build on previous discussion topics

#### Progress Review
[How has the employee progressed since the last 1:1 based on current feedback vs previous context?]

` : ''}#### Coaching Questions to Ask
1. [Open-ended question about their experience with recent projects]
2. [Question about challenges they're facing]
3. [Question about their development goals and interests]
4. [Question about support they need from you]
${previousContext ? '5. [Follow-up question based on previous 1:1 discussion]' : ''}

#### Recognition and Appreciation
- [Specific strengths to acknowledge from current feedback]
- [Recent contributions to highlight]
${previousContext ? '- [Acknowledge progress made since previous 1:1]' : ''}

#### Development Conversations
- [Growth area to discuss constructively based on current feedback]
- [Skills development opportunity to explore]
${previousContext ? '- [Continue development discussions from previous meeting]' : ''}

#### Support and Resources
- [What support can you offer based on current needs?]
- [Resources or training to suggest]
${previousContext ? '- [Resources discussed previously - check if still relevant/needed]' : ''}

#### Action Items to Propose
[Specific next steps you can commit to as their manager]
${previousContext ? '[Build on or modify action items from previous 1:1]' : ''}

#### Conversation Continuity
${previousContext ? `[Reference how this conversation builds on previous discussions and shows ongoing support for their development]` : '[This is your first structured 1:1 - focus on building trust and understanding their current state]'}

Write this as guidance for the manager. Be specific about how to have constructive conversations about both strengths and development areas. ${previousContext ? 'Show how this meeting builds on previous conversations to demonstrate ongoing support and development.' : ''}`
        }
      ],
      max_tokens: 1200,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createManagerPrepFallback(userContext, summary, previousContext);
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