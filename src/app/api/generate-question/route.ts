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
    const { providerId, recipientId, recipientName, relationship } = requestData;
    
    if (!providerId || !recipientId || !relationship) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    // Extract relationship details for the prompt
    // const { type, description, distance } = relationship.relationship;
    const { type, description } = relationship.relationship;
    
    // Create a tailored prompt based on the relationship
    let prompt = `Generate an open-ended question for ${providerName} to provide feedback about a colleague named ${recipientName}. `;
    
    // Add relationship context
    prompt += `The relationship between ${providerName} and ${recipientName} is: ${description}. `;
    
    // Add specific guidance based on relationship type
    switch (type) {
      case 'manager-report':
        // prompt += `As ${recipientName}'s manager, ask about their strengths, areas for growth, or impact on the team. `;
        break;
      case 'report-manager':
        prompt += `As someone who reports to ${recipientName}, Here are good example questions to ask: 
        Does the manager work in a respectful manner to others? 
        Does the manager consider other team members' opinions before making a decision?
        Does the manager effectively solve problems?
        Is the manager responsive to their team's needs and questions?
        Can the manager work under pressure to meet deadlines?
        Does the manager provide a clear vision that aligns with the organization's objectives?`;
        break;
      case 'peer':
        prompt += `Even though they are peers, do not refer to their manager as to not add confusion on who the feedback is for. Here are good example questions to ask peers:
        Does this employee work well with others on tasks?
        Does this employee show respect to others in their team?
        Does the employee manage their emotions and keep them in check?
        Does the employee effectively manage their stress levels?
        Does the employee regularly have conflict with others?
        Does the employee exhibit the core people values of the organization?
        Does the employee collaborate with others effectively in a team?
        Is this employee someone that other staff will turn to for advice?`;
        break;
      case 'peer-with-boss':
        prompt += `Even though ${providerName}'s manager is a peer with ${recipientName}, ask a question without naming ${providerName}'s manager specifically as to not add confusion on who the feedback is for. `;
        break;
      case 'skip-level-manager':
        // prompt += `As a higher-level manager to ${recipientName}, ask about their growth, impact across teams, or organizational contribution. `;
        break;
      case 'skip-level-report':
        prompt += `As someone multiple levels below ${recipientName} in the organization, Here are good examples of leadership questions to ask: 
        Does the leader work in a respectful manner to others?
        Does the leader provide solutions to difficult problems?
        Is the leader demonstrating leadership on a daily basis?
        Does the leader take accountability for the work and carry it out to the deadline?
        Do other team members look to the leader to help them with their work?
        Does the leader bring ideas to the table when problem-solving?
        Does the leader supervise work to an effective level?`;
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
    Don't use generic questions that could apply to anyone - make it specific to their role and your relationship.
    Don't focus heavily on projects since not all companies use projects, try to focus on their personal growth and development.
    Don't include any prefacing text or explanation - just provide the question itself.`;
    
    // console.log("Generating question with prompt:", prompt);
    
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