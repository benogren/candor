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
    [key: string]: unknown;
  };
  created_at?: string;
  updated_at?: string;
  is_generating?: boolean;
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

  // Update the note with the generated content
  const { data, error } = await supabase
    .from('notes')
    .update({
      content: generatedContent,
      is_generating: false
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

// Helper function to get time period text
function getTimePeriodText(timeframe: string, isReview = false): string {
  if (isReview) {
    return 'over the past year';
  }
  
  switch (timeframe) {
    case 'week':
      return 'the past week';
    case 'month': 
      return 'the past month';
    default:
      return 'across all time periods';
  }
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

// Implementation for personal summary
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
    
    // Format feedback as JSON
    const formattedFeedback = formatFeedback(data.feedback_data, userName);
    
    // If there's no feedback content, return a message
    if (formattedFeedback === "[]") {
      return { summary: 'No feedback content available to summarize. We will generate a placeholder summary to help you get started.\n\n### Feedback Summary\n\nNo feedback data is available at this time. Check back later when feedback has been collected.' };
    }
    
    // Get time period text
    const timePeriodText = getTimePeriodText(timeframe);
    
    // Create prompt for OpenAI
    const prompt = `
    Take on the role of an experienced career coach specialising in analyzing 360-degree employee feedback.
      
      Below is feedback data for ${userName} in JSON format:
      Their current job title is: ${jobTitle}
      They work for: ${company}
      Industry: ${industry}
      This feedback was received ${timePeriodText}:
      
      The feedback is structured as JSON where each item contains:
      - "question": The feedback question asked
      - "type": Type of question (rating, text, values, ai)
      - "rating": Numeric rating (1-10) for rating questions
      - "response": Text response for open-ended questions  
      - "comment": Additional comments for rating questions
      - "company_value": Company value name for values nominations
      - "from": Name of feedback provider (when available)
      - "date": Date feedback was given

      ${formattedFeedback}
      
      Please provide a thoughtful, constructive summary of this feedback that includes:
      1. Major strengths identified in the feedback
      2. Areas for potential growth or improvement
      3. Patterns or themes across the feedback
      4. 2-3 specific, actionable recommendations based on the feedback
      
      Format your response in clear sections with meaningful headings. 
      Keep your response balanced, constructive, and growth-oriented. 
      Focus on patterns rather than individual comments and avoid unnecessarily harsh criticism.
      If provided, consider the individual's company and industry and focus on how companies within this industry operate; the type of work they do, the skills they need, and the challenges they face.
      If provided, consider the individual's job title and focus on how this role typically operates; the type of work they do, the skills they need, and the challenges they face.
      Your response should be written in 2nd person, ${userName} will be the recipient of this summary.

        Use the following format:  
        ### Feedback Summary:

        #### Major Strengths Identified in the Feedback
        1. [Strength 1]
        2. [Strength 2]
        3. [Strength 3]

        #### Areas for Potential Growth or Improvement
        1. [Area 1]
        2. [Area 2]
        3. [Area 3]

        #### Patterns or Themes Across the Feedback
        - [Pattern 1]
        - [Pattern 2]
        - [Pattern 3]

        #### Specific, Actionable Recommendations
        1. [Recommendation 1]
        2. [Recommendation 2]
        3. [Recommendation 3]
    `;
    
    // Call OpenAI API with streaming
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "Assume the role of a career coach. You are a helpful career coach providing feedback analysis. Your summaries are balanced, constructive, and actionable."
        },
        { 
          role: "user", 
          content: prompt
        }
      ],
      stream: true,
      max_tokens: 1000
    });

    let content = '';
    
    // Set a timeout for the entire streaming process
    const streamTimeout = setTimeout(() => {
      throw new Error("Streaming timed out after 45 seconds");
    }, 45000);
    
    try {
      for await (const chunk of completion) {
        content += chunk.choices[0]?.delta?.content || '';
      }
    } finally {
      clearTimeout(streamTimeout);
    }
    
    return { summary: content || "Unable to generate summary." };
  } catch (error) {
    console.error("Error in generatePersonalSummary:", error);
    return { 
      summary: "We encountered an issue while generating your feedback summary. Please try again later. If the problem persists, contact support." 
    };
  }
}

// Implementation for manager summary
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
    
    // Format feedback as JSON
    const formattedFeedback = formatFeedback(data.feedback_data, userName);
    
    // If there's no feedback content, return a message
    if (formattedFeedback === "[]") {
      return { summary: `No feedback content available to summarize for ${userName}. We will generate a placeholder summary to help you get started.\n\n### Feedback Summary\n\nNo feedback data is available for ${userName} at this time. Check back later when feedback has been collected.` };
    }
    
    // Get time period text
    const timePeriodText = getTimePeriodText(timeframe);
    
    // Create prompt for OpenAI
    const prompt = `
    Take on the role of an experienced career coach specialising in analyzing 360-degree employee feedback.
      
      Below is feedback data for ${userName} in JSON format:
      Their current job title is: ${jobTitle}
      They work for: ${company}
      Industry: ${industry}
      This feedback was received ${timePeriodText}:
      
      The feedback is structured as JSON where each item contains:
      - "question": The feedback question asked
      - "type": Type of question (rating, text, values, ai)
      - "rating": Numeric rating (1-10) for rating questions
      - "response": Text response for open-ended questions  
      - "comment": Additional comments for rating questions
      - "company_value": Company value name for values nominations
      - "from": Name of feedback provider (when available)
      - "date": Date feedback was given

      ${formattedFeedback}
      
      Please provide a thoughtful, constructive summary of this feedback that includes:
      1. Major strengths identified in the feedback
      2. Areas for potential growth or improvement
      3. Patterns or themes across the feedback
      4. 2-3 specific, actionable recommendations based on the feedback
      
      Format your response in clear sections with meaningful headings. 
      Keep your response balanced, constructive, and growth-oriented. 
      Focus on patterns rather than individual comments and avoid unnecessarily harsh criticism.
      If provided, consider the individual's company and industry and focus on how companies within this industry operate; the type of work they do, the skills they need, and the challenges they face.
      If provided, consider the individual's job title and focus on how this role typically operates; the type of work they do, the skills they need, and the challenges they face.
      Your response should be written in 2nd person, ${userName}'s manager ${managerName} will be the recipient of this summary.
      ${managerName} is a ${managerJobTitle} at ${company}.

        Use the following format:  
        ### Feedback Summary for ${userName}:

        #### Major Strengths Identified in the Feedback
        1. [Strength 1]
        2. [Strength 2]
        3. [Strength 3]

        #### Areas for Potential Growth or Improvement
        1. [Area 1]
        2. [Area 2]
        3. [Area 3]

        #### Patterns or Themes Across the Feedback
        - [Pattern 1]
        - [Pattern 2]
        - [Pattern 3]

        #### Specific, Actionable Recommendations
        1. [Recommendation 1]
        2. [Recommendation 2]
        3. [Recommendation 3]
    `;
    
    // Call OpenAI API with streaming
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "Assume the role of a career coach. You are a helpful career coach providing feedback analysis. Your summaries are balanced, constructive, and actionable."
        },
        { 
          role: "user", 
          content: prompt
        }
      ],
      stream: true,
      max_tokens: 1000
    });

    let content = '';
    
    const streamTimeout = setTimeout(() => {
      throw new Error("Streaming timed out after 45 seconds");
    }, 45000);
    
    try {
      for await (const chunk of completion) {
        content += chunk.choices[0]?.delta?.content || '';
      }
    } finally {
      clearTimeout(streamTimeout);
    }
    
    return { summary: content || "Unable to generate summary." };
  } catch (error) {
    console.error("Error in generateManagerSummary:", error);
    return { 
      summary: `We encountered an issue while generating the feedback summary. Please try again later. If the problem persists, contact support.` 
    };
  }
}

// Implementation for personal prep (using similar RPC pattern)
async function generatePersonalPrep(
  supabase: SupabaseClient,
  params: UserParams
): Promise<ContentResponse> {
  const { userId, timeframe } = params;
  
  try {
    const startDate = calculateStartDate(timeframe);
    const data = await fetchAllUserData(supabase, userId, undefined, startDate, false);
    const { userName, jobTitle, company, industry } = extractUserContext(data);
    const formattedFeedback = formatFeedback(data.feedback_data, userName);
    const timePeriodText = getTimePeriodText(timeframe);
    
    const prompt = `
    Take on the role of an experienced career coach specialising in one-on-one meeting preparation.
      
      Below is feedback data for ${userName} in JSON format:
      Their current job title is: ${jobTitle}
      They work for: ${company}
      Industry: ${industry}
      This feedback was received ${timePeriodText}:
      
      The feedback is structured as JSON where each item contains:
      - "question": The feedback question asked
      - "type": Type of question (rating, text, values, ai)
      - "rating": Numeric rating (1-10) for rating questions
      - "response": Text response for open-ended questions  
      - "comment": Additional comments for rating questions
      - "company_value": Company value name for values nominations
      - "from": Name of feedback provider (when available)
      - "date": Date feedback was given

      ${formattedFeedback}
      
      Generate a 1-on-1 meeting agenda focused on discussing the individual's strengths and areas for improvement, identifying any challenges, and exploring professional development opportunities for a ${jobTitle} in the ${industry} industry.
      
      Format your response in clear sections with meaningful headings. 
      ${userName} is the recipient of this agenda and they will use it to prepare for their 1:1 meeting with their manager, so write it in the 2nd person.

        Use the following format:  
        ### 1:1 Agenda

        #### Areas for Potential Growth or Improvement
        1. [Area 1]
            - [Question to ask your manager about this area]
        2. [Area 2]
            - [Question to ask your manager about this area]

        #### Challenges identified in Feedback
        - [Challenge 1]
            - [Question to ask your manager about this challenge]
        - [Challenge 2]
            - [Question to ask your manager about this challenge]

        #### Professional Development Opportunities
        1. [Opportunity 1]
            - [Question to ask your manager about this opportunity]
        2. [Opportunity 2]
            - [Question to ask your manager about this opportunity]

        #### Other Questions to Ask Your Manager
        1. [Question 1]
        2. [Question 2]
        3. [Question 3]
    `;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "Assume the role of a career coach. You are a helpful career coach providing excellent one-on-one meeting prep. Your meeting agendas are clear, concise, and actionable."
        },
        { 
          role: "user", 
          content: prompt
        }
      ],
      stream: true,
      max_tokens: 1000
    });

    let content = '';
    const streamTimeout = setTimeout(() => {
      throw new Error("Streaming timed out after 45 seconds");
    }, 45000);
    
    try {
      for await (const chunk of completion) {
        content += chunk.choices[0]?.delta?.content || '';
      }
    } finally {
      clearTimeout(streamTimeout);
    }
    
    return { prep: content || "Unable to generate meeting prep." };
  } catch (error) {
    console.error("Error in generatePersonalPrep:", error);
    return { 
      prep: "We encountered an issue while generating your meeting prep. Please try again later. If the problem persists, contact support." 
    };
  }
}

// Implementation for manager prep
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
    const formattedFeedback = formatFeedback(data.feedback_data, userName);
    const timePeriodText = getTimePeriodText(timeframe);
    
    const prompt = `
    Take on the role of an experienced career coach specialising in one-on-one meeting preparation.
      
      Below is feedback data for ${userName} in JSON format:
      Their current job title is: ${jobTitle}
      They work for: ${company}
      Industry: ${industry}
      This feedback was received ${timePeriodText}:

      The feedback is structured as JSON where each item contains:
      - "question": The feedback question asked
      - "type": Type of question (rating, text, values, ai)
      - "rating": Numeric rating (1-10) for rating questions
      - "response": Text response for open-ended questions  
      - "comment": Additional comments for rating questions
      - "company_value": Company value name for values nominations
      - "from": Name of feedback provider (when available)
      - "date": Date feedback was given
      
      ${formattedFeedback}
      
      Generate a 1-on-1 meeting agenda focused on discussing the individual's strengths and areas for improvement.
      
      ${userName}'s manager, ${managerName}, is the recipient of this agenda and they will use it to prepare for their 1:1 meeting with ${userName}, so write it in the 2nd person.
      ${managerName} is a ${managerJobTitle} at ${company}.

        Use the following format:  
        ### 1:1 Agenda

        #### Areas for Potential Growth or Improvement
        1. [Area 1]
            - [Question to ask your employee about this area]
        2. [Area 2]
            - [Question to ask your employee about this area]

        #### Challenges identified in Feedback
        - [Challenge 1]
            - [Question to ask your employee about this challenge]
        - [Challenge 2]
            - [Question to ask your employee about this challenge]

        #### Professional Development Opportunities
        1. [Opportunity 1]
            - [Question to ask your employee about this opportunity]
        2. [Opportunity 2]
            - [Question to ask your employee about this opportunity]

        #### Other Questions to Ask Your Employee
        1. [Question 1]
        2. [Question 2]
        3. [Question 3]
    `;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "Assume the role of a career coach. You are a helpful career coach providing excellent one-on-one meeting prep. Your meeting agendas are clear, concise, and actionable."
        },
        { 
          role: "user", 
          content: prompt
        }
      ],
      stream: true,
      max_tokens: 1000
    });

    let content = '';
    const streamTimeout = setTimeout(() => {
      throw new Error("Streaming timed out after 45 seconds");
    }, 45000);
    
    try {
      for await (const chunk of completion) {
        content += chunk.choices[0]?.delta?.content || '';
      }
    } finally {
      clearTimeout(streamTimeout);
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
    const formattedFeedback = formatFeedback(data.feedback_data, userName);
    const timePeriodText = getTimePeriodText(timeframe, true);
    
    const prompt = `
    Take on the role of an experienced career coach specialising in Performance Review meeting preparation.
      
      Below is feedback data for ${userName} in JSON format:
      Their current job title is: ${jobTitle}
      They work for: ${company}
      Industry: ${industry}
      This feedback was received ${timePeriodText}:

      The feedback is structured as JSON where each item contains:
      - "question": The feedback question asked
      - "type": Type of question (rating, text, values, ai)
      - "rating": Numeric rating (1-10) for rating questions
      - "response": Text response for open-ended questions  
      - "comment": Additional comments for rating questions
      - "company_value": Company value name for values nominations
      - "from": Name of feedback provider (when available)
      - "date": Date feedback was given
      
      ${formattedFeedback}
      
      Generate a comprehensive self-evaluation based on the feedback data. Focus on achievements, areas for improvement, and development goals.
      
      ${userName} is the recipient of this self reflection and they will use it to prepare for their career discussion with their manager.

        Use the following format:  
        ### Self-Evaluation

        Employee: ${userName}, ${jobTitle}
        Company: ${company}

        ----

        ### Feedback
        List feedback from the last year, including any notable achievements or contributions.

        #### Feedback Questions
        List 3 questions the employee should ask the manager to get feedback on their performance.

        ### Accomplishments
        List any accomplishments or contributions the employee made in the last year.

        ### Results
        List any results or outcomes from the employee's work in the last year.

        ### Overall Impact
        List the overall impact of the employee's work on the team or organization.

        ### What I have Learned
        List any lessons learned or skills developed in the last year.

        ### Obstacles
        List any obstacles or challenges the employee faced in the last year.

        ### Opportunities
        List any opportunities for the employee to grow or develop in the next year.

        ### Goals
        List the goals for the employee for the next year, including any specific projects or initiatives they should focus on.

        ### Decisions
        List any decisions that need to be made in the next year, including any specific projects or initiatives that need to be prioritized.

        ### Other Notes
    `;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "Assume the role of a career coach. You are a helpful career coach providing excellent career discussion meeting prep."
        },
        { 
          role: "user", 
          content: prompt
        }
      ],
      stream: true,
      max_tokens: 1000
    });

    let content = '';
    const streamTimeout = setTimeout(() => {
      throw new Error("Streaming timed out after 45 seconds");
    }, 45000);
    
    try {
      for await (const chunk of completion) {
        content += chunk.choices[0]?.delta?.content || '';
      }
    } finally {
      clearTimeout(streamTimeout);
    }
    
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
    const formattedFeedback = formatFeedback(data.feedback_data, userName);
    const timePeriodText = getTimePeriodText(timeframe, true);
    
    const prompt = `
    Take on the role of an experienced career coach specialising in Performance Review meeting preparation.
      
      Below is feedback data for ${userName} in JSON format:
      Their current job title is: ${jobTitle}
      They work for: ${company}
      Industry: ${industry}
      This feedback was received ${timePeriodText}:

      The feedback is structured as JSON where each item contains:
      - "question": The feedback question asked
      - "type": Type of question (rating, text, values, ai)
      - "rating": Numeric rating (1-10) for rating questions
      - "response": Text response for open-ended questions  
      - "comment": Additional comments for rating questions
      - "company_value": Company value name for values nominations
      - "from": Name of feedback provider (when available)
      - "date": Date feedback was given
      
      ${formattedFeedback}
      
      Generate a comprehensive performance review draft based on the feedback data.
      
      ${userName}'s manager, ${managerName}, is the recipient of this draft performance review and they will use it to prepare for their career discussion with ${userName}.
      ${managerName} is a ${managerJobTitle} at ${company}.

        Use the following format:  
        ### Performance Review

        Employee: ${userName}, ${jobTitle}
        Manager: ${managerName}, ${managerJobTitle}
        Company: ${company}

        ----

        ### Feedback
        List feedback from the last year, including any notable achievements or contributions.

        ### Obstacles
        List any obstacles or challenges the employee faced in the last year.

        ### Opportunities
        List any opportunities for the employee to grow or develop in the next year.

        ### Goals
        List the goals for the employee for the next year, including any specific projects or initiatives they should focus on.

        ### Decisions
        List any decisions that need to be made in the next year, including any specific projects or initiatives that need to be prioritized.

        ### Other Notes
    `;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "Assume the role of a career coach. You are a helpful career coach providing excellent one-on-one meeting prep."
        },
        { 
          role: "user", 
          content: prompt
        }
      ],
      stream: true,
      max_tokens: 1000
    });

    let content = '';
    const streamTimeout = setTimeout(() => {
      throw new Error("Streaming timed out after 45 seconds");
    }, 45000);
    
    try {
      for await (const chunk of completion) {
        content += chunk.choices[0]?.delta?.content || '';
      }
    } finally {
      clearTimeout(streamTimeout);
    }
    
    return { review: content || "Unable to generate review." };
  } catch (error) {
    console.error("Error in generateManagerReview:", error);
    return { 
      review: `We encountered an issue while generating the review. Please try again later. If the problem persists, contact support.` 
    };
  }
}