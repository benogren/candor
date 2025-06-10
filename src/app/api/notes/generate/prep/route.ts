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
}

export async function POST(request: Request) {
  try {
    const { summary, userContext, feedbackCount, previousContext = '' } = await request.json() as PrepRequest;

    console.log('=== Generating 1:1 Self-Prep Content ===');
    console.log('Previous context length:', previousContext.length);

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are an expert coach helping employees prepare for 1:1 meetings with their manager. Create structured agendas that facilitate productive self-advocacy, development conversations, and build on previous discussions to show progress and continuity."
        },
        { 
          role: "user", 
          content: `Create a comprehensive 1:1 meeting preparation guide for ${userContext.userName} (${userContext.jobTitle}) based on this feedback analysis and previous 1:1 preparation history.

CURRENT FEEDBACK ANALYSIS:
${summary}

PREVIOUS 1:1 PREPARATION CONTEXT:
${previousContext || 'This is the first 1:1 preparation session - no previous context available'}

Create a focused self-preparation guide with these sections:

### My 1:1 Preparation Notes

#### Key Feedback Themes to Discuss
[2-3 main themes from the recent feedback analysis that I want to explore with my manager]

${previousContext ? `#### Updates from Previous 1:1
[What progress have I made on topics we discussed last time?]
- Action items I completed since our last meeting
- Challenges I encountered with previous goals
- Areas where I need continued support

#### Progress Review
[How have things changed since my last 1:1 preparation?]

` : ''}#### Questions I Want to Ask My Manager
1. [Question about growth opportunities based on current feedback]
2. [Question about priorities and expectations]
3. [Question about support needed for current challenges]
4. [Question about career development and next steps]
${previousContext ? '5. [Follow-up question about previous discussion topics]' : ''}

#### Topics I Want to Raise
- [Recent achievement or contribution to highlight]
- [Current challenge or roadblock to discuss]
- [Resource or support request based on feedback]
${previousContext ? '- [Update on previous topics or concerns raised]' : ''}

#### My Development Goals
[Based on feedback analysis and my career aspirations, what do I want to work on?]
${previousContext ? '[How do these build on or evolve from previous development goals?]' : ''}

#### Action Items to Propose
[Specific next steps I can suggest to address feedback and achieve my goals]
${previousContext ? '[Building on or modifying action items from previous 1:1]' : ''}

${previousContext ? `#### Continuity and Growth
[How this conversation builds on our previous 1:1 and shows my ongoing development]

#### Previous Goals Check-in
[Brief assessment of goals from last time - what worked, what didn't, what needs adjustment]

` : ''}#### Key Messages I Want to Convey
- [What I want my manager to understand about my current state]
- [How I'm taking ownership of my development]
${previousContext ? '- [Progress and growth since our last conversation]' : '- [My commitment to growth and improvement]'}

Write this in first person as self-preparation notes. Be specific and actionable. Base all suggestions on the ${feedbackCount} recent feedback responses analyzed. ${previousContext ? 'Show how this preparation builds on previous 1:1s to demonstrate continuous growth and development.' : ''}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.4
    });

    const markdownContent = completion.choices[0]?.message?.content || createPrepFallback(userContext, summary, previousContext);
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