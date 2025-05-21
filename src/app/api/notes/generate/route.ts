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

// Request timeout in milliseconds (30 seconds)
const REQUEST_TIMEOUT = 30000;

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

// Define interfaces for Supabase data
interface CompanyValue {
  icon?: string;
  description?: string;
}

interface FeedbackQuestion {
  id: string;
  question_text: string;
  question_type: string;
  question_subtype?: string;
  question_description?: string;
  company_value_id?: string;
  company_values?: CompanyValue;
}

interface FeedbackUserIdentity {
  id: string;
  name?: string;
  email?: string;
}

interface FeedbackRecipient {
  id: string;
  recipient_id: string;
  feedback_user_identities: FeedbackUserIdentity;
}

interface FeedbackSession {
  id: string;
  status: string;
  provider_id: string;
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
  feedback_questions?: FeedbackQuestion;
  feedback_sessions?: FeedbackSession;
  feedback_recipients?: FeedbackRecipient;
  nominated_user?: FeedbackUserIdentity;
}

interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  job_title?: string;
  created_at?: string;
  updated_at?: string;
  avatar_url?: string;
  additional_data?: Record<string, unknown>;
}

interface Company {
  id: string;
  name: string;
  industry?: string;
  created_at?: string;
  updated_at?: string;
  domains?: string[];
}

interface CompanyData {
  company_id?: string;
  companies?: Company | Company[];
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

interface InvitedUser {
  id: string;
  name?: string;
  email: string;
  job_title?: string;
  role?: string;
  company_id?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
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

// Helper function to fetch feedback data - shared across all generators
async function fetchFeedbackData(
  supabase: SupabaseClient,
  targetId: string,
  startDate: Date
): Promise<FeedbackResponseItem[]> {
  try {
    // Check if the user is a recipient
    console.log("Fetching feedback data for user:", targetId);

    const { data: recipientData, error: recipientError } = await supabase
      .from('feedback_recipients')
      .select('id')
      .eq('recipient_id', targetId);
    
    if (recipientError) {
      console.error("Error fetching recipient data:", recipientError);
      return []; // Return empty array instead of throwing
    }
    
    if (!recipientData || recipientData.length === 0) {
      console.log("No recipient data found for user:", targetId);
      return []; // Return empty array if no data
    }

    const recipientIds = recipientData.map(r => r.id);

    // Fetch feedback responses
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('feedback_responses')
      .select(`
      *,
      feedback_questions!inner(
          id,
          question_text,
          question_type,
          question_subtype,
          question_description,
          company_value_id,
          company_values(
          icon,
          description
          )
      ),
      feedback_sessions!inner(
          id,
          status,
          provider_id
      ),
      feedback_recipients!inner(
          id,
          recipient_id,
          feedback_user_identities!inner(
          id,
          name,
          email
          )
      ),
      nominated_user:feedback_user_identities(
          id,
          name,
          email
      )
      `)
      .in('recipient_id', recipientIds)
      .eq('skipped', false)
      .eq('feedback_sessions.status', 'completed')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });
      
    if (feedbackError) {
      console.error("Error fetching feedback data:", feedbackError);
      return []; // Return empty array instead of throwing
    }

    console.log("Number of feedback responses:", feedbackData?.length || 0);
    
    return feedbackData || [];
  } catch (error) {
    console.error("Unexpected error in fetchFeedbackData:", error);
    return []; // Return empty array for any unexpected errors
  }
}

// Helper function to get user details
async function getUserDetails(
  supabase: SupabaseClient, 
  userId: string, 
  isInvited = false
): Promise<{ userName: string; jobTitle: string }> {
  let userName = '';
  let jobTitle = '';

  try {
    if (isInvited) {
      const { data, error } = await supabase
        .from('invited_users')
        .select('name, job_title')
        .eq('id', userId) as { data: InvitedUser[] | null, error: Error | null };

      if (!error && data && data.length > 0) {
        jobTitle = data[0].job_title ? `They're a ${data[0].job_title}` : '';
        userName = data[0].name || 'Unknown User';
      }
    } else {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('name, job_title')
        .eq('id', userId) as { data: UserProfile[] | null, error: Error | null };

      if (!error && data && data.length > 0) {
        jobTitle = data[0].job_title ? `They're a ${data[0].job_title}` : '';
        userName = data[0].name || 'Unknown User';
      }
    }
  } catch (error) {
    console.error("Error in getUserDetails:", error);
    // Don't throw - use default values
  }

  return { userName: userName || 'User', jobTitle: jobTitle || '' };
}

// Helper function to get company details
async function getCompanyDetails(
  supabase: SupabaseClient, 
  userId: string
): Promise<{ company: string; industry: string }> {
  let company = '';
  let industry = '';

  try {
    const { data } = await supabase
      .from('company_members')
      .select(`
        company_id,
        companies!inner(id, name, industry)
      `)
      .eq('id', userId)
      .single() as { data: CompanyData | null };

    if (data) {
      const companyObject = Array.isArray(data.companies) 
        ? data.companies[0] 
        : data.companies;

      if (companyObject && companyObject.name) {
        company = `They work at ${companyObject.name}`;
        industry = companyObject.industry ? `in the ${companyObject.industry} industry.` : '';
      }
    }
  } catch (error) {
    console.log('Error fetching company data:', error);
    // Don't throw - use default values
  }

  return { company, industry };
}

// Helper function to format feedback
function formatFeedback(feedback: FeedbackResponseItem[], userName: string): string {
  if (!feedback || feedback.length === 0) {
    return "No feedback data available.";
  }
  
  return feedback.map(item => {
    let questionText = item.feedback_questions?.question_text || 'Unknown question';
    const questionType = item.feedback_questions?.question_type || 'unknown';
    
    let responseText = '';
    
    if (questionType === 'text' || questionType === 'ai') {
      responseText = item.text_response || '';
    }

    if (questionType === 'rating') {
      responseText = `Rating: ${item.rating_value}/10`;

      if (item.comment_text) {
        responseText += ` - Comment: ${item.comment_text}`;
      }
    } 

    if (questionType === 'values') {
      questionText += `: ${item.feedback_questions?.question_description || ''}`;
      responseText += `${userName} was nominated for this company value`;
    }
    
    return `
    Question: 
    ${questionText.replace(/\{name\}/g, userName)}
    Response: 
    ${responseText}
    `;
  }).join('\n');
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
    
    // Get feedback data
    const feedback = await fetchFeedbackData(supabase, userId, startDate);
    
    // Get user details
    const { userName, jobTitle } = await getUserDetails(supabase, userId);
    
    // Get company details
    const { company, industry } = await getCompanyDetails(supabase, userId);
    
    // Format feedback
    const formattedFeedback = formatFeedback(feedback, userName);
    
    // If there's no feedback content, return a message
    if (!formattedFeedback.trim() || formattedFeedback === "No feedback data available.") {
      return { summary: 'No feedback content available to summarize. We will generate a placeholder summary to help you get started.\n\n### Feedback Summary\n\nNo feedback data is available at this time. Check back later when feedback has been collected.' };
    }
    
    // Get time period text
    const timePeriodText = getTimePeriodText(timeframe);
    
    // Create prompt for OpenAI
    const prompt = `
    Take on the role of an experienced career coach specialising in analyzing 360-degree employee feedback.
      
      Below is a collection of feedback for ${userName}.
      Their current job title is: ${jobTitle}
      They work for: ${company}
      Industry: ${industry}
      This feedback was received ${timePeriodText}:
      
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
      Your reponse should be written in 2nd person, ${userName} will be the recipient of this summary.

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
    
    // Call OpenAI API
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
    
    // Get feedback data
    const feedback = await fetchFeedbackData(supabase, employeeId, startDate);
    
    // Get employee details
    const { userName, jobTitle } = await getUserDetails(supabase, employeeId, is_invited);
    
    // Get manager details
    const { userName: managerName, jobTitle: managerJobTitle } = await getUserDetails(supabase, managerId);
    
    // Get company details
    const { company, industry } = await getCompanyDetails(supabase, employeeId);
    
    // Format feedback
    const formattedFeedback = formatFeedback(feedback, userName);
    
    // If there's no feedback content, return a message
    if (!formattedFeedback.trim() || formattedFeedback === "No feedback data available.") {
      return { summary: `No feedback content available to summarize for ${userName}. We will generate a placeholder summary to help you get started.\n\n### Feedback Summary\n\nNo feedback data is available for ${userName} at this time. Check back later when feedback has been collected.` };
    }
    
    // Get time period text
    const timePeriodText = getTimePeriodText(timeframe);
    
    // Create prompt for OpenAI
    const prompt = `
    Take on the role of an experienced career coach specialising in analyzing 360-degree employee feedback.
      
      Below is a collection of feedback for ${userName}.
      Their current job title is: ${jobTitle}
      They work for: ${company}
      Industry: ${industry}
      This feedback was received ${timePeriodText}:
      
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
      Your reponse should be written in 2nd person, ${userName}'s manager ${managerName} will be the recipient of this summary.
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
    
    // Call OpenAI API
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
      summary: `We encountered an issue while generating the feedback summary for ${params.employeeId}. Please try again later. If the problem persists, contact support.` 
    };
  }
}

// Implementation for personal prep
async function generatePersonalPrep(
  supabase: SupabaseClient,
  params: UserParams
): Promise<ContentResponse> {
  const { userId, timeframe } = params;
  
  try {
    // Calculate start date for feedback query
    const startDate = calculateStartDate(timeframe);
    
    // Get feedback data
    const feedback = await fetchFeedbackData(supabase, userId, startDate);
    
    // Get user details
    const { userName, jobTitle } = await getUserDetails(supabase, userId);
    
    // Get company details
    const { company, industry } = await getCompanyDetails(supabase, userId);
    
    // Format feedback
    const formattedFeedback = formatFeedback(feedback, userName);
    
    // Get time period text
    const timePeriodText = getTimePeriodText(timeframe);
    
    // Create prompt for OpenAI
    const prompt = `
    Take on the role of an experienced career coach specialising in one-on-one meeting preperation.
      
      Below is a collection of feedback for ${userName}.
      Their current job title is: ${jobTitle}
      They work for: ${company}
      Industry: ${industry}
      This feedback was received ${timePeriodText}:
      
      ${formattedFeedback}
      
      Steps:
      1.) If provided, please summarize the feedback in a way that highlights the individual's strengths and areas for improvement.
      2.) Generate a 1-on-1 meeting agenda focused on discussing the individual's strengths and areas for improvement, identifying any challenges, and exploring professional development opportunities for a ${jobTitle} in the ${industry} industry.
      
      Format your response in clear sections with meaningful headings. 
      If provided, consider the individual's company and industry and focus on how companies within this industry operate; the type of work they do, the skills they need, and the challenges they face.
      If provided, consider the individual's job title and focus on how this role typically operates; the type of work they do, the skills they need, and the challenges they face.
      ${userName} is the recipient of this agenda and they will use it to prepare for their 1:1 meeting with their manager, so write it in the 2nd person.
      Suggest things they should ask their manager about, and things they should be prepared to discuss.
      You do not need an Introduction section.

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
        - [Challenge 3]
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
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "Assume the role of a career coach. You are a helpful career coach providing excellent one-on-one meeting prep. Your meeting agendas are clear, concise, and actionable. You are an expert in the field of career coaching and have a deep understanding of various industries and job roles."
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
    
    return { prep: content || "Unable to generate 1:1 prep." };
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
    // Calculate start date for feedback query
    const startDate = calculateStartDate(timeframe);
    
    // Get feedback data
    const feedback = await fetchFeedbackData(supabase, employeeId, startDate);
    
    // Get employee details
    const { userName, jobTitle } = await getUserDetails(supabase, employeeId, is_invited);
    
    // Get manager details
    const { userName: managerName, jobTitle: managerJobTitle } = await getUserDetails(supabase, managerId);
    
    // Get company details
    const { company, industry } = await getCompanyDetails(supabase, employeeId);
    
    // Format feedback
    const formattedFeedback = formatFeedback(feedback, userName);
    
    // Get time period text
    const timePeriodText = getTimePeriodText(timeframe);
    
    // Create prompt for OpenAI
    const prompt = `
    Take on the role of an experienced career coach specialising in one-on-one meeting preperation.
      
      Below is a collection of feedback for ${userName}.
      Their current job title is: ${jobTitle}
      They work for: ${company}
      Industry: ${industry}
      This feedback was received ${timePeriodText}:
      
      ${formattedFeedback}
      
      Steps:
      1.) If provided, please summarize the feedback in a way that highlights the individual's strengths and areas for improvement.
      2.) Generate a 1-on-1 meeting agenda focused on discussing the individual's strengths and areas for improvement, identifying any challenges, and exploring professional development opportunities for a ${jobTitle} in the ${industry} industry.
      
      Format your response in clear sections with meaningful headings. 
      If provided, consider the individual's company and industry and focus on how companies within this industry operate; the type of work they do, the skills they need, and the challenges they face.
      If provided, consider the individual's job title and focus on how this role typically operates; the type of work they do, the skills they need, and the challenges they face.
      ${userName}'s manager, ${managerName}, is the recipient of this agenda and they will use it to prepare for their 1:1 meeting with ${userName}, so write it in the 2nd person.
      ${managerName} is a ${managerJobTitle} at ${company}.
      Suggest things they should ask their employee about, and things they should be prepared to discuss.
      You do not need an Introduction section.

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
        - [Challenge 3]
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
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "Assume the role of a career coach. You are a helpful career coach providing excellent one-on-one meeting prep. Your meeting agendas are clear, concise, and actionable. You are an expert in the field of career coaching and have a deep understanding of various industries and job roles."
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
    
    return { prep: content || "Unable to generate 1:1 prep." };
  } catch (error) {
    console.error("Error in generateManagerPrep:", error);
    return { 
      prep: `We encountered an issue while generating the meeting prep for ${params.employeeId}. Please try again later. If the problem persists, contact support.` 
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
    // Calculate start date for feedback query
    const startDate = calculateStartDate(timeframe, true);
    
    // Get feedback data
    const feedback = await fetchFeedbackData(supabase, userId, startDate);
    
    // Get user details
    const { userName, jobTitle } = await getUserDetails(supabase, userId);
    
    // Get company details
    const { company, industry } = await getCompanyDetails(supabase, userId);
    
    // Format feedback
    const formattedFeedback = formatFeedback(feedback, userName);
    
    // Get time period text
    const timePeriodText = getTimePeriodText(timeframe, true);
    
    // Create prompt for OpenAI
    const prompt = `
    Take on the role of an experienced career coach specialising in Performance Review meeting preperation.
      
      Below is a collection of feedback for ${userName}.
      Their current job title is: ${jobTitle}
      They work for: ${company}
      Industry: ${industry}
      This feedback was received ${timePeriodText}:
      
      ${formattedFeedback}
      
      Steps:
      1.) List the key achievements of ${userName} ${timePeriodText}, focusing on contributions to projects, and any notable innovations or solutions they provided.
      2.) Based on the feedback and performance data for ${userName}, identify three areas for improvement that align with our team goals and their personal development plan.‍
      3.) Generate constructive feedback for ${userName} regarding their time management skills, incorporating examples from the last quarter and suggestions for improvement.
      4.) What are the top three strengths of ${userName} as demonstrated in their recent projects, and how have these strengths positively impacted our team's performance?
      5.) Propose three SMART goals for ${userName} for the next review period that focus on leveraging their strengths identified in step 4 and addressing their improvement areas you identified in step 3.
      6.) Reviewing the feedback given, analyze ${userName}'s contribution to team dynamics and collaboration over the past year, including any leadership roles or initiatives they undertook to enhance team cohesion.
      7.) Reviewing the feedback given, provide examples of how ${userName} demonstrated exceptional problem-solving skills, especially in dealing with challenges or projects, and suggest ways to further develop these skills.
      8.) Reviewing the feedback given, create a paragraph acknowledging ${userName}'s exceptional contributions to their projects or team, highlighting their innovative approaches and the value added to the team.
      9.) Compose a set of open-ended questions to facilitate a development discussion with ${userName}'s manager, focusing on their career aspirations, feedback on the team environment, and how management can support their growth.
      10.) Review all of the previous steps and performance feedback for ${userName} and make edits to minimize bias, ensuring the language is neutral and focuses on specific behaviors and outcomes.

      
      Format your response in clear sections with meaningful headings. 
      If provided, consider the individual's company and industry and focus on how companies within this industry operate; the type of work they do, the skills they need, and the challenges they face.
      If provided, consider the individual's job title and focus on how this role typically operates; the type of work they do, the skills they need, and the challenges they face.
      ${userName} is the recipient of this self reflection and they will use it to prepare for their career discussion with their manager, so write it in the 2nd person.
      Suggest things they should ask their manager about, and things they should be prepared to discuss.
      You do not need an Introduction section.

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

        #### Accomplishments Questions
        List 3 questions the employee should ask the manager about their accomplishments.

        ### Results
        List any results or outcomes from the employee's work in the last year.

        #### Results Questions
        List 3 questions the employee should ask the manager about their results.

        ### Overall Impact
        List the overall impact of the employee's work on the team or organization.

        #### Overall Impact Questions
        List 3 questions the employee should ask the manager about their overall impact.

        ### What I have Learned
        List any lessons learned or skills developed in the last year.

        ### Obstacles
        List any obstacles or challenges the employee faced in the last year.

        #### Obstacles Questions
        List 3 questions the employee should ask the manager about their obstacles.

        ### Opportunities
        List any opportunities for the employee to grow or develop in the next year.

        #### Opportunities Questions
        List 3 questions the employee should ask the manager about their opportunities for growth.

        ### Goals
        List the goals for the employee for the next year, including any specific projects or initiatives they should focus on. Examples: What were my short-term and long-term goals? What are my future goals?

        #### Goals Questions
        List 3 questions the employee should ask the manager about their goals for the next year.

        ### Decisions
        List any decisions that need to be made in the next year, including any specific projects or initiatives that need to be prioritized. Examples: What are my priorities? What steps can I take before next review?

        ### Other Notes
    `;

    console.log("Sending Prompt to OpenAI:", prompt.slice(0, 500)); // Log the first 500 characters of the prompt for debugging
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "Assume the role of a career coach. You are a helpful career coach providing excellent career discussion meeting prep. Your self evaluations are clear, concise, and actionable. You are an expert in the field of career coaching and have a deep understanding of various industries and job roles."
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
        console.log("Received chunk from OpenAI:", chunk.choices[0]?.delta?.content); // Log the chunk for debugging
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
    // Calculate start date for feedback query
    const startDate = calculateStartDate(timeframe, true);
    
    // Get feedback data
    const feedback = await fetchFeedbackData(supabase, employeeId, startDate);
    
    // Get employee details
    const { userName, jobTitle } = await getUserDetails(supabase, employeeId, is_invited);
    
    // Get manager details
    const { userName: managerName, jobTitle: managerJobTitle } = await getUserDetails(supabase, managerId);
    
    // Get company details
    const { company, industry } = await getCompanyDetails(supabase, employeeId);
    
    // Format feedback
    const formattedFeedback = formatFeedback(feedback, userName);
    
    // Get time period text
    const timePeriodText = getTimePeriodText(timeframe, true);
    
    // Create prompt for OpenAI
    const prompt = `
    Take on the role of an experienced career coach specialising in Performance Review meeting preperation.
      
      Below is a collection of feedback for ${userName}.
      Their current job title is: ${jobTitle}
      They work for: ${company}
      Industry: ${industry}
      This feedback was received ${timePeriodText}:
      
      ${formattedFeedback}
      
      Steps:
      1.) List the key achievements of ${userName} ${timePeriodText}, focusing on contributions to projects, and any notable innovations or solutions they provided.
      2.) Based on the feedback and performance data for ${userName}, identify three areas for improvement that align with our team goals and their personal development plan.‍
      3.) Generate constructive feedback for ${userName} regarding their time management skills, incorporating examples from the last quarter and suggestions for improvement.
      4.) What are the top three strengths of ${userName} as demonstrated in their recent projects, and how have these strengths positively impacted our team's performance?
      5.) Propose three SMART goals for ${userName} for the next review period that focus on leveraging their strengths identified in step 4 and addressing their improvement areas you identified in step 3.
      6.) Reviewing the feedback given, analyze ${userName}'s contribution to team dynamics and collaboration over the past year, including any leadership roles or initiatives they undertook to enhance team cohesion.
      7.) Reviewing the feedback given, provide examples of how ${userName} demonstrated exceptional problem-solving skills, especially in dealing with challenges or projects, and suggest ways to further develop these skills.
      8.) Reviewing the feedback given, create a paragraph acknowledging ${userName}'s exceptional contributions to their projects or team, highlighting their innovative approaches and the value added to the team.
      9.) Compose a set of open-ended questions to facilitate a development discussion with ${userName}, focusing on their career aspirations, feedback on the team environment, and how management can support their growth.
      10.) Review all of the previous steps and performance feedback for ${userName} and make edits to minimize bias, ensuring the language is neutral and focuses on specific behaviors and outcomes.

      
      Format your response in clear sections with meaningful headings. 
      If provided, consider the individual's company and industry and focus on how companies within this industry operate; the type of work they do, the skills they need, and the challenges they face.
      If provided, consider the individual's job title and focus on how this role typically operates; the type of work they do, the skills they need, and the challenges they face.
      ${userName}'s manager, ${managerName}, is the recipient of this draft performance review and they will use it to prepare for their career discussion with ${userName}, so write it in the 2nd person.
      ${managerName} is a ${managerJobTitle} at ${company}.
      Suggest things they should ask their employee about, and things they should be prepared to discuss.
      You do not need an Introduction section.

        Use the following format:  
        ### Performance Review

        Employee: ${userName}, ${jobTitle}
        Manager: ${managerName}, ${managerJobTitle}
        Company: ${company}

        ----

        ### Feedback
        List feedback from the last year, including any notable achievements or contributions.

        #### Feedback Questions
        List 3 questions the manager should ask the employee to get feedback on their performance. Examples: How have things gone since our last conversation?

        ### Obstacles
        List any obstacles or challenges the employee faced in the last year.

        #### Obsticles Questions
        List 3 questions the manager should ask the employee about the challenges they faced in the past year. Examples: What is impeding our progress? What can you do? What can I do to help?

        ### Opportunities
        List any opportunities for the employee to grow or develop in the next year.

        #### Opportunities Questions
        List 3 questions the manager should ask the employee about their opportunities for growth. Examples: What are you proud of that your co-workers don't know about? Do you feel you're growing toward your goals? How can we help you to make this your dream job?

        ### Goals
        List the goals for the employee for the next year, including any specific projects or initiatives they should focus on. Examples: What were our short-term and long-term goals? What are our future goals?

        #### Goals Questions
        List 3 questions the manager should ask the employee about their goals for the next year.

        ### Decisions
        List any decisions that need to be made in the next year, including any specific projects or initiatives that need to be prioritized. Examples: What decisions do we need to make? What are our priorities? What steps can we take before next review?

        ### Other Notes
    `;
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "Assume the role of a career coach. You are a helpful career coach providing excellent one-on-one meeting prep. Your meeting agendas are clear, concise, and actionable. You are an expert in the field of career coaching and have a deep understanding of various industries and job roles."
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
      review: `We encountered an issue while generating the review for ${params.employeeId}. Please try again later. If the problem persists, contact support.` 
    };
  }
}