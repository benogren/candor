// src/app/api/feedback/manager/review/route.ts
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

    // Check if the user is a recipient
    const { data: recipientData, error: recipientError } = await supabase
        .from('feedback_recipients')
        .select('id')
        .eq('recipient_id', employeeId);
    
    if (recipientError || recipientData.length === 0) throw recipientError;

    const recipientIds = (recipientData || []).map(r => r.id);

    // Now get feedback responses for these recipients, joining with questions
    const today = new Date();
    const startDate = new Date();

    startDate.setMonth(today.getMonth() - 12); // Default to 12 months ago

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
        console.log('Error fetching company data:', error);
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
        // continue anyway
    }
    
    // Determine time period for prompt
    let timePeriodText = '';
    timePeriodText = 'over the past year'; // Default to year
    
    // Create the prompt for OpenAI
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
    
    const review = completion.choices[0]?.message?.content || "Unable to generate summary.";

    //console.log('Summary:', review);


    
    // Store the summary in the database for future reference

    // TO DO: this will error if the user is an invited user...
    // const { error: insertError } = await supabase
    //   .from('manager_feedback_summaries')
    //   .insert({
    //     manager_id: managerId,
    //     employee_id: employeeId,
    //     timeframe: timeframe,
    //     summary: prep,
    //     feedback_data: feedback, // Store the raw feedback used for reference
    //     type: "prep"
    //   });
    
    // if (insertError) {
    //   console.error('Error storing feedback summary:', insertError);
    //   // Continue anyway since we have the summary
    // }
    
    // Return the summary
    return NextResponse.json({ review }, { status: 200 });
  } catch (error) {
    console.error('Error in feedback summarization:', error);
    return NextResponse.json(
      { error: 'Failed to summarize feedback' },
      { status: 500 }
    );
  }
}