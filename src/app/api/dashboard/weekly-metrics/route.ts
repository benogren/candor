// app/api/dashboard/weekly-metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Type definitions
interface FeedbackAnalysisData {
  week_start_date: string;
  feedback_received_count: number;
  feedback_provided_count: number;
}

interface HealthScoreData {
  week_start_date: string;
  overall_health_score: number;
}

// interface AggregatedHealthData extends HealthScoreData {
//   count: number;
// }

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const mode = searchParams.get('mode'); // 'personal' or 'team'
    const selectedMemberId = searchParams.get('selectedMemberId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get current date and calculate week boundaries
    const now = new Date();
    const currentWeekStart = await getWeekStart(now);
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(currentWeekStart.getDate() - 7);

    console.log('****Current week start:', currentWeekStart);
    console.log('****Last week start:', lastWeekStart);
    
    let metrics;
    
    if (mode === 'team' && selectedMemberId && selectedMemberId !== 'all') {
      // Get metrics for specific team member
      metrics = await getIndividualMetrics(selectedMemberId, currentWeekStart, lastWeekStart);
    } else if (mode === 'team') {
      // Get aggregated metrics for all team members
      metrics = await getTeamAggregatedMetrics(userId, currentWeekStart, lastWeekStart);
    } else {
      // Get personal metrics
      metrics = await getIndividualMetrics(userId, currentWeekStart, lastWeekStart);
    }

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching weekly metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly metrics' },
      { status: 500 }
    );
  }
}

async function getWeekStart(date: Date): Promise<Date> {
    console.log('Fetching week start date from Supabase...', date);
    const { data: thisWeek, error: thisWeekError } = await supabase.rpc('get_week_start_date');
    
    if (thisWeekError) {
        console.error('Error fetching week start date from Supabase:', thisWeekError);
        throw thisWeekError;
    }
    
    const d = new Date(thisWeek);

  const weekStart = new Date(d);
  weekStart.setDate(weekStart.getDate() - 8); // Adjust to start of the week
  weekStart.setHours(0, 0, 0, 0);

  return weekStart;
}

async function getIndividualMetrics(userId: string, currentWeekStart: Date, lastWeekStart: Date) {
  console.log('****Fetching individual metrics for user:', userId, 'current week start:', currentWeekStart, 'last week start:', lastWeekStart);
  // Get feedback analysis data
  const { data: analysisData, error: analysisError } = await supabase
    .from('weekly_feedback_analysis')
    .select('week_start_date, feedback_received_count, feedback_provided_count')
    .eq('user_id', userId)
    .in('week_start_date', [
      currentWeekStart.toISOString().split('T')[0],
      lastWeekStart.toISOString().split('T')[0]
    ])
    .order('week_start_date', { ascending: false });

  if (analysisError) throw analysisError;

  // Get health scores data
  const { data: healthData, error: healthError } = await supabase
    .from('weekly_feedback_health_scores')
    .select('week_start_date, overall_health_score')
    .eq('user_id', userId)
    .in('week_start_date', [
      currentWeekStart.toISOString().split('T')[0],
      lastWeekStart.toISOString().split('T')[0]
    ])
    .order('week_start_date', { ascending: false });

  if (healthError) throw healthError;

  return calculateMetrics(analysisData || [], healthData || []);
}

async function getTeamAggregatedMetrics(managerId: string, currentWeekStart: Date, lastWeekStart: Date) {
  // First get all team members
  const { data: teamMembers, error: teamError } = await supabase
    .from('org_structure')
    .select('id')
    .eq('manager_id', managerId)
    .eq('is_invited', false); // Only get non-invited members for now

  if (teamError) throw teamError;

  if (!teamMembers || teamMembers.length === 0) {
    return {
      feedbackReceived: { current: 0, previous: 0, trend: 0 },
      feedbackProvided: { current: 0, previous: 0, trend: 0 },
      healthScore: { current: 0, previous: 0, trend: 0 }
    };
  }

  const teamMemberIds = teamMembers.map(member => member.id);

  // Get aggregated feedback analysis data
  const { data: analysisData, error: analysisError } = await supabase
    .from('weekly_feedback_analysis')
    .select('week_start_date, feedback_received_count, feedback_provided_count')
    .in('user_id', teamMemberIds)
    .in('week_start_date', [
      currentWeekStart.toISOString().split('T')[0],
      lastWeekStart.toISOString().split('T')[0]
    ]);

  if (analysisError) throw analysisError;

  // Get aggregated health scores data
  const { data: healthData, error: healthError } = await supabase
    .from('weekly_feedback_health_scores')
    .select('week_start_date, overall_health_score')
    .in('user_id', teamMemberIds)
    .in('week_start_date', [
      currentWeekStart.toISOString().split('T')[0],
      lastWeekStart.toISOString().split('T')[0]
    ]);

  if (healthError) throw healthError;

  // Aggregate the data by week
  const aggregatedAnalysis = aggregateByWeek(analysisData || [], 'feedback') as FeedbackAnalysisData[];
  const aggregatedHealth = aggregateByWeek(healthData || [], 'health') as HealthScoreData[];

  return calculateMetrics(aggregatedAnalysis, aggregatedHealth);
}

function aggregateByWeek(data: FeedbackAnalysisData[] | HealthScoreData[], type: 'feedback' | 'health'): FeedbackAnalysisData[] | HealthScoreData[] {
  const weekMap = new Map();

  data.forEach(row => {
    const week = row.week_start_date;
    if (!weekMap.has(week)) {
      if (type === 'feedback') {
        weekMap.set(week, {
          week_start_date: week,
          feedback_received_count: 0,
          feedback_provided_count: 0
        });
      } else {
        weekMap.set(week, {
          week_start_date: week,
          overall_health_score: 0,
          count: 0
        });
      }
    }

    const existing = weekMap.get(week);
    if (type === 'feedback') {
      const feedbackRow = row as FeedbackAnalysisData;
      existing.feedback_received_count += feedbackRow.feedback_received_count || 0;
      existing.feedback_provided_count += feedbackRow.feedback_provided_count || 0;
    } else {
      const healthRow = row as HealthScoreData;
      existing.overall_health_score += healthRow.overall_health_score || 0;
      existing.count += 1;
    }
  });

  // For health scores, calculate averages
  if (type === 'health') {
    weekMap.forEach((value) => {
      if (value.count > 0) {
        value.overall_health_score = value.overall_health_score / value.count;
      }
      delete value.count;
    });
  }

  return Array.from(weekMap.values());
}

function calculateMetrics(analysisData: FeedbackAnalysisData[], healthData: HealthScoreData[]) {
  console.log('****Calculating metrics with analysis data:', analysisData);
  console.log('****Calculating metrics with health data:', healthData);
  
  // Sort by date descending (current week first)
  const sortedAnalysis = analysisData.sort((a, b) => 
    new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime()
  );
  const sortedHealth = healthData.sort((a, b) => 
    new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime()
  );

  // Get current and previous week data
  const currentAnalysis = sortedAnalysis[0];
  const previousAnalysis = sortedAnalysis[1];
  const currentHealth = sortedHealth[0];
  const previousHealth = sortedHealth[1];

  console.log('****Current analysis:', currentAnalysis);
  console.log('****Previous analysis:', previousAnalysis);
  console.log('****Current health:', currentHealth);
  console.log('****Previous health:', previousHealth);

  // Calculate trends
  const feedbackReceivedTrend = calculateTrend(
    currentAnalysis?.feedback_received_count || 0,
    previousAnalysis?.feedback_received_count || 0
  );

  const feedbackProvidedTrend = calculateTrend(
    currentAnalysis?.feedback_provided_count || 0,
    previousAnalysis?.feedback_provided_count || 0
  );

  const healthScoreTrend = calculateTrend(
    currentHealth?.overall_health_score || 0,
    previousHealth?.overall_health_score || 0
  );

  const result = {
    feedbackReceived: {
      current: currentAnalysis?.feedback_received_count || 0,
      previous: previousAnalysis?.feedback_received_count || 0,
      trend: feedbackReceivedTrend
    },
    feedbackProvided: {
      current: currentAnalysis?.feedback_provided_count || 0,
      previous: previousAnalysis?.feedback_provided_count || 0,
      trend: feedbackProvidedTrend
    },
    healthScore: {
      current: currentHealth?.overall_health_score || 0,
      previous: previousHealth?.overall_health_score || 0,
      trend: healthScoreTrend
    }
  };

  console.log('****Final calculated metrics:', result);
  return result;
}

function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}