// pages/api/notes/create.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // Get the request body
    const body = await request.json();
    const { title, content_type, metadata, subject_member_id, subject_invited_id } = body;

    //console.log('Received data:', { title, content_type, metadata });

    if (!title || !content_type || !metadata) {
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

    // create a new note with is_generating = true
    const { data, error } = await supabase
      .from('notes')
      .insert({
        title,
        content: '',
        content_type,
        creator_id: user.id,
        metadata,
        is_generating: true,
        subject_member_id: subject_member_id || null,
        subject_invited_id: subject_invited_id || null,
      })
      .select()
      .single();

    if (error) { 
      console.error('Error creating note:', error);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    // Return the new note ID so we can navigate to it
    return NextResponse.json({ id: data.id }, { status: 200 });

  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}