// pages/api/feedback/check-feedback.ts or app/api/feedback/check-feedback/route.ts (for App Router)
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, timeframe } = body;

    if (!userId || !timeframe) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Authentication check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const bearerToken = authHeader.substring(7);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Calculate the date range based on timeframe
    const now = new Date();
    let startDate = new Date();
    
    if (timeframe === 'week') {
      startDate.setDate(now.getDate() - 7); // 1 week ago
    } else if (timeframe === 'month') {
      startDate.setMonth(now.getMonth() - 1); // 1 month ago
    } else if (timeframe === 'all') {
      startDate = new Date(0); // Beginning of time
    }

    // Format dates for SQL query
    const startDateStr = startDate.toISOString();
    const endDateStr = now.toISOString();

    console.log('Checking feedback for user:', userId, 'from', startDateStr, 'to', endDateStr);

   // Check if the user is a recipient
    const { data: recipientData, error: recipientError } = await supabase
        .from('feedback_recipients')
        .select('id')
        .eq('recipient_id', userId);
    
    if (recipientError || recipientData.length === 0) throw recipientError;

    const recipientIds = (recipientData || []).map(r => r.id);

    const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback_responses')
        .select(`
        *,
        feedback_questions!inner(
            id,
            question_text,
            question_type,
            question_subtype,
            question_description,
            company_value_id,
            company_values(
            icon,
            description
            )
        ),
        feedback_sessions!inner(
            id,
            status,
            provider_id
        ),
        feedback_recipients!inner(
            id,
            recipient_id,
            feedback_user_identities!inner(
            id,
            name,
            email
            )
        ),
        nominated_user:feedback_user_identities(
            id,
            name,
            email
        )
        `)
        .in('recipient_id', recipientIds)
        .eq('skipped', false)
        .eq('feedback_sessions.status', 'completed') // dont show in progress answers
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
        
    if (feedbackError) throw feedbackError;

    const feedback = feedbackData || [];

    const count = feedback.length;

    console.log('Feedback count:', count);

    // Return whether feedback exists
    return NextResponse.json({ 
      hasFeedback: count !== null && count > 0,
      count: count || 0
    });
  } catch (error) {
    console.error('Error checking feedback:', error);
    return NextResponse.json(
      { error: 'Failed to check feedback' },
      { status: 500 }
    );
  }
}