import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { marked } from 'marked';

// Import the handler functions directly
import { POST as prepHandler } from '@/app/api/feedback/prep/route';
import { POST as managerPrepHandler } from '@/app/api/feedback/manager/prep/route';
import { POST as summarizeHandler } from '@/app/api/feedback/summarize/route';
import { POST as managerSummarizeHandler } from '@/app/api/feedback/manager/summarize/route';
import { POST as reviewHandler } from '@/app/api/feedback/review/route';
import { POST as managerReviewHandler } from '@/app/api/feedback/manager/review/route';

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
    let apiEndpoint = '';
    let apiPayload = {};

    // Check if this is a manager note (has subject_member_id or subject_invited_id)
    const isManagerNote = note.subject_member_id || note.subject_invited_id;
    const employeeId = note.subject_member_id || note.subject_invited_id;
    const isInvitedUser = !!note.subject_invited_id;
    const timeframe = note.metadata?.timeframe || 'all';

    // Create a new request object to pass to the handler
    const createHandlerRequest = (payload: any) => {

      const url = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';


      return new Request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`
        },
        body: JSON.stringify(payload)
      });
    };

    switch (note.content_type) {
      case 'summary':
        if (isManagerNote) {
          // Manager summary
          const managerSummaryPayload = {
            managerId: user.id,
            employeeId: employeeId,
            timeframe: timeframe,
            is_invited: isInvitedUser
          };
          const summaryResponse = await managerSummarizeHandler(createHandlerRequest(managerSummaryPayload));
          contentData = await summaryResponse.json();
          console.log('Manager summary response:', contentData);
        } else {
          // Personal summary
          const summaryPayload = {
            userId: user.id,
            timeframe,
            type: 'summary'
          };
          const summaryResponse = await summarizeHandler(createHandlerRequest(summaryPayload));
          contentData = await summaryResponse.json();
          console.log('Personal summary response:', contentData);
        }
        break;
      
      case 'prep':
        if (isManagerNote) {
          // Manager prep
          const managerPrepPayload = {
            managerId: user.id,
            employeeId: employeeId,
            timeframe: timeframe,
            is_invited: isInvitedUser
          };
          const prepResponse = await managerPrepHandler(createHandlerRequest(managerPrepPayload));
          contentData = await prepResponse.json();
          console.log('Manager prep response:', contentData);
        } else {
          // Personal prep
          const prepPayload = {
            userId: user.id,
            timeframe: note.metadata?.timeframe || 'week',
            type: 'prep'
          };
          const prepResponse = await prepHandler(createHandlerRequest(prepPayload));
          contentData = await prepResponse.json();
          console.log('Personal prep response:', contentData);
        }
        break;
      
      case 'review':
        if (isManagerNote) {
          // Manager review
          const managerReviewPayload = {
            managerId: user.id,
            employeeId: employeeId,
            timeframe: timeframe,
            is_invited: isInvitedUser
          };
          const reviewResponse = await managerReviewHandler(createHandlerRequest(managerReviewPayload));
          contentData = await reviewResponse.json();
          console.log('Manager review response:', contentData);
        } else {
          // Personal review
          const reviewPayload = {
            userId: user.id,
            timeframe: timeframe,
            type: 'review'
          };
          const reviewResponse = await reviewHandler(createHandlerRequest(reviewPayload));
          contentData = await reviewResponse.json();
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
      
      const htmlContent = await marked.parse(markdownContent);
      generatedContent = htmlContent;
    } else if (note.content_type === 'prep') {
      const markdownContent = isManagerNote
        ? contentData.prep
        : contentData.prep;
        
      const htmlContent = await marked.parse(markdownContent);
      generatedContent = htmlContent;
    } else if (note.content_type === 'review') {
      const markdownContent = contentData.review;
      const htmlContent = await marked.parse(markdownContent);
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
  } catch (error) {
    console.error('Error generating note content:', error);
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  }
}