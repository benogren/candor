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
      startDate.setDate(now.getDate() - 7);
    } else if (timeframe === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else if (timeframe === 'all') {
      startDate = new Date(0); // Beginning of time
    }

    console.log('Checking feedback for user:', userId, 'from', startDate.toISOString(), 'to', now.toISOString());

    // First, try to get data from weekly_feedback_analysis for better performance
    let feedbackCount = 0;
    let hasAnalysisData = false;

    if (timeframe === 'week' || timeframe === 'month') {
      // Calculate week start dates to query analysis data
      const weekStarts = getWeekStartDates(startDate, now);
      
      const { data: analysisData, error: analysisError } = await supabase
        .from('weekly_feedback_analysis')
        .select('feedback_received_count, status, week_start_date')
        .eq('user_id', userId)
        .in('week_start_date', weekStarts)
        .eq('status', 'completed'); // Only count completed analysis

      if (!analysisError && analysisData && analysisData.length > 0) {
        // Sum up feedback counts from analysis data
        feedbackCount = analysisData.reduce((sum, week) => sum + (week.feedback_received_count || 0), 0);
        hasAnalysisData = true;
        console.log('Using analysis data - feedback count:', feedbackCount, 'from', analysisData.length, 'weeks');
      }
    }

    // Fallback to raw feedback data if no analysis data available or for 'all' timeframe
    if (!hasAnalysisData || timeframe === 'all') {
      console.log('Falling back to raw feedback data query');
      
      // Check if the user is a recipient
      const { data: recipientData, error: recipientError } = await supabase
        .from('feedback_recipients')
        .select('id')
        .eq('recipient_id', userId);
      
      if (recipientError) throw recipientError;
      
      if (!recipientData || recipientData.length === 0) {
        return NextResponse.json({ 
          hasFeedback: false,
          count: 0,
          source: 'raw_data'
        });
      }

      const recipientIds = recipientData.map(r => r.id);

      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback_responses')
        .select('id, created_at')
        .in('recipient_id', recipientIds)
        .eq('skipped', false)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', now.toISOString());
        
      if (feedbackError) throw feedbackError;

      feedbackCount = feedbackData?.length || 0;
      console.log('Raw feedback count:', feedbackCount);
    }

    // Return whether feedback exists
    return NextResponse.json({ 
      hasFeedback: feedbackCount > 0,
      count: feedbackCount,
      source: hasAnalysisData ? 'weekly_analysis' : 'raw_data'
    });

  } catch (error) {
    console.error('Error checking feedback:', error);
    return NextResponse.json(
      { error: 'Failed to check feedback' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to get all Monday dates (week starts) between two dates
 */
function getWeekStartDates(startDate: Date, endDate: Date): string[] {
  const weekStarts: string[] = [];
  const current = new Date(startDate);
  
  // Find the Monday of the week containing startDate
  const dayOfWeek = current.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so 6 days back to Monday
  current.setDate(current.getDate() - daysToMonday);
  
  while (current <= endDate) {
    weekStarts.push(current.toISOString().split('T')[0]); // YYYY-MM-DD format
    current.setDate(current.getDate() + 7); // Move to next Monday
  }
  
  return weekStarts;
}