// src/app/api/notes/generate/summary/route.ts
import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface FeedbackSummaryRequest {
  userId: string;
  employeeId?: string; // For manager summaries
  timeframe: string;
  isInvited?: boolean;
}

interface FeedbackItem {
  id: string;
  text_response?: string;
  comment_text?: string;
  rating_value?: number;
  created_at: string;
  feedback_questions?: {
    question_text: string;
    question_type: string;
    question_subtype?: string;
  };
  feedback_recipients?: {
    feedback_user_identities?: {
      name?: string;
      email?: string;
    };
  };
  nominated_user?: {
    name?: string;
    email?: string;
  };
}

interface UserContext {
  userName: string;
  jobTitle: string;
  company: string;
  industry: string;
}

interface RPCResponse {
  user_profile: {
    id: string;
    name?: string;
    job_title?: string;
    email: string;
  };
  company_info: {
    name?: string;
    industry?: string;
  };
  feedback_data: FeedbackItem[];
  metadata: {
    feedback_count: number;
    is_invited_user: boolean;
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as FeedbackSummaryRequest;
    const { userId, employeeId, timeframe, isInvited = false } = body;

    console.log('=== Stage 1: Starting feedback analysis ===');
    console.log('Target user:', employeeId || userId, 'Timeframe:', timeframe);

    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bearerToken = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get data using RPC function with 30 second timeout
    const dataPromise = fetchFeedbackDataWithRPC(
      supabase, 
      employeeId || userId, 
      timeframe, 
      isInvited,
      userId // manager ID for context
    );
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Data fetch timeout')), 30000)
    );

    const data = await Promise.race([dataPromise, timeoutPromise]);

    if (!data.feedback || data.feedback.length === 0) {
      return NextResponse.json({
        success: true,
        summary: `No recent feedback available for analysis in the ${timeframe} timeframe.`,
        userContext: data.userContext,
        feedbackCount: 0
      });
    }

    // Analyze with OpenAI (20 second timeout)
    console.log(`Analyzing ${data.feedback.length} feedback items with AI...`);
    
    const analysisPromise = analyzeWithAI(data.feedback, data.userContext);
    const aiTimeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('AI analysis timeout')), 20000)
    );

    try {
      const summary = await Promise.race([analysisPromise, aiTimeoutPromise]);
      
      console.log('=== Stage 1: Analysis complete ===');
      return NextResponse.json({
        success: true,
        summary,
        userContext: data.userContext,
        feedbackCount: data.feedback.length
      });
    } catch (aiError) {
      console.error('AI analysis failed:', aiError);
      // Fallback to basic summary
      const basicSummary = createBasicSummary(data.feedback, data.userContext);
      return NextResponse.json({
        success: true,
        summary: basicSummary,
        userContext: data.userContext,
        feedbackCount: data.feedback.length,
        usedFallback: true
      });
    }

  } catch (error) {
    console.error('Stage 1 error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze feedback' }, 
      { status: 500 }
    );
  }
}

async function fetchFeedbackDataWithRPC(
  supabase: SupabaseClient, 
  targetUserId: string, 
  timeframe: string,
  isInvited: boolean,
  managerUserId?: string
) {
  console.log('Fetching feedback data using RPC function...');
  
  // Calculate date range
  const startDate = calculateStartDate(timeframe);
  
  console.log(`Calling RPC with params:`, {
    target_user_id: targetUserId,
    manager_user_id: managerUserId || null,
    start_date: startDate.toISOString(),
    is_invited_user: isInvited
  });

  // Use the RPC function to get all data in one call
  const { data: rpcResult, error } = await supabase.rpc('get_user_feedback_summary', {
    target_user_id: targetUserId,
    manager_user_id: managerUserId || null,
    start_date: startDate.toISOString(),
    is_invited_user: isInvited
  });

  if (error) {
    console.error('RPC Error:', error);
    throw new Error(`Failed to fetch feedback data: ${error.message}`);
  }

  if (!rpcResult) {
    throw new Error('No data returned from RPC function');
  }

  console.log(`RPC returned ${rpcResult.metadata?.feedback_count || 0} feedback items`);

  const result = rpcResult as RPCResponse;

  // Build user context from RPC response
  const userContext: UserContext = {
    userName: result.user_profile?.name || 'User',
    jobTitle: result.user_profile?.job_title || 'Team Member',
    company: result.company_info?.name || 'Company',
    industry: result.company_info?.industry || 'Unknown Industry'
  };

  // Process feedback data
  const feedback = result.feedback_data || [];
  
  // Filter out items without meaningful content
  const meaningfulFeedback = feedback.filter(item => 
    (item.text_response && item.text_response.trim().length > 0) ||
    (item.comment_text && item.comment_text.trim().length > 0) ||
    (item.rating_value && item.rating_value > 0)
  );

  console.log(`Filtered to ${meaningfulFeedback.length} meaningful feedback items`);

  return {
    userContext,
    feedback: meaningfulFeedback
  };
}

async function analyzeWithAI(feedback: FeedbackItem[], userContext: UserContext): Promise<string> {
  // Separate text feedback and ratings
  const textFeedback = feedback
    .filter(item => item.text_response || item.comment_text)
    .map(item => {
      const text = item.text_response || item.comment_text;
      const from = item.feedback_recipients?.feedback_user_identities?.name || 'Colleague';
      const question = item.feedback_questions?.question_text || 'General feedback';
      return `From ${from} (${question}): ${text}`;
    });

  const ratings = feedback
    .filter(item => item.rating_value && item.rating_value > 0)
    .map(item => {
      const question = item.feedback_questions?.question_text || 'Rating';
      const from = item.feedback_recipients?.feedback_user_identities?.name || 'Colleague';
      return `${question} (from ${from}): ${item.rating_value}/5`;
    });

  // If no meaningful feedback, return early
  if (textFeedback.length === 0 && ratings.length === 0) {
    return `**FEEDBACK ANALYSIS FOR ${userContext.userName.toUpperCase()}**

No substantive feedback available for analysis in the selected timeframe.`;
  }

  const prompt = `Analyze this feedback for ${userContext.userName} (${userContext.jobTitle}) at ${userContext.company}:

FEEDBACK RESPONSES (${textFeedback.length} responses):
${textFeedback.join('\n\n')}

RATINGS (${ratings.length} ratings):
${ratings.join('\n')}

Create a comprehensive analysis with these sections:

**STRENGTHS IDENTIFIED:**
- List top 3 specific strengths with examples from the feedback

**AREAS FOR IMPROVEMENT:**
- List top 3 areas with specific examples from feedback

**KEY THEMES & PATTERNS:**
- Identify 2-3 recurring themes across all feedback

**NOTABLE QUOTES:**
- Include 2-3 most impactful direct quotes from the feedback (if any)

**QUANTITATIVE INSIGHTS:**
- Summary of rating patterns and averages (if ratings provided)

**SPECIFIC RECOMMENDATIONS:**
- 3 actionable recommendations based on the feedback

Be specific, constructive, and focus on actionable insights. Base everything on the actual feedback provided. If limited feedback is available, acknowledge this in your analysis.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { 
        role: "system", 
        content: "You are an expert feedback analyst. Provide detailed, actionable insights based on the feedback data. Always be honest about the amount and quality of data available."
      },
      { role: "user", content: prompt }
    ],
    max_tokens: 1000,
    temperature: 0.3
  });

  return completion.choices[0]?.message?.content || 'Unable to analyze feedback.';
}

function createBasicSummary(feedback: FeedbackItem[], userContext: UserContext): string {
  const textFeedback = feedback.filter(item => item.text_response || item.comment_text);
  const ratingFeedback = feedback.filter(item => item.rating_value && item.rating_value > 0);
  
  const avgRating = ratingFeedback.length > 0 
    ? (ratingFeedback.reduce((sum, item) => sum + (item.rating_value || 0), 0) / ratingFeedback.length).toFixed(1)
    : 'N/A';

  return `**FEEDBACK ANALYSIS FOR ${userContext.userName.toUpperCase()}**

**OVERVIEW:**
- Total feedback responses: ${feedback.length}
- Text responses: ${textFeedback.length}
- Rating responses: ${ratingFeedback.length}
- Average rating: ${avgRating}/5

**SAMPLE FEEDBACK:**
${textFeedback.slice(0, 3).map((item, index) => {
  const text = item.text_response || item.comment_text || '';
  const from = item.feedback_recipients?.feedback_user_identities?.name || 'Colleague';
  return `${index + 1}. From ${from}: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`;
}).join('\n')}

**RECOMMENDATIONS:**
1. Continue building on demonstrated strengths
2. Focus on areas identified for development  
3. Seek regular feedback for continuous improvement

*This analysis was generated from available feedback data. AI analysis was unavailable.*`;
}

function calculateStartDate(timeframe: string): Date {
  const today = new Date();
  const startDate = new Date();

  switch (timeframe) {
    case 'week':
      startDate.setDate(today.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(today.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(today.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(today.getFullYear() - 1);
      break;
    default: // 'all'
      startDate.setFullYear(today.getFullYear() - 1); // Go back 2 years for 'all'
      break;
  }

  return startDate;
}