// src/app/api/feedback/summarize/route.ts
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
    const { empId, timeframe } = body;
    
    // Basic validation
    if (!empId || !timeframe) {
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
        .eq('recipient_id', empId);
    
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


    const { data: jobData, error: jobError } = await supabase
      .from('user_profiles')
      .select('name, job_title')
      .eq('id', empId);

    let jobTitle = '';
    if (jobError || !jobData || jobData.length === 0) {
        jobTitle = ''; //not found
    } else {
        jobTitle = `They're a ${jobData[0].job_title}`;
    }

    const userName = jobData?.[0]?.name || 'Unknown User';

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
            .eq('id', empId)
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
    
    // If there's no feedback content, return early
    if (!formattedFeedback.trim()) {
      return NextResponse.json(
        { summary: 'No feedback content available to summarize.' },
        { status: 200 }
      );
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

    // const prompt2 = `
    // ${timePeriodText} (${startDate.toISOString()} - ${today.toISOString()})
    // formatted feedback:
    // ${formattedFeedback}
    // `;

    // console.log("prompt", prompt2);
    

    const prompt = `
      Act as a career coach tasked with creating a personalized plan for ${userName} who is seeking to learn or upskill based on their specific career aspirations. 
      Begin by assessing the individual's 360-degree feedback below.
      Identify their current skill set, professional background, and their long-term career goals. 
      Identify any gaps in their knowledge or skills that need to be addressed to reach these goals. 
      Next, develop a tailored learning plan that outlines the steps they need to take. 
      This should include specific courses, workshops, certifications, or any other educational resources relevant to their field of interest. 
      Consider both online and offline opportunities, and prioritize those that offer practical, hands-on experience.
      
      Below is a collection of feedback for ${userName}.
      ${jobTitle}
      ${company} ${industry}
      This feedback was received ${timePeriodText}:
      
      ${formattedFeedback}
      
      Format your response in clear sections with meaningful headings. 
      Keep your response balanced, constructive, and growth-oriented. 
      Focus on patterns rather than individual comments and avoid unnecessarily harsh criticism.
      If provided, consider the individual's company and industry and focus on how companies within this industry operate; the type of work they do, the skills they need, and the challenges they face.
      If provided, consider the individual's job title and focus on how this role typically operates; the type of work they do, the skills they need, and the challenges they face.
      Your reponse should be written in 3nd person, ${userName}'s Manager will be the recipient of this plan.
    `;
    
    // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo", // You may want to use a different model based on your needs
        messages: [
          { 
            role: "system", 
            content: "You are a helpful career coach providing a personalized plan. Your plans are balanced, constructive, and actionable."
          },
          { 
            role: "user", 
            content: prompt
          }
        ],
        max_tokens: 1000
      });
    
    const summary = completion.choices[0]?.message?.content || "Unable to generate summary.";
//     const summary = `### Personalized Development Plan for Bob Porter

// #### Overview
// Bob Porter, currently positioned as a Management Consultant II at Initech in the IT Services and Consulting industry, has demonstrated commendable expertise and reliability in his role. Based on the 360-degree feedback, it is evident that Bob excels in technical triage, client and project management, and utilizes project management tools effectively. Praised for his ability to manage multiple projects and mentor team members, Bob has shown potential for further growth and leadership within the industry. The feedback also highlighted areas for improvement such as anticipating changes in project priorities and conflict resolution skills which could be enhanced to maximize his consulting effectiveness and leadership qualities.

// #### Current Skills and Strengths:
// - **Technical Expertise in Triage**
// - **Client Management**
// - **Project Management**
// - **Efficiency with Management Tools like Monday.com**
// - **Multi-Project Management**
// - **Mentorship and Team Support**

// #### Identified Skill Gaps:
// - **Anticipating Changes**: While Bob adapts well, enhancing his ability to anticipate and strategize proactively could improve project outcomes.
// - **Conflict Resolution**: Bob handles conflicts but can develop more proactive strategies to manage and preempt potential issues to maintain team harmony and productivity.

// #### Long-term Career Goals:
// While specific long-term career aspirations were not detailed, Bob’s current trajectory and capabilities suggest potential goals such as:
// - Advancing to a Senior Management Consultant role or similar leadership positions within the industry.
// - Expanding expertise in advanced strategic consultancy and digital transformation strategies.

// #### Learning and Development Plan

// **1. Advanced Project Management:**
// - **Courses:** PMI Agile Certified Practitioner (PMI-ACP)® or Certified ScrumMaster® (CSM) to enhance agile project management skills.
// - **Timeline:** Start with a certification within the next 3 months.
// - **Providers:** PMI or Scrum Alliance through online certification courses.

// **2. Anticipatory and Strategic Thinking:**
// - **Workshops:** Attend strategy and foresight workshops which focus on scenario planning and environmental scanning.
// - **Timeline:** Attend at least two workshops over the next 6 months.
// - **Providers:** Online platforms like Coursera or live workshops from local business schools or professional associations.

// **3. Advanced Conflict Resolution:**
// - **Training:** Enroll in an advanced conflict management course that includes negotiation and mediation.
// - **Timeline:** Within the next 6 months.
// - **Providers:** Online courses from providers like Udemy, LinkedIn Learning, or in-person sessions via the American Management Association.

// **4. Leadership Development:**
// - **Mentoring:** Engage in a leadership mentoring program with a senior leader within Initech.
// - **Timeline:** Begin within the next month and continue for at least one year.
// - **Objective:** To gain insights from experienced leaders on managing complex team dynamics and strategic decision-making.

// **5. Digital Transformation in IT:**
// - **Certifications:** Pursue a certification in digital transformation, focusing on how IT can leverage digital technologies to transform business operations.
// - **Timeline:** Start within the next year.
// - **Providers:** Digital Transformation Institute, Coursera, or edX.

// **6. Regular Feedback and Assessment:**
// - **Process:** Implement a quarterly review session with peers and supervisors to assess progress on these goals and adjust the learning path as needed.

// ### Conclusion
// By addressing the identified skill gaps and enhancing his current strengths, Bob Porter can significantly enhance his consultancy effectiveness and readiness for upcoming leadership roles. This tailored plan not only aligns with his current career stage at Initech but also prepares him for future challenges in the IT consulting industry. The recommendations provided will support sustained professional growth and maximize Bob's contributions to Initech.
//     `;
    
    // Store the summary in the database for future reference

    // const { error: insertError } = await supabase
    //   .from('feedback_summaries')
    //   .insert({
    //     user_id: empId,
    //     timeframe: timeframe,
    //     summary: summary,
    //     feedback_data: feedback, // Store the raw feedback used for reference
    //     type: "coaching"
    //   });
    
    // if (insertError) {
    //   console.error('Error storing feedback summary:', insertError);
    //   // Continue anyway since we have the summary
    // }
    
    // Return the summary
    return NextResponse.json({ summary }, { status: 200 });
  } catch (error) {
    console.error('Error in feedback summarization:', error);
    return NextResponse.json(
      { error: 'Failed to summarize feedback' },
      { status: 500 }
    );
  }
}