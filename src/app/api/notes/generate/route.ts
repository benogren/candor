// src/app/api/notes/generate/route.ts
import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { marked } from 'marked';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Track notes that are currently being generated to prevent duplicate processing
const activeGenerations = new Map<string, Promise<{ note: Note }>>();

// Request timeout in milliseconds (60 seconds)
const REQUEST_TIMEOUT = 60000;

// Define interfaces for better type safety
interface BaseParams {
  timeframe: string;
}

interface UserParams extends BaseParams {
  userId: string;
  type?: string;
}

interface ManagerParams extends BaseParams {
  managerId: string;
  employeeId: string;
  is_invited: boolean;
}

interface ContentResponse {
  summary?: string;
  prep?: string;
  review?: string;
  [key: string]: unknown;
}

// Interfaces for RPC response data
interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  job_title?: string;
  created_at?: string;
  updated_at?: string;
  avatar_url?: string;
  additional_data?: Record<string, unknown>;
  role?: string;
  company_id?: string;
  status?: string;
}

interface FormattedFeedbackItem {
  question: string;
  type: string;
  date: string | null;
  response?: string;
  rating?: number;
  comment?: string;
  company_value?: string;
  nominated?: boolean;
  from?: string;
}

interface CompanyInfo {
  id: string;
  name: string;
  industry?: string;
  created_at?: string;
  updated_at?: string;
  domains?: string[];
}

interface FeedbackQuestion {
  id: string;
  question_text: string;
  question_type: string;
  question_subtype?: string;
  question_description?: string;
  company_value_id?: string;
  company_values?: {
    icon?: string;
    description?: string;
  };
}

interface FeedbackSession {
  id: string;
  status: string;
  provider_id: string;
}

interface FeedbackRecipient {
  id: string;
  recipient_id: string;
  feedback_user_identities: {
    id: string;
    name?: string;
    email?: string;
  };
}

interface FeedbackResponseItem {
  id: string;
  recipient_id: string;
  rating_value?: number;
  text_response?: string;
  comment_text?: string;
  has_comment?: boolean;
  skipped: boolean;
  created_at?: string;
  updated_at?: string;
  session_id?: string;
  nominated_user_id?: string;
  feedback_questions: FeedbackQuestion;
  feedback_sessions: FeedbackSession;
  feedback_recipients: FeedbackRecipient;
  nominated_user?: {
    id: string;
    name?: string;
    email?: string;
  };
}

interface RPCResponse {
  user_profile: UserProfile;
  manager_profile?: UserProfile;
  company_info: CompanyInfo;
  feedback_data: FeedbackResponseItem[];
  metadata: {
    is_invited_user: boolean;
    query_executed_at: string;
    start_date_filter?: string;
    feedback_count: number;
  };
}

interface Note {
  id: string;
  title: string;
  content: string;
  content_type: string;
  creator_id: string;
  subject_member_id?: string;
  subject_invited_id?: string;
  metadata?: {
    timeframe?: string;
    start_date?: string;
    end_date?: string;
    feedback_count?: number;
    [key: string]: unknown;
  };
  created_at?: string;
  updated_at?: string;
  is_generating?: boolean;
}

interface ExistingSummary {
  id: string;
  content: string;
  metadata?: {
    timeframe?: string;
    start_date?: string;
    end_date?: string;
    feedback_count?: number;
  };
  created_at: string;
  updated_at: string;
}

// Main handler function
export async function POST(request: Request) {
  try {
    // Get the request body
    const body = await request.json();
    const { id } = body;

    console.log('Received generation request for note:', id);

    if (!id) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    // Check if this note is already being generated
    if (activeGenerations.has(id)) {
      console.log(`Note ${id} is already being generated, returning existing promise`);
      
      try {
        // Wait for the existing generation to complete
        const result = await activeGenerations.get(id);
        return NextResponse.json(result, { status: 200 });
      } catch (error) {
        // If the existing generation fails, we'll continue with a new one
        console.error('Error in existing generation:', error);
        activeGenerations.delete(id);
      }
    }

    // Create a new promise for this generation with timeout
    const generationPromiseWithTimeout = Promise.race([
      generateNote(request, id),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Generation request timed out')), REQUEST_TIMEOUT)
      )
    ]);
    
    // Store the promise
    activeGenerations.set(id, generationPromiseWithTimeout);
    
    // When the promise resolves or rejects, remove it from the map
    generationPromiseWithTimeout
      .then(result => {
        activeGenerations.delete(id);
        return result;
      })
      .catch(error => {
        activeGenerations.delete(id);
        throw error;
      });
    
    // Wait for the promise to resolve
    const result = await generationPromiseWithTimeout;
    console.log(`Generation completed for note: ${id}`);
    return NextResponse.json(result, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error generating note content:', errorMessage);
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  }
}

// Helper function containing the main note generation logic
async function generateNote(request: Request, id: string) {
  // Create Supabase client
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const bearerToken = authHeader.substring(7);
  
  // Create a direct database client that doesn't use cookies
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
  if (userError || !user) {
    throw new Error('Invalid token');
  }

  const { data: note, error: noteError } = await supabase
    .from('notes')
    .select('*')
    .eq('id', id)
    .eq('creator_id', user.id)
    .single() as { data: Note | null, error: Error | null };

  if (noteError) {
    console.error('Error fetching note:', noteError);
    throw new Error('Failed to fetch note');
  }
  if (!note) {
    throw new Error('Note not found');
  }

  // Check if this is a manager note (has subject_member_id or subject_invited_id)
  const isManagerNote = note.subject_member_id || note.subject_invited_id;
  const employeeId = note.subject_member_id || note.subject_invited_id;
  const isInvitedUser = !!note.subject_invited_id;
  const timeframe = note.metadata?.timeframe || 'all';

  let generatedContent = '';
  let contentData: ContentResponse = {};

  // Call the appropriate function based on content type
  if (note.content_type === 'summary') {
    if (isManagerNote && employeeId) {
      const params: ManagerParams = {
        managerId: user.id,
        employeeId,
        timeframe,
        is_invited: isInvitedUser
      };
      contentData = await generateManagerSummary(supabase, params);
    } else {
      const params: UserParams = {
        userId: user.id,
        timeframe,
        type: 'summary'
      };
      contentData = await generatePersonalSummary(supabase, params);
    }
  } else if (note.content_type === 'prep') {
    if (isManagerNote && employeeId) {
      const params: ManagerParams = {
        managerId: user.id,
        employeeId,
        timeframe,
        is_invited: isInvitedUser
      };
      contentData = await generateManagerPrep(supabase, params);
    } else {
      const params: UserParams = {
        userId: user.id,
        timeframe: note.metadata?.timeframe || 'week',
        type: 'prep'
      };
      contentData = await generatePersonalPrep(supabase, params);
    }
  } else if (note.content_type === 'review') {
    if (isManagerNote && employeeId) {
      const params: ManagerParams = {
        managerId: user.id,
        employeeId,
        timeframe,
        is_invited: isInvitedUser
      };
      contentData = await generateManagerReview(supabase, params);
    } else {
      const params: UserParams = {
        userId: user.id,
        timeframe,
        type: 'review'
      };
      contentData = await generatePersonalReview(supabase, params);
    }
  } else {
    throw new Error('Invalid content type');
  }
  
  // Format the response data based on content type
  if (note.content_type === 'summary') {
    const markdownContent = contentData.summary || '';
    const htmlContent = await marked.parse(markdownContent);
    generatedContent = htmlContent;
  } else if (note.content_type === 'prep') {
    const markdownContent = contentData.prep || '';
    const htmlContent = await marked.parse(markdownContent);
    generatedContent = htmlContent;
  } else if (note.content_type === 'review') {
    const markdownContent = contentData.review || '';
    const htmlContent = await marked.parse(markdownContent);
    generatedContent = htmlContent;
  }

  // Calculate date range for metadata
  const startDate = calculateStartDate(timeframe, note.content_type === 'review');
  const endDate = new Date();

  // Update the note with the generated content and enhanced metadata
  const { data, error } = await supabase
    .from('notes')
    .update({
      content: generatedContent,
      is_generating: false,
      metadata: {
        ...note.metadata,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        generated_at: new Date().toISOString()
      }
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { note: data };
}

// Optimized helper function to fetch all data using RPC
async function fetchAllUserData(
  supabase: SupabaseClient,
  targetId: string,
  managerId?: string,
  startDate?: Date,
  isInvited = false
): Promise<RPCResponse> {
  try {
    console.log(`Calling RPC for user ${targetId}, manager: ${managerId}, startDate: ${startDate?.toISOString()}, isInvited: ${isInvited}`);
    
    const { data, error } = await supabase.rpc('get_user_feedback_summary', {
      target_user_id: targetId,
      manager_user_id: managerId || null,
      start_date: startDate?.toISOString() || null,
      is_invited_user: isInvited
    });

    if (error) {
      console.error('RPC Error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from database');
    }

    console.log(`RPC returned ${data.feedback_data?.length || 0} feedback items`);
    return data as RPCResponse;
  } catch (error) {
    console.error("Error in fetchAllUserData:", error);
    throw error;
  }
}

// Function to find the previous week's 1:1 agenda for continuity
async function findPreviousWeek1on1(
  supabase: SupabaseClient,
  userId: string,
  targetUserId?: string
): Promise<ExistingSummary | null> {
  try {
    // Look for prep notes from 5-10 days ago (accounting for weekends and scheduling flexibility)
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000));
    const fiveDaysAgo = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000));
    
    console.log(`Looking for previous week's 1:1 prep between ${tenDaysAgo.toISOString()} and ${fiveDaysAgo.toISOString()}`);

    let query = supabase
      .from('notes')
      .select('id, content, metadata, created_at, updated_at')
      .eq('creator_id', userId)
      .eq('content_type', 'prep')
      .eq('is_generating', false)
      .not('content', 'is', null)
      .gte('created_at', tenDaysAgo.toISOString())
      .lte('created_at', fiveDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    // For manager prep, filter by subject
    if (targetUserId) {
      query = query.or(`subject_member_id.eq.${targetUserId},subject_invited_id.eq.${targetUserId}`);
    } else {
      // For personal prep, no subject
      query = query.is('subject_member_id', null).is('subject_invited_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching previous week 1:1:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log('No previous week 1:1 prep found');
      return null;
    }

    const previousPrep = data[0];
    console.log(`Found previous week's 1:1 prep from ${previousPrep.created_at}`);
    
    return {
      id: previousPrep.id,
      content: previousPrep.content,
      metadata: previousPrep.metadata,
      created_at: previousPrep.created_at,
      updated_at: previousPrep.updated_at
    };
  } catch (error) {
    console.error('Error in findPreviousWeek1on1:', error);
    return null;
  }
}

// Extract action items and key topics from previous 1:1 agenda
function extractPrevious1on1Context(previousPrep: ExistingSummary | null): string {
  if (!previousPrep) {
    return '';
  }

  // Convert HTML back to text for analysis
  const textContent = previousPrep.content
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  const date = new Date(previousPrep.created_at).toLocaleDateString();
  
  // Extract key sections that might contain action items or important topics
  const sections = textContent.split(/#{1,4}\s+/);
  const keyTopics = sections
    .filter(section => 
      section.length > 50 && ( // Only substantial sections
        section.toLowerCase().includes('development') || 
        section.toLowerCase().includes('challenge') || 
        section.toLowerCase().includes('project') ||
        section.toLowerCase().includes('goal') ||
        section.toLowerCase().includes('question') ||
        section.toLowerCase().includes('opportunity')
      )
    )
    .map(section => section.substring(0, 200).trim())
    .join(' ... ');

  return `PREVIOUS WEEK'S 1:1 AGENDA (${date}):\n${keyTopics || textContent.substring(0, 400)}...\n\nUse this context to provide continuity by following up on previous discussions, checking progress on action items, and building on topics that were covered. Reference previous conversations where relevant.\n\n`;
}

// Function to query existing summaries within relevant timeframe
async function findExistingSummaries(
  supabase: SupabaseClient,
  userId: string,
  targetUserId?: string,
  timeframe: string = 'all',
  contentType: string = 'summary'
): Promise<ExistingSummary[]> {
  try {
    // Calculate the relevant date range based on current generation timeframe
    const currentStartDate = calculateStartDate(timeframe, contentType === 'review');
    const currentEndDate = new Date();
    
    console.log(`Looking for existing ${contentType} summaries from ${currentStartDate.toISOString()} to ${currentEndDate.toISOString()}`);

    let query = supabase
      .from('notes')
      .select('id, content, metadata, created_at, updated_at')
      .eq('creator_id', userId)
      .eq('content_type', contentType)
      .eq('is_generating', false)
      .not('content', 'is', null)
      .order('created_at', { ascending: false });

    // For manager summaries, filter by subject
    if (targetUserId) {
      query = query.or(`subject_member_id.eq.${targetUserId},subject_invited_id.eq.${targetUserId}`);
    } else {
      // For personal summaries, no subject
      query = query.is('subject_member_id', null).is('subject_invited_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching existing summaries:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Filter summaries to only include those with relevant timeframes
    const relevantSummaries = data.filter(item => {
      // If metadata doesn't have start_date/end_date, check if it's recent enough to be relevant
      if (!item.metadata?.start_date || !item.metadata?.end_date) {
        // For summaries without date metadata, only include if created within the current timeframe
        const createdDate = new Date(item.created_at);
        return createdDate >= currentStartDate && createdDate <= currentEndDate;
      }

      const summaryStartDate = new Date(item.metadata.start_date);
      const summaryEndDate = new Date(item.metadata.end_date);

      // Check if there's any overlap between the summary's timeframe and current timeframe
      const hasOverlap = 
        (summaryStartDate <= currentEndDate && summaryEndDate >= currentStartDate) ||
        (summaryStartDate >= currentStartDate && summaryStartDate <= currentEndDate) ||
        (summaryEndDate >= currentStartDate && summaryEndDate <= currentEndDate);

      if (hasOverlap) {
        console.log(`Found relevant ${contentType} summary from ${summaryStartDate.toISOString()} to ${summaryEndDate.toISOString()}`);
      }

      return hasOverlap;
    })
    .slice(0, 3) // Limit to most recent 3 relevant summaries
    .map(item => ({
      id: item.id,
      content: item.content,
      metadata: item.metadata,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));

    console.log(`Found ${relevantSummaries.length} relevant existing summaries for ${contentType} generation`);
    return relevantSummaries;
  } catch (error) {
    console.error('Error in findExistingSummaries:', error);
    return [];
  }
}

// Extract insights from existing summaries with timeframe relevance
function extractInsightsFromExistingSummaries(summaries: ExistingSummary[]): string {
  if (!summaries || summaries.length === 0) {
    return '';
  }

  const insights = summaries.map(summary => {
    // Convert HTML back to text for analysis (simple approach)
    const textContent = summary.content
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Include timeframe information if available
    let timeframeInfo = '';
    if (summary.metadata?.start_date && summary.metadata?.end_date) {
      const startDate = new Date(summary.metadata.start_date).toLocaleDateString();
      const endDate = new Date(summary.metadata.end_date).toLocaleDateString();
      timeframeInfo = ` (${startDate} - ${endDate})`;
    } else {
      const date = new Date(summary.created_at).toLocaleDateString();
      timeframeInfo = ` (Generated: ${date})`;
    }

    // Extract key sections from the summary for more focused insights
    const sections = textContent.split(/#{1,4}\s+/);
    const keyInsights = sections
      .filter(section => 
        section.toLowerCase().includes('strength') || 
        section.toLowerCase().includes('improvement') || 
        section.toLowerCase().includes('recommendation') ||
        section.toLowerCase().includes('pattern') ||
        section.toLowerCase().includes('theme')
      )
      .map(section => section.substring(0, 200).trim())
      .join(' ... ');

    return `Previous Analysis${timeframeInfo}: ${keyInsights || textContent.substring(0, 250)}...`;
  }).join('\n\n');

  return `CONTEXT FROM RELEVANT PREVIOUS SUMMARIES:\n${insights}\n\nUse this context to identify patterns, track progress over time, and avoid repeating identical insights. Focus on new developments and changes since previous analyses.\n\n`;
}

// Two-stage processing function
async function generateWithTwoStages(
  feedback: FeedbackResponseItem[],
  userContext: { userName: string; jobTitle: string; company: string; industry: string },
  contentType: string,
  existingInsights: string = '',
  isManagerSummary: boolean = false,
  managerContext?: { managerName: string; managerJobTitle: string }
): Promise<string> {
  
  console.log(`Starting two-stage generation for ${contentType}, feedback items: ${feedback.length}`);
  
  // Stage 1: Extract key insights using faster model
  const stage1Prompt = `
    Analyze this feedback data and extract the most important insights:
    
    User: ${userContext.userName} (${userContext.jobTitle}) at ${userContext.company}
    ${existingInsights}
    
    Feedback Data (${feedback.length} items):
    ${formatFeedback(feedback, userContext.userName)}
    
    Extract and return ONLY:
    1. Top 3 Strengths (specific examples from feedback)
    2. Top 3 Areas for Improvement (specific examples)
    3. Key Themes/Patterns (2-3 recurring themes)
    4. Notable Feedback Quotes (2-3 impactful quotes)
    5. Rating Highlights (average scores and trends if available)
    6. Top 2 Specific Recommendations
    
    Be concise but specific. Focus on actionable insights that will help create a comprehensive ${contentType}.
  `;

  const stage1Completion = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Faster, cheaper model for analysis
    messages: [
      { 
        role: "system", 
        content: "You are an expert feedback analyzer. Extract key insights concisely and objectively." 
      },
      { role: "user", content: stage1Prompt }
    ],
    max_tokens: 600,
    temperature: 0.3
  });

  const keyInsights = stage1Completion.choices[0]?.message?.content || '';
  console.log('Stage 1 completed, extracted insights length:', keyInsights.length);

  // Stage 2: Generate final content using extracted insights
  const stage2Prompt = createStage2Prompt(
    keyInsights,
    userContext,
    contentType,
    existingInsights,
    isManagerSummary,
    managerContext
  );

  // console.log("*****Stage 2 prompt:", stage2Prompt);

  const stage2Completion = await openai.chat.completions.create({
    model: "gpt-4-turbo", // Higher quality model for final generation
    messages: [
      { 
        role: "system", 
        content: getSystemPromptForContentType(contentType)
      },
      { role: "user", content: stage2Prompt }
    ],
    stream: true,
    max_tokens: 1000,
    temperature: 0.4
  });

  let finalContent = '';
  const streamTimeout = setTimeout(() => {
    throw new Error("Stage 2 streaming timed out after 45 seconds");
  }, 45000);
  
  try {
    for await (const chunk of stage2Completion) {
      finalContent += chunk.choices[0]?.delta?.content || '';
    }
  } finally {
    clearTimeout(streamTimeout);
  }

  console.log('Stage 2 completed, final content length:', finalContent.length);
  return finalContent;
}

// Create stage 2 prompt based on content type
function createStage2Prompt(
  keyInsights: string,
  userContext: { userName: string; jobTitle: string; company: string; industry: string },
  contentType: string,
  existingInsights: string = '',
  isManagerSummary: boolean = false,
  managerContext?: { managerName: string; managerJobTitle: string }
): string {
  
  const recipient = isManagerSummary 
    ? `${userContext.userName}'s manager, ${managerContext?.managerName}` 
    : userContext.userName;

  if (contentType === 'summary') {
    return `
      Create a comprehensive feedback summary for ${userContext.userName} based on these key insights:
      
      ${keyInsights}
      
      Context:
      - ${userContext.userName} is a ${userContext.jobTitle} at ${userContext.company}
      - ${userContext.industry}
      - Recipient: ${recipient}
      
      Create a well-structured summary with these sections:
      
      ### Feedback Summary${isManagerSummary ? ` for ${userContext.userName}` : ''}:

      #### Major Strengths Identified in the Feedback
      1. [Strength 1 with specific examples]
      2. [Strength 2 with specific examples]
      3. [Strength 3 with specific examples]

      #### Areas for Potential Growth or Improvement
      1. [Area 1 with specific context]
      2. [Area 2 with specific context]
      3. [Area 3 with specific context]

      #### Patterns or Themes Across the Feedback
      - [Pattern 1]
      - [Pattern 2]
      - [Pattern 3]

      #### Specific, Actionable Recommendations
      1. [Recommendation 1]
      2. [Recommendation 2]
      3. [Recommendation 3]
      
      Write in 2nd person addressing ${recipient}. Be constructive, balanced, and growth-oriented.
    `;
  } else if (contentType === 'prep') {
    const hasPreviousWeekContext = existingInsights.includes('PREVIOUS WEEK');
    
    return `
      Create a 1:1 meeting agenda based on these key insights:
      
      ${keyInsights}
      
      Context:
      - ${userContext.userName} is a ${userContext.jobTitle} at ${userContext.company}
      - Recipient: ${recipient}
      - ${isManagerSummary ? `This is a manager's preparation for a 1:1 meeting with their employee, make this relevant to the manager` : `This is an employee's preparation for a 1:1 meeting with their manager, make this relevant to the employee and write it in the 1st person`}
      - Do not include Date/Time or Location sections, focus on discussion topics.
      
      ${existingInsights ? `IMPORTANT CONTEXT FROM PREVIOUS MEETINGS:\n${existingInsights}\n` : ''}
      
      Create a focused agenda that builds on previous discussions and follows up on action items:
      
      ### 1:1 Agenda

      ${hasPreviousWeekContext ? `
      #### Follow-up from Last Week\n- 
      [Follow-up item based on previous agenda]\n    
      - ${isManagerSummary ? `[Specific question  to ask your employee about their progress or outcomes]` : `[Share your progress or outcomes]`}
      - ${isManagerSummary ? `[Another follow-up topic to ask your employee]` : `[Another follow-up topic to share with your manager]`}  
      - ${isManagerSummary ? `[Another follow-up topic to ask your employee]` : `[Another follow-up topic to share with your manager]`}` : ''}

      #### Areas for Potential Growth or Improvement
      1. [Area 1]
          - [Question to ask ${isManagerSummary ? 'your employee' : 'your manager'} about this area]
      2. [Area 2]
          - [Question to ask ${isManagerSummary ? 'your employee' : 'your manager'} about this area]

      #### Challenges identified in Feedback
      - [Challenge 1]
          - [Question to ask ${isManagerSummary ? 'your employee' : 'your manager'} about this challenge]
      - [Challenge 2]
          - [Question to ask ${isManagerSummary ? 'your employee' : 'your manager'} about this challenge]

      #### Professional Development Opportunities
      1. [Opportunity 1]
          - [Related question to ask ${isManagerSummary ? 'your employee' : 'your manager'}]
      2. [Opportunity 2]
          - [Related question to ask ${isManagerSummary ? 'your employee' : 'your manager'}]

      #### Other Questions to Ask ${isManagerSummary ? 'Your Employee' : 'Your Manager'}
      1. [Question 1]
      2. [Question 2]
      3. [Question 3]
      
      ${hasPreviousWeekContext ? 'Focus on continuity: reference previous discussions, check progress on commitments, and build on topics from last week. ' : ''}Write actionable questions and talking points.
    `;
  } else if (contentType === 'review') {
    return `
      Create a performance review based on these key insights:
      
      ${keyInsights}
      
      Context:
      - ${userContext.userName} is a ${userContext.jobTitle} at ${userContext.company}
      - Recipient: ${recipient}
      - ${isManagerSummary ? `This is a manager's preformance review of their employee, make this relevant to the manager and write it in the 2nd person about the employee` : `This is an employee's self-reflection that they will share with their manager, make this relevant to the employee and write it in the 1st person`}
      
      Create a comprehensive review structure with actionable sections and relevant questions.
    `;
  }
  
  return keyInsights; // Fallback
}

// Get system prompt for content type
function getSystemPromptForContentType(contentType: string): string {
  if (contentType === 'summary') {
    return "You are an experienced career coach specializing in feedback analysis. Create balanced, constructive, and actionable summaries that help people grow professionally.";
  } else if (contentType === 'prep') {
    return "You are an experienced career coach specializing in 1:1 meeting preparation. Create clear, actionable agendas that facilitate productive conversations.";
  } else if (contentType === 'review') {
    return "You are an experienced career coach specializing in performance review preparation. Create comprehensive, fair, and development-focused reviews.";
  }
  
  return "You are a helpful career coach providing professional feedback analysis.";
}

// Generate a useful 1:1 agenda even when no feedback data is available
async function generateGeneric1on1Agenda(
  userContext: { userName: string; jobTitle: string; company: string; industry: string },
  isManagerPrep: boolean = false,
  existingInsights: string = '',
  managerContext?: { managerName: string; managerJobTitle: string }
): Promise<string> {
  
  const recipient = isManagerPrep 
    ? `${userContext.userName}'s manager, ${managerContext?.managerName}` 
    : userContext.userName;

  const hasPreviousWeekContext = existingInsights.includes('PREVIOUS WEEK');

  const prompt = `
    Create a productive 1:1 meeting agenda for ${userContext.userName}, a ${userContext.jobTitle} at ${userContext.company} ${userContext.industry}.
    
    ${existingInsights}
    
    Since no recent feedback data is available, create a comprehensive agenda focusing on standard 1:1 topics relevant to their role and industry.
    
    Context:
    - ${userContext.userName} is a ${userContext.jobTitle} at ${userContext.company}
    - ${userContext.industry}
    - Recipient: ${recipient}
    - ${isManagerPrep ? `This is a manager's preparation for a 1:1 meeting with their employee, make this relevant to the manager` : `This is an employee's preparation for a 1:1 meeting with their manager, make this relevant to the employee`}
    ${hasPreviousWeekContext ? '- IMPORTANT: Reference and follow up on items from the previous week\'s agenda' : ''}
    - Do not include Date/Time or Location sections, focus on discussion topics.
    
    Create an agenda that covers:
    
    ### 1:1 Agenda

    ${hasPreviousWeekContext ? `#### Follow-up from Last Week
    1. [Follow-up item based on previous agenda context]
        ${isManagerPrep ? `- [Question about employee's progress or outcomes from last week]` : `- [Share your progress or outcomes from last week]`}
    2. [Another follow-up topic from previous meeting]
        ${isManagerPrep ? `- [Check-in question about employee's progress or action items from last week]` : `- [Share your progress or outcomes from last week]`}

    ` : ''}#### Current Projects and Priorities
    1. [Key project or responsibility discussion point]
        - [Question to ask ${isManagerPrep ? 'your employee about their' : 'your manager about your'} current work]
    2. [Another priority area]
        - [Related question to ask ${isManagerPrep ? 'your employee about their' : 'your manager about your'} progress/challenges]

    #### Professional Development and Growth
    1. [Skill development opportunity relevant to their role]
        - [Question to ask ${isManagerPrep ? 'your employee about their' : 'your manager about your'} learning goals or interests]
    2. [Career progression topic]
        - [Question to ask ${isManagerPrep ? 'your employee about their' : 'your manager about your'} career aspirations or next steps]

    #### Challenges and Support Needed
    - [Common challenge for someone in their role/industry]
        - [Question to ask ${isManagerPrep ? 'your employee about their' : 'your manager about your'} obstacles or support needed]
    - [Resource or process improvement area]
        - [Question to ask ${isManagerPrep ? 'your employee about what would help them' : 'your manager about what would help you'} be more effective]

    #### Team and Collaboration
    1. [Team dynamics or collaboration topic]
        - [Question to ask ${isManagerPrep ? 'your employee about their' : 'your manager about your'} working relationships or team processes]
    2. [Communication or alignment topic]
        - [Question to ask ${isManagerPrep ? 'your employee what clarity or coordination they need from you' : 'your manager what clarity or coordination you need from them'}]

    #### Other Questions to Ask ${isManagerPrep ? 'Your Employee' : 'Your Manager'}
    ${isManagerPrep ? '1. [General check-in question about wellbeing or satisfaction]' : '1. [General check-in question]'}
    2. [Question about goals or objectives]
    3. [Question about feedback or recognition]
    
    ${hasPreviousWeekContext ? 'Focus on creating continuity with the previous meeting by following up on discussed topics and commitments. ' : ''}Make the agenda specific to their role (${userContext.jobTitle}) and industry context. Focus on actionable discussion topics that would be valuable for a productive 1:1 conversation.
  `;

  // console.log("*****Regular prompt:", prompt);

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      { 
        role: "system", 
        content: "You are an experienced career coach specializing in 1:1 meeting preparation. Create clear, actionable agendas that facilitate productive conversations and maintain continuity between meetings."
      },
      { role: "user", content: prompt }
    ],
    stream: true,
    max_tokens: 800,
    temperature: 0.4
  });

  let content = '';
  const streamTimeout = setTimeout(() => {
    throw new Error("Generic agenda generation timed out after 30 seconds");
  }, 30000);
  
  try {
    for await (const chunk of completion) {
      content += chunk.choices[0]?.delta?.content || '';
    }
  } finally {
    clearTimeout(streamTimeout);
  }

  return content;
}

// Helper function to format feedback as JSON
function formatFeedback(feedback: FeedbackResponseItem[], userName: string): string {
  if (!feedback || feedback.length === 0) {
    return "[]";
  }
  
  const jsonFeedback = feedback
    .filter(item => {
      // Only include items with actual content
      return item.text_response || item.rating_value || item.comment_text;
    })
    .map(item => {
      const questionText = item.feedback_questions?.question_text || 'Unknown question';
      const questionType = item.feedback_questions?.question_type || 'unknown';
      
      const feedbackItem: FormattedFeedbackItem = {
        question: questionText.replace(/\{name\}/g, userName),
        type: questionType,
        date: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : null
      };

      if (questionType === 'text' || questionType === 'ai') {
        feedbackItem.response = item.text_response || '';
      }

      if (questionType === 'rating') {
        feedbackItem.rating = item.rating_value;
        if (item.comment_text) {
          feedbackItem.comment = item.comment_text;
        }
      }

      if (questionType === 'values') {
        feedbackItem.company_value = item.feedback_questions?.question_description || '';
        feedbackItem.nominated = true;
      }

      // Add provider info if available
      if (item.feedback_recipients?.feedback_user_identities?.name) {
        feedbackItem.from = item.feedback_recipients.feedback_user_identities.name;
      }

      return feedbackItem;
    });

  return JSON.stringify(jsonFeedback, null, 2);
}

// Helper function to extract user context from RPC response
function extractUserContext(data: RPCResponse): {
  userName: string;
  jobTitle: string;
  company: string;
  industry: string;
} {
  const user = data.user_profile;
  const company = data.company_info;
  
  return {
    userName: user?.name || 'User',
    jobTitle: user?.job_title ? `They're a ${user.job_title}` : '',
    company: company?.name ? `They work at ${company.name}` : '',
    industry: company?.industry ? `in the ${company.industry} industry.` : ''
  };
}

// Function to calculate start date based on timeframe
function calculateStartDate(timeframe: string, isReview = false): Date {
  const today = new Date();
  const startDate = new Date();

  if (isReview) {
    startDate.setMonth(today.getMonth() - 12);
    return startDate;
  }

  if (timeframe === 'week') {
    startDate.setDate(today.getDate() - 7);
  } else if (timeframe === 'month') {
    startDate.setMonth(today.getMonth() - 1);
  } else {
    return new Date(2000, 0, 1); // Default to very old date for 'all'
  }

  return startDate;
}

// Implementation for personal summary with two-stage processing
async function generatePersonalSummary(
  supabase: SupabaseClient,
  params: UserParams
): Promise<ContentResponse> {
  const { userId, timeframe } = params;
  
  try {
    // Calculate start date for feedback query
    const startDate = calculateStartDate(timeframe);
    
    // Get all data using RPC
    const data = await fetchAllUserData(supabase, userId, undefined, startDate, false);
    
    // Extract context from RPC response
    const { userName, jobTitle, company, industry } = extractUserContext(data);
    
    // Check for existing summaries to leverage insights
    const existingSummaries = await findExistingSummaries(supabase, userId, undefined, timeframe, 'summary');
    const existingInsights = extractInsightsFromExistingSummaries(existingSummaries);
    
    // If there's no feedback content, return a message
    if (!data.feedback_data || data.feedback_data.length === 0) {
      return { summary: 'No feedback content available to summarize. We will generate a placeholder summary to help you get started.\n\n### Feedback Summary\n\nNo feedback data is available at this time. Check back later when feedback has been collected.' };
    }
    
    console.log(`Generating personal summary for ${userName}, ${data.feedback_data.length} feedback items, ${existingSummaries.length} existing summaries`);
    
    // Use two-stage processing
    const content = await generateWithTwoStages(
      data.feedback_data,
      { userName, jobTitle, company, industry },
      'summary',
      existingInsights,
      false
    );
    
    return { summary: content || "Unable to generate summary." };
  } catch (error) {
    console.error("Error in generatePersonalSummary:", error);
    return { 
      summary: "We encountered an issue while generating your feedback summary. Please try again later. If the problem persists, contact support." 
    };
  }
}

// Implementation for manager summary with two-stage processing
async function generateManagerSummary(
  supabase: SupabaseClient,
  params: ManagerParams
): Promise<ContentResponse> {
  const { managerId, employeeId, timeframe, is_invited } = params;
  
  try {
    // Calculate start date for feedback query
    const startDate = calculateStartDate(timeframe);
    
    // Get all data using RPC
    const data = await fetchAllUserData(supabase, employeeId, managerId, startDate, is_invited);
    
    // Extract context from RPC response
    const { userName, jobTitle, company, industry } = extractUserContext(data);
    const managerName = data.manager_profile?.name || 'Manager';
    const managerJobTitle = data.manager_profile?.job_title || 'Manager';
    
    // Check for existing summaries for this employee
    const existingSummaries = await findExistingSummaries(supabase, managerId, employeeId, timeframe, 'summary');
    const existingInsights = extractInsightsFromExistingSummaries(existingSummaries);
    
    // If there's no feedback content, return a message
    if (!data.feedback_data || data.feedback_data.length === 0) {
      return { summary: `No feedback content available to summarize for ${userName}. We will generate a placeholder summary to help you get started.\n\n### Feedback Summary\n\nNo feedback data is available for ${userName} at this time. Check back later when feedback has been collected.` };
    }
    
    console.log(`Generating manager summary for ${userName} by ${managerName}, ${data.feedback_data.length} feedback items, ${existingSummaries.length} existing summaries`);
    
    // Use two-stage processing
    const content = await generateWithTwoStages(
      data.feedback_data,
      { userName, jobTitle, company, industry },
      'summary',
      existingInsights,
      true,
      { managerName, managerJobTitle }
    );
    
    return { summary: content || "Unable to generate summary." };
  } catch (error) {
    console.error("Error in generateManagerSummary:", error);
    return { 
      summary: `We encountered an issue while generating the feedback summary. Please try again later. If the problem persists, contact support.` 
    };
  }
}

// Implementation for personal prep (using two-stage processing with previous week context)
async function generatePersonalPrep(
  supabase: SupabaseClient,
  params: UserParams
): Promise<ContentResponse> {
  const { userId, timeframe } = params;
  
  try {
    const startDate = calculateStartDate(timeframe);
    const data = await fetchAllUserData(supabase, userId, undefined, startDate, false);
    const { userName, jobTitle, company, industry } = extractUserContext(data);
    
    // Get previous week's 1:1 agenda for continuity
    const previousWeek1on1 = await findPreviousWeek1on1(supabase, userId);
    const previous1on1Context = extractPrevious1on1Context(previousWeek1on1);
    
    // Check for existing prep notes (excluding the previous week we just found)
    const existingSummaries = await findExistingSummaries(supabase, userId, undefined, timeframe, 'prep');
    const existingInsights = extractInsightsFromExistingSummaries(existingSummaries);
    
    // Combine all context
    const fullContext = previous1on1Context + existingInsights;
    
    let content: string;
    
    if (!data.feedback_data || data.feedback_data.length === 0) {
      // Generate agenda with previous week context even when no new feedback is available
      content = await generateGeneric1on1Agenda({
        userName,
        jobTitle,
        company,
        industry
      }, false, fullContext);
    } else {
      // Use two-stage processing with feedback data and previous week context
      content = await generateWithTwoStages(
        data.feedback_data,
        { userName, jobTitle, company, industry },
        'prep',
        fullContext,
        false
      );
    }
    
    return { prep: content || "Unable to generate meeting prep." };
  } catch (error) {
    console.error("Error in generatePersonalPrep:", error);
    return { 
      prep: "We encountered an issue while generating your meeting prep. Please try again later. If the problem persists, contact support." 
    };
  }
}

// Implementation for manager prep with previous week context
async function generateManagerPrep(
  supabase: SupabaseClient,
  params: ManagerParams
): Promise<ContentResponse> {
  const { managerId, employeeId, timeframe, is_invited } = params;
  
  try {
    const startDate = calculateStartDate(timeframe);
    const data = await fetchAllUserData(supabase, employeeId, managerId, startDate, is_invited);
    const { userName, jobTitle, company, industry } = extractUserContext(data);
    const managerName = data.manager_profile?.name || 'Manager';
    const managerJobTitle = data.manager_profile?.job_title || 'Manager';
    
    // Get previous week's 1:1 agenda for this employee
    const previousWeek1on1 = await findPreviousWeek1on1(supabase, managerId, employeeId);
    const previous1on1Context = extractPrevious1on1Context(previousWeek1on1);
    
    // Check for existing prep notes (excluding the previous week we just found)
    const existingSummaries = await findExistingSummaries(supabase, managerId, employeeId, timeframe, 'prep');
    const existingInsights = extractInsightsFromExistingSummaries(existingSummaries);
    
    // Combine all context
    const fullContext = previous1on1Context + existingInsights;
    
    let content: string;
    
    if (!data.feedback_data || data.feedback_data.length === 0) {
      // Generate a general manager 1:1 agenda with previous week context
      content = await generateGeneric1on1Agenda({
        userName,
        jobTitle,
        company,
        industry
      }, true, fullContext, { managerName, managerJobTitle });
    } else {
      // Use two-stage processing with feedback data and previous week context
      content = await generateWithTwoStages(
        data.feedback_data,
        { userName, jobTitle, company, industry },
        'prep',
        fullContext,
        true,
        { managerName, managerJobTitle }
      );
    }
    
    return { prep: content || "Unable to generate meeting prep." };
  } catch (error) {
    console.error("Error in generateManagerPrep:", error);
    return { 
      prep: `We encountered an issue while generating the meeting prep. Please try again later. If the problem persists, contact support.` 
    };
  }
}

// Implementation for personal review
async function generatePersonalReview(
  supabase: SupabaseClient,
  params: UserParams
): Promise<ContentResponse> {
  const { userId, timeframe } = params;
  
  try {
    const startDate = calculateStartDate(timeframe, true);
    const data = await fetchAllUserData(supabase, userId, undefined, startDate, false);
    const { userName, jobTitle, company, industry } = extractUserContext(data);
    
    const existingSummaries = await findExistingSummaries(supabase, userId, undefined, timeframe, 'review');
    const existingInsights = extractInsightsFromExistingSummaries(existingSummaries);
    
    if (!data.feedback_data || data.feedback_data.length === 0) {
      return { review: 'No feedback available to create review prep. Check back when feedback has been collected.' };
    }
    
    const content = await generateWithTwoStages(
      data.feedback_data,
      { userName, jobTitle, company, industry },
      'review',
      existingInsights,
      false
    );
    
    return { review: content || "Unable to generate review." };
  } catch (error) {
    console.error("Error in generatePersonalReview:", error);
    return { 
      review: "We encountered an issue while generating your review. Please try again later. If the problem persists, contact support." 
    };
  }
}

// Implementation for manager review
async function generateManagerReview(
  supabase: SupabaseClient,
  params: ManagerParams
): Promise<ContentResponse> {
  const { managerId, employeeId, timeframe, is_invited } = params;
  
  try {
    const startDate = calculateStartDate(timeframe, true);
    const data = await fetchAllUserData(supabase, employeeId, managerId, startDate, is_invited);
    const { userName, jobTitle, company, industry } = extractUserContext(data);
    const managerName = data.manager_profile?.name || 'Manager';
    const managerJobTitle = data.manager_profile?.job_title || 'Manager';
    
    const existingSummaries = await findExistingSummaries(supabase, managerId, employeeId, timeframe, 'review');
    const existingInsights = extractInsightsFromExistingSummaries(existingSummaries);
    
    if (!data.feedback_data || data.feedback_data.length === 0) {
      return { review: `No feedback available to create review for ${userName}. Check back when feedback has been collected.` };
    }
    
    const content = await generateWithTwoStages(
      data.feedback_data,
      { userName, jobTitle, company, industry },
      'review',
      existingInsights,
      true,
      { managerName, managerJobTitle }
    );
    
    return { review: content || "Unable to generate review." };
  } catch (error) {
    console.error("Error in generateManagerReview:", error);
    return { 
      review: `We encountered an issue while generating the review. Please try again later. If the problem persists, contact support.` 
    };
  }
}