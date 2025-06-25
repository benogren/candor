// app/api/generate-question/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Define types for the feedback response structure
interface FeedbackQuestion {
  question_text: string;
  question_type: string;
  question_subtype: string;
}

interface FeedbackResponse {
  feedback_questions: FeedbackQuestion | FeedbackQuestion[];
}

export async function POST(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const providerName = user.user_metadata.name;

    // Parse request body
    const requestData = await request.json();
    const { providerId, recipientId, recipientName, relationship, companyId } = requestData;

    console.log("CompanyId:", companyId);
    
    if (!providerId || !recipientId || !relationship || !companyId) {
      return NextResponse.json({ error: 'Missing required parameters', requestData }, { status: 400 });
    }
    
    // Extract relationship details for the prompt
    const { type, description } = relationship.relationship;

    // Get company information
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name, industry')
      .eq('id', companyId);

    let industrySpecific = "";
    let jobTitle = "";
    let industry = "";
    
    if (companyError || !companyData || companyData.length === 0) {
      industrySpecific = "Don't focus heavily on projects since not all companies use projects, try to focus on their personal growth and development. ";
    } else {
      industry = companyData[0].industry;
      industrySpecific = `
      The question should be industry specific, ${companyData[0].name} is in ${companyData[0].industry}. 
      Ask questions that are specific to how ${companyData[0].industry} businesses operate and the skills needed in their workforce. 
      `;

      // Get the recipient's job title
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('job_title')
        .eq('id', recipientId);

      if (userError || !userData || userData.length === 0) {
        // likely an invited user
        const { data: invitedUserData, error: invitedUserError } = await supabase
          .from('invited_users')
          .select('job_title')
          .eq('id', recipientId);

        if (invitedUserError || !invitedUserData || invitedUserData.length === 0) {
          jobTitle = "employee";
          industrySpecific += `${recipientName}'s job title is not available, focus on general skills and behaviors that are important for all employees working for a ${companyData[0].industry} business. `;
        } else {
          jobTitle = invitedUserData[0].job_title; 
          industrySpecific += `${recipientName}'s job title is ${jobTitle}, focus on skills and behaviors that are important for ${jobTitle} roles. `;
        }
      } else {
        jobTitle = userData[0].job_title;
        industrySpecific += `${recipientName}'s job title is ${jobTitle}, focus on skills and behaviors that are important for ${jobTitle} roles. `;
      }
    }

    // Fetch the last 4 feedback questions this recipient received
    const { data: recipientEntries, error: recipientEntriesError } = await supabase
      .from('feedback_recipients')
      .select('id')
      .eq('recipient_id', recipientId);

    let recentQuestionsContext = "";  
    if (!recipientEntriesError && recipientEntries && recipientEntries.length > 0) {
      const recipientIds = recipientEntries.map(r => r.id);

      const { data: recentFeedback, error: feedbackError } = await supabase
        .from('feedback_responses')
        .select(`
          feedback_questions!inner(question_text, question_type, question_subtype)
        `)
        .in('recipient_id', recipientIds)
        .order('created_at', { ascending: false })
        .limit(4);

      console.log("Recent feedback questions:", recentFeedback);

      if (!feedbackError && recentFeedback && recentFeedback.length > 0) {
        const recentQuestions = (recentFeedback as FeedbackResponse[]).map((r: FeedbackResponse) => {
          // Handle both array and object cases for the join
          const question = Array.isArray(r.feedback_questions) ? r.feedback_questions[0] : r.feedback_questions;
          return question?.question_text;
        }).filter(Boolean); // Remove any undefined values
        
        if (recentQuestions.length > 0) {
          recentQuestionsContext = `
          Here are the last ${recentQuestions.length} AI-generated questions ${recipientName} has received for context (DO NOT repeat these):
          ${recentQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
          
          Please generate questions that explore different aspects and avoid repeating these themes.
          `;
          console.log(`Found ${recentQuestions.length} recent AI questions for ${recipientName}`);
        }
      }

    } else {
      console.log(`No feedback recipient entries found for ${recipientName}:`, recipientEntriesError?.message || 'No entries');
    }

    // Fetch last feedback anaysis for this recipient
    const { data: recentAnalysis, error: feedbackAnalysis } = await supabase
      .from('weekly_feedback_analysis')
      .select(`feedback_received_summary`)
      .eq('user_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(1);

    let recentAnalysisContext = "";
    if (!feedbackAnalysis && recentAnalysis && recentAnalysis.length > 0) {
      recentAnalysisContext = `
      Here is the last feedback analysis for ${recipientName}:
      ${recentAnalysis[0].feedback_received_summary}
      
      Use this context to inform your questions.
      `;
    }
    
    // Create a tailored prompt based on the relationship
    let basePrompt = `Generate TWO feedback questions for ${providerName} to provide about a colleague named ${recipientName}. `;
    
    // Add relationship context
    basePrompt += `The relationship between ${providerName} and ${recipientName} is: ${description}. `;
    
    // Add specific guidance based on relationship type
    switch (type) {
      case 'manager-report':
        basePrompt += `As ${recipientName}'s manager, focus on themes like: leadership style, communication, delegation, goal setting, team collaboration, conflict resolution, feedback provision, motivation, development opportunities, and alignment with company values. `;
        break;
      case 'report-manager':
        basePrompt += `As someone who reports to ${recipientName}, focus on managerial skills like: leadership effectiveness, communication, delegation, decision-making, team development, coaching, emotional intelligence, and conflict resolution. `;
        break;
      case 'peer':
        basePrompt += `Even though they are peers, do not refer to their manager as to not add confusion on who the feedback is for. Focus on peer-to-peer skills like: collaboration, communication, teamwork, conflict resolution, and contributions to the team. `;
        break;
      case 'peer-with-boss':
        basePrompt += `Even though ${providerName}'s manager is a peer with ${recipientName}, ask a question without naming ${providerName}'s manager specifically as to not add confusion on who the feedback is for. 
        Since this is a cross-organization leaders, focus on themes like: communication, collaboration, influence, and strategic thinking`;
        break;
      case 'skip-level-manager':
        basePrompt += `As a skip-level to ${recipientName}, focus on themes like: leadership style, communication, decision-making, goal setting, motivation, development opportunities, and team dynamics. `;
        break;
      case 'skip-level-report':
        basePrompt += `As someone multiple levels below ${recipientName} in the organization, focus on leadership qualities like: Communication, Decision-Making, Team Management, Vision & Strategy, Development & Coaching, Leadership Effectiveness, emotional intelligence, and Organizational Alignment. `;
        break;
      default:
        // Default case for other relationship types
        basePrompt += `Ask about their professional contributions, teamwork, or impact on projects. `;
    }
    
    const fullPrompt = `${basePrompt}

    CONTEXT:
    ${recentQuestionsContext}

    ${recentAnalysisContext}

    ${industrySpecific}
    
    Generate questions that are:
    - Relevant to ${recipientName}'s strengths, weaknesses, and areas for improvement
    - Specific and thoughtful, directly addressing ${recipientName} by name
    - Appropriate for a professional setting
    - Focused on observable behaviors and actions rather than general traits
    - Clear and concise, avoiding vague or ambiguous language
    - Industry-appropriate for ${industry || 'the workplace'}

    You must provide TWO questions in your response:
    
    1. TEXT QUESTION: An open-ended question under 100 characters that ends with a question mark. This should encourage detailed, constructive feedback.
    
    2. RATING QUESTION: A question suitable for a 1-10 rating scale, under 100 characters that ends with a question mark. This should focus on a measurable aspect of performance or behavior.

    Format your response as JSON like this:
    {
      "text_question": {
        "question_text": "Your open-ended question here?",
        "question_description": "Guidance on how to answer this question..."
      },
      "rating_question": {
        "question_text": "Your rating question here?", 
        "question_description": "Guidance on how to answer this question... DO NOT include the scale in the description."
      }
    }
    
    Ensure the questions are different from each other, contextual to ${recipientName} and ${providerName}'s working relationship but still keeps anonymity, and explore different aspects of ${recipientName}'s performance.`;
    
    console.log("Generating questions with prompt:", fullPrompt);
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are a career coach who is an expert at crafting personalized professional 360-degree feedback questions that elicit thoughtful responses. You generate both open-ended text questions and rating-scale questions." 
        },
        { 
          role: "user", 
          content: fullPrompt 
        }
      ],
      store: true,
      metadata: {
        providerId,
        recipientId,
        relationship: type,
        companyId,
        industry,
        jobTitle,
      },
      temperature: 0.7,
      max_tokens: 300
    });
    
    const generatedContent = completion.choices[0]?.message?.content?.trim();
    
    if (!generatedContent) {
      throw new Error('Failed to generate questions');
    }

    // Parse the JSON response
    let questionData;
    try {
      questionData = JSON.parse(generatedContent);
      
      // Validate the response format
      if (!questionData.text_question || !questionData.rating_question) {
        throw new Error('Response missing required question types');
      }
      
      if (!questionData.text_question.question_text || !questionData.text_question.question_description ||
          !questionData.rating_question.question_text || !questionData.rating_question.question_description) {
        throw new Error('Response missing required fields');
      }
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.log('Raw response:', generatedContent);
      
      // Return an error instead of trying to parse non-JSON response
      return NextResponse.json(
        { 
          error: 'Failed to parse generated questions',
          details: 'OpenAI response was not in expected JSON format'
        },
        { status: 500 }
      );
    }

    // Clean up the responses
    const cleanTextQuestion = {
      question_text: questionData.text_question.question_text
        .replace(/^["']|["']$/g, '')
        .replace(/^Question: /i, '')
        .trim(),
      question_description: questionData.text_question.question_description
        .replace(/^["']|["']$/g, '')
        .trim()
    };

    const cleanRatingQuestion = {
      question_text: questionData.rating_question.question_text
        .replace(/^["']|["']$/g, '')
        .replace(/^Question: /i, '')
        .trim(),
      question_description: questionData.rating_question.question_description
        .replace(/^["']|["']$/g, '')
        .trim()
    };

    return NextResponse.json({ 
      text_question: cleanTextQuestion,
      rating_question: cleanRatingQuestion
    });
    
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}