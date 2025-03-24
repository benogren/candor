import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Configure OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define tone prompts
const tonePrompts: Record<string, string> = {
  friendly: `Rewrite the following text to make it more friendly, warm, and approachable. Use a conversational, positive tone that builds rapport`,
  assertive: `Rewrite the following text to make it more assertive and confident. Use direct language, clear statements, and a tone that conveys authority without being aggressive. `,
  formal: `Rewrite the following text to make it more formal and professional. Use proper language, avoid contractions, maintain a respectful distance, and adhere to business etiquette.`,
  informal: `Rewrite the following text to make it more casual and conversational. Use a relaxed tone, everyday language, and a style that feels like talking to a friend while still being respectful.`
};

export async function POST(request: Request) {
  try {
    // Get text and tone from request body
    const requestBody = await request.text();
    let parsedBody;
    try {
        parsedBody = JSON.parse(requestBody);
    } catch (e) {
        console.error("ADJUST-TONE API: Error parsing JSON request body:", e);
        return NextResponse.json(
        { error: 'Invalid JSON in request body', generatedText: '', details: e instanceof Error ? e.message : 'Unknown error' },
        { status: 400 }
        );
    }
    const { text, tone, questionContext } = parsedBody;
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      );
    }
    
    if (!tone || !tonePrompts[tone]) {
      return NextResponse.json(
        { error: 'Valid tone is required (friendly, assertive, formal, or informal)' },
        { status: 400 }
      );
    }
    
    // Skip processing if text is too short
    if (text.length < 10) {
      return NextResponse.json(
        { generatedText: text, message: 'Text too short for tone adjustment' },
        { status: 200 }
      );
    }

    const questionData = questionContext;
    
    // Get the appropriate prompt for the requested tone
    let prompt = `
    You are a tone adjuster. 
    Your job is to rewrite the following text while keeping the point of view the same using terms like "I think" or "I believe" and not "What if we" or "Let's".
    Rewite it in a way that keeps the perspective between two people.
    Make sure to maintain the original meaning and context while keeping it relevant to the specific question context provided. 
    Keep approximately the same length and ensure the content directly addresses the question context.
    Do not start the text with a greeting, like "Hey there!" or "Hi, how are you?". 
    Do not end with a sign-off or terms like "Let's".
    `;
    prompt += tonePrompts[tone];
    prompt += `
    The context of the question is: ${questionData}`;

    // console.log('Prompt:', prompt);
    
    try {
      // Call OpenAI to adjust the tone
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });
      
      // Extract the generated text from the response
      const generatedText = completion.choices[0]?.message?.content?.trim() || text;
      
      return NextResponse.json(
        { generatedText, message: 'Tone adjustment successful' },
        { status: 200 }
      );
    } catch (error) {
      console.error('Error adjusting tone:', error);
      // Return the original text if there's an error
      return NextResponse.json(
        { generatedText: text, message: 'Error processing request, returning original text' },
        { status: 200 }  // Still return 200 to prevent UI from breaking
      );
    }
    
  } catch (error) {
    console.error('Error adjusting tone:', error);
    return NextResponse.json(
      { error: 'Failed to adjust tone', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}