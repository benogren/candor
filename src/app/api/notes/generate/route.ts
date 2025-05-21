import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { marked } from 'marked';

// Import the handler functions directly
// import { POST as prepHandler } from '@/app/api/feedback/prep/route';
// import { POST as managerPrepHandler } from '@/app/api/feedback/manager/prep/route';
// import { POST as summarizeHandler } from '@/app/api/feedback/summarize/route';
// import { POST as managerSummarizeHandler } from '@/app/api/feedback/manager/summarize/route';
// import { POST as reviewHandler } from '@/app/api/feedback/review/route';
// import { POST as managerReviewHandler } from '@/app/api/feedback/manager/review/route';

// Define payload interfaces
interface BasePayload {
  timeframe: string;
}

interface UserPayload extends BasePayload {
  userId: string;
  type: string;
}

interface ManagerPayload extends BasePayload {
  managerId: string;
  employeeId: string;
  is_invited: boolean;
}

interface FeedbackResponse {
  summary?: string;
  prep?: string;
  review?: string;
  [key: string]: unknown; // Use unknown instead of any for better type safety
}

// Define a type for errors
// type ApiError = Error | { message: string; cause?: unknown };

export async function POST(request: Request) {
  try {
    // Get the request body
    const body = await request.json();
    const { id } = body;

    console.log('Received data:', { id });

    if (!id) {
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

    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .eq('creator_id', user.id)
      .single();

    if (noteError) {
      console.error('Error fetching note:', noteError);
      return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
    }
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    let generatedContent = '';
    let contentData;

    // Check if this is a manager note (has subject_member_id or subject_invited_id)
    const isManagerNote = note.subject_member_id || note.subject_invited_id;
    const employeeId = note.subject_member_id || note.subject_invited_id;
    const isInvitedUser = !!note.subject_invited_id;
    const timeframe = note.metadata?.timeframe || 'all';

    // Helper function to safely handle responses
    async function safelyHandleResponse(response: Response): Promise<FeedbackResponse> {
      if (!response.ok) {
        const responseText = await response.text();
        console.error(`API response error (${response.status}): ${responseText}`);
        throw new Error(`API responded with status ${response.status}: ${responseText}`);
      }
      
      try {
        return await response.json();
      } catch (err) {
        const responseText = await response.text();
        console.error('Failed to parse JSON response:', err, responseText);
        throw new Error(`Failed to parse JSON response: ${responseText.substring(0, 200)}...`);
      }
    }

    // Create a new request object to pass to the handler
    // function createHandlerRequest<T extends BasePayload>(payload: T): Request {
    //   return new Request('https://api.internal', {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'Authorization': `Bearer ${bearerToken}`
    //     },
    //     body: JSON.stringify(payload)
    //   });
    // }

    // Instead of directly calling the imported handlers, let's use actual API calls
    const apiBaseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Call the appropriate API endpoint based on content type
    switch (note.content_type) {
      case 'summary':
        if (isManagerNote) {
          // Manager summary
          const managerSummaryPayload: ManagerPayload = {
            managerId: user.id,
            employeeId,
            timeframe,
            is_invited: isInvitedUser
          };
          
          const summaryResponse = await fetch(`${apiBaseUrl}/api/feedback/manager/summarize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${bearerToken}`
            },
            body: JSON.stringify(managerSummaryPayload)
          });
          
          contentData = await safelyHandleResponse(summaryResponse);
          console.log('Manager summary response:', contentData);
        } else {
          // Personal summary
          const summaryPayload: UserPayload = {
            userId: user.id,
            timeframe,
            type: 'summary'
          };
          
          const summaryResponse = await fetch(`${apiBaseUrl}/api/feedback/summarize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${bearerToken}`
            },
            body: JSON.stringify(summaryPayload)
          });
          
          contentData = await safelyHandleResponse(summaryResponse);
          console.log('Personal summary response:', contentData);
        }
        break;
      
      // Similar pattern for prep and review cases...
      case 'prep':
        if (isManagerNote) {
          // Manager prep
          const managerPrepPayload: ManagerPayload = {
            managerId: user.id,
            employeeId,
            timeframe,
            is_invited: isInvitedUser
          };
          
          const prepResponse = await fetch(`${apiBaseUrl}/api/feedback/manager/prep`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${bearerToken}`
            },
            body: JSON.stringify(managerPrepPayload)
          });
          
          contentData = await safelyHandleResponse(prepResponse);
          console.log('Manager prep response:', contentData);
        } else {
          // Personal prep
          const prepPayload: UserPayload = {
            userId: user.id,
            timeframe: note.metadata?.timeframe || 'week',
            type: 'prep'
          };
          
          const prepResponse = await fetch(`${apiBaseUrl}/api/feedback/prep`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${bearerToken}`
            },
            body: JSON.stringify(prepPayload)
          });
          
          contentData = await safelyHandleResponse(prepResponse);
          console.log('Personal prep response:', contentData);
        }
        break;
      
      case 'review':
        if (isManagerNote) {
          // Manager review
          const managerReviewPayload: ManagerPayload = {
            managerId: user.id,
            employeeId,
            timeframe,
            is_invited: isInvitedUser
          };
          
          const reviewResponse = await fetch(`${apiBaseUrl}/api/feedback/manager/review`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${bearerToken}`
            },
            body: JSON.stringify(managerReviewPayload)
          });
          
          contentData = await safelyHandleResponse(reviewResponse);
          console.log('Manager review response:', contentData);
        } else {
          // Personal review
          const reviewPayload: UserPayload = {
            userId: user.id,
            timeframe,
            type: 'review'
          };
          
          const reviewResponse = await fetch(`${apiBaseUrl}/api/feedback/review`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${bearerToken}`
            },
            body: JSON.stringify(reviewPayload)
          });
          
          contentData = await safelyHandleResponse(reviewResponse);
          console.log('Personal review response:', contentData);
        }
        break;
      
      default:
        return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }
    
    // Format the response data based on content type
    if (note.content_type === 'summary') {
      const markdownContent = isManagerNote 
        ? contentData.summary
        : contentData.summary;
      
      const htmlContent = await marked.parse(markdownContent ?? '');
      generatedContent = htmlContent;
    } else if (note.content_type === 'prep') {
      const markdownContent = isManagerNote
        ? contentData.prep
        : contentData.prep;
        
      const htmlContent = await marked.parse(markdownContent ?? '');
      generatedContent = htmlContent;
    } else if (note.content_type === 'review') {
      const markdownContent = contentData.review;
      const htmlContent = await marked.parse(markdownContent ?? '');
      generatedContent = htmlContent;
    }

    // Update the note with the generated content
    const { data, error } = await supabase
      .from('notes')
      .update({
        content: generatedContent,
        is_generating: false
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ note: data }, { status: 200 });
  } catch (error: unknown) { // Properly type the error as unknown
    // Convert the unknown error to a more specific type for logging
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unknown error occurred';
    
    console.error('Error generating note content:', errorMessage);
    
    // If you need to access more properties from the error
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        stack: error.stack,
        cause: error.cause
      });
    }
    
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  }
}