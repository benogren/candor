// /api/seed/providers-with-responses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const occurrenceId = searchParams.get('occurrenceId');

    if (!occurrenceId) {
      return NextResponse.json({ error: 'occurrenceId is required' }, { status: 400 });
    }

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

    // Get providers who have already given responses for this occurrence
    const { data: sessions, error: sessionsError } = await supabase
      .from('feedback_sessions')
      .select('provider_id')
      .eq('occurrence_id', occurrenceId)
      .eq('status', 'completed');

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ providers: [] });
    }

    // Get unique provider IDs
    const providerIds = [...new Set(sessions.map(s => s.provider_id))];

    // Get provider details from user_profiles
    const { data: providerProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .in('id', providerIds);

    if (profilesError) {
      console.error('Error fetching provider profiles:', profilesError);
      return NextResponse.json({ error: 'Failed to fetch provider profiles' }, { status: 500 });
    }

    // Define types for responses and feedback_sessions
    type FeedbackSession = {
      provider_id: string;
      occurrence_id: string;
    };

    type FeedbackResponse = {
      id: string;
      feedback_sessions: FeedbackSession | FeedbackSession[];
    };

    // Count responses for each provider in this occurrence
    const { data: responses, error: responsesError } = await supabase
      .from('feedback_responses')
      .select(`
        id,
        feedback_sessions!inner(provider_id, occurrence_id)
      `)
      .eq('feedback_sessions.occurrence_id', occurrenceId);

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
      return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
    }

    // Count responses by provider
    const responseCountsByProvider = new Map();
    (responses as FeedbackResponse[] | undefined)?.forEach(response => {
      const feedbackSessions = response.feedback_sessions;
      const providerId = Array.isArray(feedbackSessions)
        ? feedbackSessions[0]?.provider_id
        : feedbackSessions?.provider_id;

      if (providerId) {
        responseCountsByProvider.set(providerId, (responseCountsByProvider.get(providerId) || 0) + 1);
      }
    });

    // Combine provider info with response counts
    const providersWithResponses = providerProfiles?.map(profile => ({
      id: profile.id,
      name: profile.name || profile.email.split('@')[0],
      email: profile.email,
      response_count: responseCountsByProvider.get(profile.id) || 0
    })) || [];

    return NextResponse.json({ providers: providersWithResponses });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}