import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { marked } from 'marked';

function getBaseUrl() {
  // In production environment on Vercel
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // In preview deployments on Vercel
  if (process.env.VERCEL_ENV === 'preview') {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.VERCEL_ENV === 'staging') {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Use NEXT_PUBLIC_BASE_URL as fallback if set
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  // Localhost fallback to production
  return 'https://www.candor.so';
}

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
    let apiEndpoint = '';
    let apiPayload = {};

    // Check if this is a manager note (has subject_member_id or subject_invited_id)
    const isManagerNote = note.subject_member_id || note.subject_invited_id;
    const employeeId = note.subject_member_id || note.subject_invited_id;
    const isInvitedUser = !!note.subject_invited_id;
    const timeframe = note.metadata?.timeframe || 'all';

    const baseUrl = getBaseUrl();

    switch (note.content_type) {
      case 'summary':
        if (isManagerNote) {
          // This is a manager summary request
          apiEndpoint = `${baseUrl}/api/feedback/manager/summarize`;
          apiPayload = {
            managerId: user.id,
            employeeId: employeeId,
            timeframe: timeframe,
            is_invited: isInvitedUser
          };

          console.log('Manager summary request:', apiEndpoint);
        } else {
          // This is a personal summary request
          apiEndpoint = `${baseUrl}/api/feedback/summarize`;
          apiPayload = {
            userId: user.id,
            timeframe,
            type: 'summary'
          };

          console.log('Personal summary request:', apiEndpoint);
        }
        break;
      case 'prep':
        if (isManagerNote) {
          // This is a manager 1:1 prep request
          apiEndpoint = `${baseUrl}/api/feedback/manager/prep`;
          apiPayload = {
            managerId: user.id,
            employeeId: employeeId,
            timeframe: timeframe,
            is_invited: isInvitedUser
          };

          console.log('Manager prep request:', apiEndpoint);
        } else {
          // This is a personal 1:1 prep request
          apiEndpoint = `${baseUrl}/api/feedback/prep`;
          apiPayload = {
            userId: user.id,
            timeframe: note.metadata?.timeframe || 'week',
            type: 'prep'
          };

          console.log('Personal prep request:', apiEndpoint);
        }
        break;
      case 'review':
        if (isManagerNote) {
          apiEndpoint = `${baseUrl}/api/feedback/manager/review`;
          apiPayload = {
            managerId: user.id,
            employeeId: employeeId,
            timeframe: timeframe,
            is_invited: isInvitedUser
          };

          console.log('Manager review request:', apiEndpoint);
        } else {
          // This is a self review request
          apiEndpoint = `${baseUrl}/api/feedback/review`;
          apiPayload = {
            userId: user.id,
            timeframe: timeframe,
            type: 'review'
          };
        };

        console.log('Self review request:', apiEndpoint);
        break;
      default:
        return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    console.log('API Endpoint:', apiEndpoint);

    // Call the appropriate API endpoint to generate content
    const contentResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(apiPayload),
    });
    
    if (!contentResponse.ok) {
      throw new Error(`Failed to generate content: ${await contentResponse.text()}`);
    }
    
    const contentData = await contentResponse.json();
    
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