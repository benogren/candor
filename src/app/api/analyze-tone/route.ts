import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Configure OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
//   console.log("ANALYZE-TONE API: Request received");
  
  try {
    // Get body as text first for logging
    const requestText = await request.text();
    // console.log("ANALYZE-TONE API: Raw request body:", requestText);
    
    // Parse the body
    let body;
    try {
      body = JSON.parse(requestText);
    } catch (e) {
      console.error("ANALYZE-TONE API: Error parsing request body:", e);
      return NextResponse.json(
        { error: 'Invalid JSON', toneScore: 50, details: e instanceof Error ? e.message : 'Unknown error' },
        { status: 400 }
      );
    }
    
    const { text } = body;
    
    if (!text || typeof text !== 'string') {
      console.error("ANALYZE-TONE API: Missing or invalid text in request");
      return NextResponse.json(
        { error: 'Text is required and must be a string', toneScore: 50 },
        { status: 400 }
      );
    }
    
    // Skip analysis if text is too short
    if (text.length < 20) {
    //   console.log("ANALYZE-TONE API: Text too short for analysis");
      return NextResponse.json(
        { toneScore: 50, message: 'Text too short for accurate analysis' },
        { status: 200 }
      );
    }
    
    // console.log("ANALYZE-TONE API: Analyzing tone for text:", text.substring(0, 100) + "...");
    
    // Call OpenAI to analyze tone
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a tone analyzer. Analyze the tone of the following text and return a numerical score between 0 and 100, where 0 is extremely friendly, 50 is neutral, and 100 is aggressive. Provide only the score as an integer, with no other text or explanation."
          },
          {
            role: "user",
            content: text
          }
        ],
        store: true,
        temperature: 0.3,
        max_tokens: 10,
      });
      
      // Extract the score from the response
      let toneScore = 50; // Default to neutral
      const scoreText = completion.choices[0]?.message?.content?.trim();
    //   console.log("ANALYZE-TONE API: Raw score from OpenAI:", scoreText);
      
      if (scoreText) {
        // Try to parse the score
        const parsedScore = parseInt(scoreText, 10);
        if (!isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 100) {
          toneScore = parsedScore;
        } else {
          console.error("ANALYZE-TONE API: Could not parse score from OpenAI:", scoreText);
        }
      }
      
      console.log("ANALYZE-TONE API: Final tone score:", toneScore);
      
      return NextResponse.json(
        { toneScore, message: 'Tone analysis successful' },
        { status: 200 }
      );
    } catch (openaiError) {
      console.error("ANALYZE-TONE API: OpenAI API error:", openaiError);
      return NextResponse.json(
        { 
          error: 'Error calling OpenAI API', 
          toneScore: 50, 
          details: openaiError instanceof Error ? openaiError.message : 'Unknown error' 
        },
        { status: 200 } // Return 200 to avoid breaking the UI
      );
    }
  } catch (error) {
    console.error('ANALYZE-TONE API: Unhandled error:', error);
    return NextResponse.json(
      { 
        error: 'Server error', 
        toneScore: 50, 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}