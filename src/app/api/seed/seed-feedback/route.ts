// /api/seed/seed-feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SeedRequest {
  occurrenceId: string;
  providerId: string;
  recipientIds: string[];
}

// Function to generate random date between two dates
function generateRandomDate(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime).toISOString();
}

// Function to get relationship between users
async function getUserRelationship(user1Id: string, user2Id: string, token: string) {
  try {
    const response = await fetch(`http://localhost:3000/api/user-relationship?user1=${user1Id}&user2=${user2Id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Error fetching relationship:', error);
  }
  return null;
}

// Function to generate AI responses
async function generateAIFeedbackResponse(
  questionText: string,
  questionType: string,
  providerName: string,
  recipientName: string,
  relationship: any
): Promise<any> {
  try {
    const randomRating1to10 = Math.floor(Math.random() * 10) + 1; // Random rating between 1 and 10
    let questionTone = '';
    if (randomRating1to10 <= 3) {
      questionTone = 'negative';
    } else if (randomRating1to10 >= 4 && randomRating1to10 <= 5) {
      questionTone = 'neutral';
    } else if (randomRating1to10 >= 6 && randomRating1to10 <= 9) {
      questionTone = 'positive';
    } else {
      questionTone = 'very positive';
    }

    const prompt = `You are ${providerName}, providing a ${questionTone} toned workplace feedback about ${recipientName} who is your ${relationship?.relationship?.type || 'colleague'}.

    Question: ${questionText}
    Question type: ${questionType}

    ${questionType === 'rating' ? 
    `Provide a rating from 1-10 and optionally a brief comment explaining your rating. 
    Keep the comment under 200 characters.` :
    `Provide a thoughtful, specific response based on your working relationship. 
    Keep the response under 300 characters.`}
    }

    Keep responses professional, constructive, and realistic. Be specific about behaviors and contributions you've observed.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional colleague providing workplace feedback. Your responses should be honest, constructive, and specific to the working relationship described."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    const responseText = completion.choices[0]?.message?.content || '';

    if (questionType === 'rating') {
      // Extract rating and comment from AI response
      const ratingMatch = responseText.match(/(\d+)(?:\/10)?/);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : Math.floor(Math.random() * 3) + 7; // Default 7-9
      
      return {
        rating_value: Math.min(Math.max(rating, 1), 10), // Ensure 1-10 range
        comment_text: responseText.length > 50 ? responseText : null,
        has_comment: responseText.length > 50
      };
    } else {
      return {
        text_response: responseText,
        has_comment: false
      };
    }
  } catch (error) {
    console.error('Error generating AI response:', error);
    
    // Fallback responses
    if (questionType === 'rating') {
      return {
        rating_value: Math.floor(Math.random() * 3) + 7,
        comment_text: `${recipientName} consistently demonstrates strong performance and collaboration.`,
        has_comment: true
      };
    } else {
      return {
        text_response: `${recipientName} has been a valuable team member, contributing effectively to our shared goals and maintaining good communication throughout our collaboration.`,
        has_comment: false
      };
    }
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // Check admin access
    const { data: member } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!member || member.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { occurrenceId, providerId, recipientIds }: SeedRequest = await request.json();

    if (!occurrenceId || !providerId || !recipientIds?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get occurrence details
    const { data: occurrence, error: occurrenceError } = await supabase
      .from('feedback_cycle_occurrences')
      .select('start_date, end_date, cycle_id')
      .eq('id', occurrenceId)
      .single();

    if (occurrenceError || !occurrence) {
      return NextResponse.json({ error: 'Occurrence not found' }, { status: 404 });
    }

    // Get provider details
    const { data: providerProfile } = await supabase
      .from('user_profiles')
      .select('name, email')
      .eq('id', providerId)
      .single();

    const providerName = providerProfile?.name || 'Provider';

    // Create feedback session for this seeding
    const { data: sessionData, error: sessionError } = await supabase
      .from('feedback_sessions')
      .insert({
        cycle_id: occurrence.cycle_id,
        provider_id: providerId,
        occurrence_id: occurrenceId,
        status: 'completed',
        started_at: generateRandomDate(occurrence.start_date, occurrence.end_date),
        completed_at: generateRandomDate(occurrence.start_date, occurrence.end_date)
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    // Get active questions for the company
    const { data: standardQuestions, error: questionsError } = await supabase
      .from('feedback_questions')
      .select('*')
      .eq('active', true)
      .in('question_type', ['rating', 'text'])
      .or(`company_id.eq.${member.company_id},scope.eq.global`);

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    const ratingQuestions = standardQuestions?.filter(q => q.question_type === 'rating') || [];
    const textQuestions = standardQuestions?.filter(q => q.question_type === 'text') || [];

    // Process each recipient
    const results = [];
    
    for (const recipientId of recipientIds) {
      try {
        // Get recipient details
        let recipientName = 'Colleague';
        let recipientData = null;

        // Try to get from user_profiles first
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('name, email')
          .eq('id', recipientId)
          .single();

        if (userProfile) {
          recipientData = userProfile;
          recipientName = userProfile.name || userProfile.email.split('@')[0];
        } else {
          // Try invited_users
          const { data: invitedUser } = await supabase
            .from('invited_users')
            .select('name, email')
            .eq('id', recipientId)
            .single();

          if (invitedUser) {
            recipientData = invitedUser;
            recipientName = invitedUser.name || invitedUser.email.split('@')[0];
          }
        }

        // Ensure recipient exists in feedback_user_identities
        const { data: existingIdentity } = await supabase
          .from('feedback_user_identities')
          .select('id')
          .eq('id', recipientId)
          .single();

        if (!existingIdentity && recipientData) {
          await supabase
            .from('feedback_user_identities')
            .insert({
              id: recipientId,
              identity_type: userProfile ? 'member' : 'invited',
              company_id: member.company_id,
              email: recipientData.email,
              name: recipientName
            });
        }

        // Create feedback recipient record
        const { data: recipientRecord, error: recipientError } = await supabase
          .from('feedback_recipients')
          .insert({
            session_id: sessionData.id,
            recipient_id: recipientId,
            status: 'completed'
          })
          .select()
          .single();

        if (recipientError) {
          console.error('Error creating recipient:', recipientError);
          continue;
        }

        // Get relationship between provider and recipient
        const relationship = await getUserRelationship(providerId, recipientId, token);

        // Select questions deterministically
        const getQuestionForRecipient = (questions: any[], index: number = 0) => {
          if (questions.length === 0) return null;
          const seed = recipientId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const questionIndex = (seed + index) % questions.length;
          return questions[questionIndex];
        };

        // Create 2-3 responses per recipient
        const questionsToCreate = [];
        
        if (ratingQuestions.length > 0) {
          questionsToCreate.push({
            question: getQuestionForRecipient(ratingQuestions),
            type: 'rating'
          });
        }
        
        if (textQuestions.length > 0) {
          questionsToCreate.push({
            question: getQuestionForRecipient(textQuestions, 1),
            type: 'text'
          });
        }

        // Generate and save responses
        for (const { question, type } of questionsToCreate) {
          if (!question) continue;

          // Generate AI response
          const aiResponse = await generateAIFeedbackResponse(
            question.question_text,
            type,
            providerName,
            recipientName,
            relationship
          );

          // Save response
          const responseData = {
            recipient_id: recipientRecord.id,
            question_id: question.id,
            session_id: sessionData.id,
            skipped: false,
            created_at: generateRandomDate(occurrence.start_date, occurrence.end_date),
            updated_at: generateRandomDate(occurrence.start_date, occurrence.end_date),
            ...aiResponse
          };

          const { error: responseError } = await supabase
            .from('feedback_responses')
            .insert(responseData);

          if (responseError) {
            console.error('Error saving response:', responseError);
          }
        }

        results.push({
          recipientId,
          recipientName,
          questionsGenerated: questionsToCreate.length
        });

      } catch (error) {
        console.error(`Error processing recipient ${recipientId}:`, error);
        results.push({
          recipientId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      sessionId: sessionData.id,
      results 
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}