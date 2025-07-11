// src/app/api/voice-agent/process-transcripts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // Added top-level import

export async function POST(request: NextRequest) {
  try {
    const { transcripts, sessionId } = await request.json();

    if (!transcripts || !sessionId) {
      return NextResponse.json(
        { error: 'Transcripts and session ID are required' },
        { status: 400 }
      );
    }

    // Get session info for company context
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: session, error: sessionError } = await supabase
      .from('feedback_sessions')
      .select(`
        *,
        feedback_cycles(
          company_id,
          companies(name, industry)
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return NextResponse.json(
        { error: 'Failed to fetch session data' },
        { status: 500 }
      );
    }

    // Process each transcript with AI to extract natural Q&A pairs
    const processedResponses = [];

    for (const transcript of transcripts) {
      if (!transcript.hasTranscript || !transcript.transcript || transcript.transcript.length < 20) {
        // For recipients without transcripts, create empty responses
        processedResponses.push({
          recipientId: transcript.recipientId,
          recipientName: transcript.recipientName,
          responses: [],
          hasTranscript: false,
          needsManualInput: true
        });
        continue;
      }

      try {
        // Create a prompt focused on extracting natural Q&A pairs from the conversation
        const openaiPrompt = `
You are analyzing a voice conversation transcript to extract the natural questions and answers that were discussed.

CONTEXT:
- This is feedback about ${transcript.recipientName}
- Company industry: ${session.feedback_cycles.companies?.industry || 'Unknown'}

TRANSCRIPT:
${transcript.transcript}

TASK:
Extract the natural questions and answers from this conversation. For each meaningful topic discussed:

1. Identify the core question being addressed (what the conversation was trying to understand)
2. Extract the response/answer given
3. Determine if this is better represented as a rating (1-10 scale) or text response
4. Create a clear, professional question that captures what was discussed

Return a JSON array in this format:
[
  {
    "questionText": "question text here",
    "questionType": "rating",
    "ratingValue": 7,
    "textResponse": null,
    "hasComment": true,
    "commentText": "They are very clear in meetings and always follow up on action items."
  },
  {
    "questionText": "question text here", 
    "questionType": "text",
    "ratingValue": null,
    "textResponse": "Strong analytical skills and ability to break down complex problems. Great at mentoring junior team members.",
    "hasComment": false,
    "commentText": null
  }
]

GUIDELINES:
- Focus on substantial topics, not small talk
- Create questions that could be reused for other people in similar roles
- For rating questions, use 1-10 scale where 1=Poor, 5-6=Average, 10=Excellent
- For rating questions, infer appropriate 1-10 scale ratings from the discussion tone and content
- For text questions, summarize the key points discussed
- Make questions professional and specific
- Only include 2-5 main topics that were substantially discussed
- Use the recipient's name in the questions to personalize them
- Ensure the JSON is valid and properly formatted

Return ONLY the JSON array, no other text.
`;

        let aiResponses = [];
        
        try {
          // Use OpenAI for transcript processing
          if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
          }

          console.log('Using OpenAI API to extract Q&A pairs for', transcript.recipientName);
          
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-4-turobo-preview',
              messages: [{
                role: 'user',
                content: openaiPrompt
              }],
              max_tokens: 2000,
              temperature: 0.1
            })
          });

          if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json();
            throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
          }

          const data = await openaiResponse.json();
          console.log('OpenAI response received, extracting Q&A pairs...');
          
          const responseText = data.choices[0]?.message?.content || '';
          
          if (!responseText) {
            throw new Error('Empty response from OpenAI');
          }
          
          console.log('Raw OpenAI response:', responseText.substring(0, 200) + '...');
          
          // Clean the response text - remove any markdown code blocks
          const cleanedText = responseText
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/gi, '')
            .trim();
          
          try {
            aiResponses = JSON.parse(cleanedText);
            console.log('Successfully parsed OpenAI response:', aiResponses.length, 'Q&A pairs');
          } catch (parseError) {
            console.error('Failed to parse OpenAI response as JSON:', parseError);
            
            // Try to extract JSON from the response if it's embedded in text
            const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              try {
                aiResponses = JSON.parse(jsonMatch[0]);
                console.log('Successfully extracted JSON from response:', aiResponses.length, 'Q&A pairs');
              } catch (extractError) {
                console.error('Failed to extract JSON:', extractError);
                aiResponses = [];
              }
            } else {
              aiResponses = [];
            }
          }

        } catch (apiError) {
          console.error('OpenAI API error:', apiError);
          
          // Fallback - create basic text response from transcript if API fails
          console.log('Using fallback: creating basic response from transcript');
          if (transcript.transcript.length > 50) {
            aiResponses = [{
              questionText: `General feedback about ${transcript.recipientName}`,
              questionType: 'text',
              ratingValue: null,
              textResponse: transcript.transcript.length > 500 
                ? transcript.transcript.substring(0, 500) + '...' 
                : transcript.transcript,
              hasComment: false,
              commentText: null
            }];
            console.log('Created fallback response');
          } else {
            aiResponses = [];
          }
        }

        // Ensure aiResponses is always an array and validate structure
        if (!Array.isArray(aiResponses)) {
          console.warn('AI response is not an array, converting to empty array');
          aiResponses = [];
        }

        // Validate and clean each response object
        const validatedResponses = aiResponses.filter(response => {
          if (!response || typeof response !== 'object') return false;
          if (!response.questionText || !response.questionType) return false;
          if (!['rating', 'text'].includes(response.questionType)) return false;
          return true;
        }).map(response => ({
          ...response,
          // Ensure proper data types and valid rating range
          ratingValue: response.questionType === 'rating' ? 
            Math.min(10, Math.max(1, response.ratingValue || 5)) : null,
          textResponse: response.questionType === 'text' ? (response.textResponse || '') : null,
          hasComment: Boolean(response.hasComment),
          commentText: response.commentText || null
        }));

        console.log('Validated responses for', transcript.recipientName, ':', validatedResponses.length);

        processedResponses.push({
          recipientId: transcript.recipientId,
          recipientName: transcript.recipientName,
          responses: validatedResponses,
          hasTranscript: true,
          originalTranscript: transcript.transcript,
          needsManualInput: validatedResponses.length === 0,
          processingSuccess: validatedResponses.length > 0
        });

      } catch (error) {
        console.error(`Error processing transcript for ${transcript.recipientName}:`, error);
        processedResponses.push({
          recipientId: transcript.recipientId,
          recipientName: transcript.recipientName,
          responses: [],
          hasTranscript: true,
          originalTranscript: transcript.transcript,
          needsManualInput: true,
          processingError: 'Failed to process transcript with AI'
        });
      }
    }

    return NextResponse.json({
      sessionId,
      processedResponses,
      totalProcessed: processedResponses.length,
      successfullyProcessed: processedResponses.filter(r => r.responses && r.responses.length > 0).length,
      extractedQuestions: processedResponses.reduce((acc, r) => acc + (r.responses?.length || 0), 0)
    });

  } catch (error) {
    console.error('Error in process-transcripts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}