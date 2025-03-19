// app/api/generate-question/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

    // console.log("User:", user);
    
    const providerName = user.user_metadata.name;

    // Parse request body
    const requestData = await request.json();
    const { providerId, recipientId, recipientName, relationship, companyId } = requestData;

    console.log("CompanyId:", companyId);
    
    if (!providerId || !recipientId || !relationship || !companyId) {
      return NextResponse.json({ error: 'Missing required parameters', requestData }, { status: 400 });
    }
    
    // Extract relationship details for the prompt
    // const { type, description, distance } = relationship.relationship;
    const { type, description } = relationship.relationship;

    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name, industry')
      .eq('id', companyId);

      let industrySpecific = "";
      let jobTitle = "";
      if (companyError || !companyData || companyData.length === 0) {
        industrySpecific = "Don't focus heavily on projects since not all companies use projects, try to focus on their personal growth and development. ";
      } else {

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
              }
              else {
                jobTitle = invitedUserData[0].job_title; 
                industrySpecific += `${recipientName}'s job title is ${jobTitle}, focus on skills and behaviors that are important for ${jobTitle} roles. `;
              }
          }
          else {
            jobTitle = userData[0].job_title;
            industrySpecific += `${recipientName}'s job title is ${jobTitle}, focus on skills and behaviors that are important for ${jobTitle} roles. `;
          }
      }
    
    // Create a tailored prompt based on the relationship
    let prompt = `Generate an open-ended question for ${providerName} to provide feedback about a colleague named ${recipientName}. `;
    
    // Add relationship context
    prompt += `The relationship between ${providerName} and ${recipientName} is: ${description}. `;
    
    // Add specific guidance based on relationship type
    switch (type) {
      case 'manager-report':
        prompt += `As ${recipientName}'s manager, focus on themes like: leadership style, communication, delegation, goal setting, team collaboration, conflict resolution, feedback provision, motivation, development opportunities, and alignment with company values. `;
        break;
      case 'report-manager':
        prompt += `As someone who reports to ${recipientName}, focus on managerial skills like: leadership effectiveness, communication, delegation, decision-making, team development, coaching, emotional intelligence, and conflict resolution. `;
        break;
      case 'peer':
        prompt += `Even though they are peers, do not refer to their manager as to not add confusion on who the feedback is for. Focus on peer-to-peer skills like: collaboration, communication, teamwork, conflict resolution, and contributions to the team. `;
        break;
      case 'peer-with-boss':
        prompt += `Even though ${providerName}'s manager is a peer with ${recipientName}, ask a question without naming ${providerName}'s manager specifically as to not add confusion on who the feedback is for. 
        Since this is a cross-organization leaders, focus on themes like: communication, collaboration, influence, and strategic thinking`;
        break;
      case 'skip-level-manager':
        prompt += `As a skip-level to ${recipientName}, focus on themes like: leadership style, communication, decision-making, goal setting, motivation, development opportunities, and team dynamics. `;
        break;
      case 'skip-level-report':
        prompt += `As someone multiple levels below ${recipientName} in the organization, focus on leadership qualities like: Communication, Decision-Making, Team Management, Vision & Strategy, Development & Coaching, Leadership Effectiveness, emotional intelligence, and Organizational Alignment. `;
        break;
      default:
        // prompt += `Ask about their professional contributions, teamwork, or impact on projects. `;
    }
    
    prompt += `
    Avoid vague or ambiguous language: Instead of asking "How is their communication?", ask "How effectively does this person communicate complex information to a diverse audience?" 
    Focus on behaviors and actions: Frame questions around observable actions and behaviors rather than general traits or opinions.
    Use clear and concise language: Ensure the questions are easy to understand and avoid jargon or technical terms that might confuse respondents.
    Questions should be on one of the following topics: Leadership, Communication, Problem-solving, Teamwork, Adaptability, Time Management, Decision Making, Creativity, Emotional Intelligence, Conflict Resolution, Organizational Alignment, Employee's Motivation, and Interpersonal skills. 
    Make the question specific and thoughtful, directly addressing ${recipientName} by name. 
    The question should encourage detailed, constructive feedback and should be appropriate for a professional setting.
    The question should be under 100 Characters long and end with a question mark.
    ${industrySpecific}
    Don't use generic questions that could apply to anyone - make it specific to their role and your relationship.
    Don't include any prefacing text or explanation - just provide the question itself.`;
    
    console.log("Generating question with prompt:", prompt);
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are a career coach who is an expert at crafting personalized professional 360-degree feedback questions that elicit thoughtful responses." 
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    });
    
    const generatedQuestion = completion.choices[0]?.message?.content?.trim();
    
    if (!generatedQuestion) {
      throw new Error('Failed to generate question');
    }
    
    // Clean up the response - remove quotes and any extraneous text
    const cleanedQuestion = generatedQuestion
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/^Question: /i, '') // Remove "Question:" prefix
      .trim();
    
    return NextResponse.json({ question: cleanedQuestion });
  } catch (error) {
    console.error('Error generating question:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate question',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}