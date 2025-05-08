// src/app/api/feedback/manager/prep/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    // Get the request body
    const body = await request.json();
    const { managerId, employeeId, timeframe, is_invited } = body;
    
    // Basic validation
    if (!managerId || !employeeId || !timeframe) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }
    
    // Create Supabase client
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const bearerToken = authHeader.substring(7);
    
    // Create a direct database client that doesn't use cookies
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
    if (userError || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    interface UserRelationship {
        type: string;
        description: string;
        distance: number;
    }

    interface RelationshipResponse {
        relationship: UserRelationship;
        users: {
          user1: {
            id: string;
            name: string;
            email: string;
            role: string;
          };
          user2: {
            id: string;
            name: string;
            email: string;
            role: string;
          };
        };
      }

    // Check if the user is a recipient
    const { data: recipientData, error: recipientError } = await supabase
        .from('feedback_recipients')
        .select('id')
        .eq('recipient_id', employeeId);
    
    if (recipientError || recipientData.length === 0) throw recipientError;

    const recipientIds = (recipientData || []).map(r => r.id);

    // Now get feedback responses for these recipients, joining with questions
    const today = new Date();
    let startDate = new Date();

    if (timeframe === 'week') {
        // Last week's feedback
        startDate.setDate(today.getDate() - 7);
    } else if (timeframe === 'month') {
        // Last month's feedback
        startDate.setMonth(today.getMonth() - 1);
    } else {
        // All feedback - use a very old date
        startDate = new Date(2000, 0, 1);
    }

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
        .eq('feedback_sessions.status', 'completed') // dont show in progress answers
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
        
    if (feedbackError) throw feedbackError;

    const feedback = feedbackData || [];

    // console.log(feedback);

    let userName = '';
    let jobTitle = '';

    if (is_invited) {
        const { data: invitedUserData, error: invitedUserError } = await supabase
        .from('invited_users')
        .select('name, job_title')
        .eq('id', employeeId);

        if (invitedUserError || !invitedUserData || invitedUserData.length === 0) {
            jobTitle = ''; //not found
        } else {
            jobTitle = `They're a ${invitedUserData[0].job_title}`;
        }
        userName = invitedUserData?.[0]?.name || 'Unknown User';
    } else {
        const { data: jobData, error: jobError } = await supabase
        .from('user_profiles')
        .select('name, job_title')
        .eq('id', employeeId);

        if (jobError || !jobData || jobData.length === 0) {
            jobTitle = ''; //not found
        } else {
            jobTitle = `They're a ${jobData[0].job_title}`;
        }
        userName = jobData?.[0]?.name || 'Unknown User';
    } 

    const { data: managerData, error: managerError } = await supabase
      .from('user_profiles')
      .select('name, job_title')
      .eq('id', managerId);

    let managerJobTitle = '';
    if (managerError || !managerData || managerData.length === 0) {
        managerJobTitle = ''; //not found
    } else {
        managerJobTitle = `They're a ${managerData[0].job_title}`;
    }

    const managerName = managerData?.[0]?.name || 'Unknown Manager';

    let company = '';
    let industry = '';

    try {
        // Fetch company and industry information
        const { data: companyData} = await supabase
        .from('company_members')
        .select(`
            company_id,
            companies!inner(id, name, industry)
            `)
            .eq('id', employeeId)
            .single();

            const companyObject = Array.isArray(companyData?.companies) 
              ? companyData.companies[0] 
              : companyData?.companies;

            company = `They work at ${companyObject?.name}`;
            industry = `in the ${companyObject?.industry} industry.`;
    } catch (error) {
        // not found
    }

    // console.log('Feedback data:', feedback);    

    // Prepare feedback for summarization
    const formattedFeedback = feedback.map(item => {

      let questionText = item.feedback_questions?.question_text || 'Unknown question';
      const questionType = item.feedback_questions?.question_type || 'unknown';
      
      let responseText = '';
      
      if (questionType === 'text' || questionType === 'ai') {
        responseText = item.text_response;
      }

      if (questionType === 'rating') {
        responseText = `Rating: ${item.rating_value}/10`;

        if (item.comment_text) {
          responseText += ` - Comment: ${item.comment_text}`;
        }
      } 

      if (questionType === 'values') {
        questionText += `: ${item.feedback_questions.question_description}`;
        responseText += `${userName} was nominated for this company value`
      }
      
      return `
      Question: 
      ${questionText.replace(/\{name\}/g, userName)}
      Response: 
      ${responseText}
      `;
    }).join('\n');
    
    // If there's no feedback content, ...
    if (!formattedFeedback.trim()) {
    //   return NextResponse.json(
    //     { summary: 'No feedback content available to summarize.' },
    //     { status: 200 }
    //   );
    }
    
    // Determine time period for prompt
    let timePeriodText = '';
    switch (timeframe) {
      case 'week':
        timePeriodText = 'the past week';
        break;
      case 'month': 
        timePeriodText = 'the past month';
        break;
      default:
        timePeriodText = 'across all time periods';
    }
    
    // Create the prompt for OpenAI

    // const prompt = `
    // ${timePeriodText} (${startDate.toISOString()} - ${today.toISOString()})
    // formatted feedback:
    // ${formattedFeedback}
    // `;
    

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

    // console.log('Prompt:', prompt);
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo", // You may want to use a different model based on your needs
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
      max_tokens: 1000
    });
    
    const prep = completion.choices[0]?.message?.content || "Unable to generate summary.";

    // console.log('Summary:', prep);

//     const summary = `### Feedback Summary: ing or Tools**: Enroll in a workshop or explore tools that can help enhance your responsiveness and reliability. This training can offer methods to manage and prioritize communications effectively, ensuring you remain accessible to your team's needs.

// These recommendations aim to harness your existing strengths while addressing areas that can elevate your role as Director of Operations at Initech. The focus on efficiency and responsiveness, coupled with your demonstrated leadership skills, should further solidify your effectiveness and career growth within the company.`;
    
    // Store the summary in the database for future reference
    // TO DO: this will error if the user is an invited user...
    const { error: insertError } = await supabase
      .from('manager_feedback_summaries')
      .insert({
        manager_id: managerId,
        employee_id: employeeId,
        timeframe: timeframe,
        summary: prep,
        feedback_data: feedback, // Store the raw feedback used for reference
        type: "prep"
      });
    
    if (insertError) {
      console.error('Error storing feedback summary:', insertError);
      // Continue anyway since we have the summary
    }
    
    // Return the summary
    return NextResponse.json({ prep }, { status: 200 });
  } catch (error) {
    console.error('Error in feedback summarization:', error);
    return NextResponse.json(
      { error: 'Failed to summarize feedback' },
      { status: 500 }
    );
  }
}