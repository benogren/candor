// app/api/dashboard/monthly-metrics/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface WeeklySentimentData {
  week: string;
  receivedSentiment: number | null;
  providedSentiment: number | null;
}

interface MonthlyMetrics {
  feedbackReceived: {
    current: number;
    previous: number;
    trend: number;
  };
  participationRate: {
    current: number;
    previous: number;
    trend: number;
  };
  healthScore: {
    current: number;
    previous: number;
    trend: number;
  };
  weeklySentiment: WeeklySentimentData[];
}

function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

async function getMonthlyFeedbackReceived(userId: string, isCurrentMonth: boolean) {
  const now = new Date();
  const year = now.getFullYear();
  const month = isCurrentMonth ? now.getMonth() : now.getMonth() - 1;
  
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);
  
  const { data, error } = await supabase
    .rpc('get_user_feedback_summary', {
      target_user_id: userId,
      start_date: startDate.toISOString()
    });

  if (error) {
    console.error('Error fetching feedback:', error);
    return 0;
  }

  const feedbackData = data?.feedback_data || [];
  return feedbackData.filter((item: any) => {
    const createdAt = new Date(item.created_at);
    return createdAt >= startDate && createdAt <= endDate;
  }).length;
}

async function getMonthlyHealthScore(userId: string, isCurrentMonth: boolean) {
  const now = new Date();
  const year = now.getFullYear();
  const month = isCurrentMonth ? now.getMonth() : now.getMonth() - 1;
  
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  
  // Get the latest health score for the month
  const { data, error } = await supabase
    .from('weekly_feedback_health_scores')
    .select('overall_health_score')
    .eq('user_id', userId)
    .gte('week_start_date', startDate.toISOString().split('T')[0])
    .lte('week_start_date', endDate.toISOString().split('T')[0])
    .order('week_start_date', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return 0;
  }

  return data[0].overall_health_score || 0;
}

async function getMonthlyParticipationRate(userId: string, isCurrentMonth: boolean) {
  const now = new Date();
  const year = now.getFullYear();
  const month = isCurrentMonth ? now.getMonth() : now.getMonth() - 1;
  
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  // Get user's company
  const { data: userData, error: userError } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('id', userId)
    .single();

  if (userError) return 0;

  // Get all feedback cycle occurrences for the month
  const { data: occurrences, error: occError } = await supabase
    .from('feedback_cycle_occurrences')
    .select('id, cycle_id')
    .gte('start_date', startDate.toISOString())
    .lte('end_date', endDate.toISOString());

  if (occError || !occurrences || occurrences.length === 0) {
    return 0;
  }

  // Get user's participation in these cycles
  const { data: sessions, error: sessError } = await supabase
    .from('feedback_sessions')
    .select('occurrence_id, status')
    .eq('provider_id', userId)
    .in('occurrence_id', occurrences.map(occ => occ.id));

  if (sessError) return 0;

  const completedSessions = sessions?.filter(session => session.status === 'completed') || [];
  const participationRate = occurrences.length > 0 
    ? (completedSessions.length / occurrences.length) * 100 
    : 0;

  return Math.round(participationRate);
}

async function getWeeklySentimentData(userId: string): Promise<WeeklySentimentData[]> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);
  
  // Find the Monday of the week that contains the first day of the month
  let queryStartDate = new Date(startDate);
  while (queryStartDate.getDay() !== 1) {
    queryStartDate.setDate(queryStartDate.getDate() - 1);
  }
  
  // Find the Sunday of the week that contains the last day of the month
  let queryEndDate = new Date(endDate);
  while (queryEndDate.getDay() !== 0) {
    queryEndDate.setDate(queryEndDate.getDate() + 1);
  }
  
  // Get weekly feedback analysis data (expanded range to include overlapping weeks)
  const { data: weeklyData, error } = await supabase
    .from('weekly_feedback_analysis')
    .select('week_start_date, feedback_received_sentiment_avg, feedback_provided_sentiment_avg')
    .eq('user_id', userId)
    .gte('week_start_date', queryStartDate.toISOString().split('T')[0])
    .lte('week_start_date', queryEndDate.toISOString().split('T')[0])
    .order('week_start_date', { ascending: true });

  if (error) {
    console.error('Error fetching weekly sentiment data:', error);
    return [];
  }

  // Generate all weeks that overlap with the month
  const weeks: WeeklySentimentData[] = [];
  let currentWeekStart = new Date(queryStartDate);
  
  while (currentWeekStart <= queryEndDate) {
    const weekKey = currentWeekStart.toISOString().split('T')[0];
    const weekData = weeklyData?.find(w => w.week_start_date === weekKey);
    
    weeks.push({
      week: `${currentWeekStart.getMonth() + 1}/${currentWeekStart.getDate()}`,
      receivedSentiment: weekData?.feedback_received_sentiment_avg || null,
      providedSentiment: weekData?.feedback_provided_sentiment_avg || null
    });
    
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }
  
  return weeks;
}

async function getTeamWeeklySentimentData(userId: string): Promise<WeeklySentimentData[]> {
  // Get team members
  const { data: teamMembers, error: teamError } = await supabase
    .from('org_structure')
    .select('id')
    .eq('manager_id', userId);

  if (teamError || !teamMembers || teamMembers.length === 0) {
    return [];
  }

  const memberIds = teamMembers.map(member => member.id);
  
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);
  
  // Find the Monday of the week that contains the first day of the month
  let queryStartDate = new Date(startDate);
  while (queryStartDate.getDay() !== 1) {
    queryStartDate.setDate(queryStartDate.getDate() - 1);
  }
  
  // Find the Sunday of the week that contains the last day of the month
  let queryEndDate = new Date(endDate);
  while (queryEndDate.getDay() !== 0) {
    queryEndDate.setDate(queryEndDate.getDate() + 1);
  }
  
  // Get weekly feedback analysis data for all team members (expanded range)
  const { data: weeklyData, error } = await supabase
    .from('weekly_feedback_analysis')
    .select('week_start_date, user_id, feedback_received_sentiment_avg, feedback_provided_sentiment_avg')
    .in('user_id', memberIds)
    .gte('week_start_date', queryStartDate.toISOString().split('T')[0])
    .lte('week_start_date', queryEndDate.toISOString().split('T')[0])
    .order('week_start_date', { ascending: true });

  if (error) {
    console.error('Error fetching team weekly sentiment data:', error);
    return [];
  }

  // Generate all weeks that overlap with the month and aggregate team data
  const weeks: WeeklySentimentData[] = [];
  let currentWeekStart = new Date(queryStartDate);
  
  while (currentWeekStart <= queryEndDate) {
    const weekKey = currentWeekStart.toISOString().split('T')[0];
    const weekDataForAllMembers = weeklyData?.filter(w => w.week_start_date === weekKey) || [];
    
    // Calculate averages across team members
    let totalReceived = 0;
    let totalProvided = 0;
    let receivedCount = 0;
    let providedCount = 0;
    
    weekDataForAllMembers.forEach(data => {
      if (data.feedback_received_sentiment_avg !== null) {
        totalReceived += data.feedback_received_sentiment_avg;
        receivedCount++;
      }
      if (data.feedback_provided_sentiment_avg !== null) {
        totalProvided += data.feedback_provided_sentiment_avg;
        providedCount++;
      }
    });
    
    weeks.push({
      week: `${currentWeekStart.getMonth() + 1}/${currentWeekStart.getDate()}`,
      receivedSentiment: receivedCount > 0 ? totalReceived / receivedCount : null,
      providedSentiment: providedCount > 0 ? totalProvided / providedCount : null
    });
    
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }
  
  return weeks;
}

async function getTeamAggregateMetrics(userId: string, isCurrentMonth: boolean) {
  // Get team members
  const { data: teamMembers, error: teamError } = await supabase
    .from('org_structure')
    .select('id')
    .eq('manager_id', userId);

  if (teamError || !teamMembers || teamMembers.length === 0) {
    return { feedbackReceived: 0, healthScore: 0, participationRate: 0 };
  }

  const memberIds = teamMembers.map(member => member.id);
  
  // Aggregate feedback received
  let totalFeedback = 0;
  let totalHealthScore = 0;
  let totalParticipation = 0;
  let validMembers = 0;

  for (const memberId of memberIds) {
    const feedback = await getMonthlyFeedbackReceived(memberId, isCurrentMonth);
    const health = await getMonthlyHealthScore(memberId, isCurrentMonth);
    const participation = await getMonthlyParticipationRate(memberId, isCurrentMonth);
    
    totalFeedback += feedback;
    totalHealthScore += health;
    totalParticipation += participation;
    validMembers++;
  }

  return {
    feedbackReceived: totalFeedback,
    healthScore: validMembers > 0 ? totalHealthScore / validMembers : 0,
    participationRate: validMembers > 0 ? totalParticipation / validMembers : 0
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const mode = searchParams.get('mode');
    const selectedMemberId = searchParams.get('selectedMemberId');

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }

    let metrics: MonthlyMetrics;

    if (mode === 'team' && (!selectedMemberId || selectedMemberId === 'all')) {
      // Manager view - aggregate team metrics
      const currentMonth = await getTeamAggregateMetrics(userId, true);
      const previousMonth = await getTeamAggregateMetrics(userId, false);
      const weeklySentiment = await getTeamWeeklySentimentData(userId);

      metrics = {
        feedbackReceived: {
          current: currentMonth.feedbackReceived,
          previous: previousMonth.feedbackReceived,
          trend: calculateTrend(currentMonth.feedbackReceived, previousMonth.feedbackReceived)
        },
        participationRate: {
          current: currentMonth.participationRate,
          previous: previousMonth.participationRate,
          trend: calculateTrend(currentMonth.participationRate, previousMonth.participationRate)
        },
        healthScore: {
          current: currentMonth.healthScore,
          previous: previousMonth.healthScore,
          trend: calculateTrend(currentMonth.healthScore, previousMonth.healthScore)
        },
        weeklySentiment
      };
    } else {
      // Individual view (personal or specific team member)
      const targetUserId = (mode === 'team' && selectedMemberId && selectedMemberId !== 'all') 
        ? selectedMemberId 
        : userId;

      // Get current month metrics
      const currentFeedback = await getMonthlyFeedbackReceived(targetUserId, true);
      const currentHealth = await getMonthlyHealthScore(targetUserId, true);
      const currentParticipation = await getMonthlyParticipationRate(targetUserId, true);

      // Get previous month metrics
      const previousFeedback = await getMonthlyFeedbackReceived(targetUserId, false);
      const previousHealth = await getMonthlyHealthScore(targetUserId, false);
      const previousParticipation = await getMonthlyParticipationRate(targetUserId, false);
      
      // Get weekly sentiment data
      const weeklySentiment = await getWeeklySentimentData(targetUserId);

      metrics = {
        feedbackReceived: {
          current: currentFeedback,
          previous: previousFeedback,
          trend: calculateTrend(currentFeedback, previousFeedback)
        },
        participationRate: {
          current: currentParticipation,
          previous: previousParticipation,
          trend: calculateTrend(currentParticipation, previousParticipation)
        },
        healthScore: {
          current: currentHealth,
          previous: previousHealth,
          trend: calculateTrend(currentHealth, previousHealth)
        },
        weeklySentiment
      };
    }

    return Response.json(metrics);
  } catch (error) {
    console.error('Error fetching monthly metrics:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}