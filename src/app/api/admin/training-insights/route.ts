import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface WeeklySentimentTrend {
  week: string;
  receivedSentiment: number | null;
  providedSentiment: number | null;
  feedbackVolume: number;
}

interface ThemeAnalysis {
  theme: string;
  totalMentions: number;
  avgSentiment: number;
  negativeInstances: number;
  trendScore: number;
  priorityScore: number;
  trainingRecommendation: string;
}

interface TrainingInsightsResponse {
  sentimentTrends: WeeklySentimentTrend[];
  trainingNeeds: ThemeAnalysis[];
  metadata: {
    companyId: string;
    dateRange: {
      start: string;
      end: string;
    };
    totalUsers: number;
    totalWeeks: number;
  };
}

function normalizeTheme(theme: string): string {
  return theme.toLowerCase().trim();
}

function getTrainingRecommendation(theme: string): string {
  const trainingMap: { [key: string]: string } = {
    'communication': 'Communication Skills Training',
    'leadership': 'Leadership Development Program',
    'project management': 'Project Management Certification',
    'time management': 'Time Management Workshop',
    'team collaboration': 'Team Building & Collaboration Training',
    'conflict resolution': 'Conflict Resolution Training',
    'presentation': 'Public Speaking & Presentation Skills',
    'technical skills': 'Technical Skills Development',
    'feedback': 'Giving & Receiving Feedback Training',
    'delegation': 'Delegation & Management Skills',
    'strategic thinking': 'Strategic Planning Workshop',
    'decision making': 'Decision Making & Problem Solving',
    'emotional intelligence': 'Emotional Intelligence Training',
    'mentoring': 'Mentoring & Coaching Skills',
    'innovation': 'Innovation & Creative Thinking Workshop'
  };

  // Check for exact matches first
  const normalizedTheme = normalizeTheme(theme);
  if (trainingMap[normalizedTheme]) {
    return trainingMap[normalizedTheme];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(trainingMap)) {
    if (normalizedTheme.includes(key) || key.includes(normalizedTheme)) {
      return value;
    }
  }

  // Default recommendation
  return `${theme} Skills Development`;
}

async function getWeeklySentimentTrends(companyId: string, startDate: Date, endDate: Date): Promise<WeeklySentimentTrend[]> {
  const { data, error } = await supabase
    .from('weekly_feedback_analysis')
    .select('week_start_date, feedback_received_sentiment_avg, feedback_provided_sentiment_avg, feedback_received_count, feedback_provided_count')
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('week_start_date', startDate.toISOString().split('T')[0])
    .lte('week_start_date', endDate.toISOString().split('T')[0])
    .order('week_start_date', { ascending: true });

  if (error) {
    console.error('Error fetching sentiment trends:', error);
    return [];
  }

  // Group by week and calculate averages
  const weeklyMap = new Map<string, {
    receivedSentiments: number[];
    providedSentiments: number[];
    totalVolume: number;
  }>();

  data?.forEach(row => {
    const week = row.week_start_date;
    if (!weeklyMap.has(week)) {
      weeklyMap.set(week, {
        receivedSentiments: [],
        providedSentiments: [],
        totalVolume: 0
      });
    }

    const weekData = weeklyMap.get(week)!;
    
    if (row.feedback_received_sentiment_avg !== null) {
      weekData.receivedSentiments.push(row.feedback_received_sentiment_avg);
    }
    if (row.feedback_provided_sentiment_avg !== null) {
      weekData.providedSentiments.push(row.feedback_provided_sentiment_avg);
    }
    
    weekData.totalVolume += (row.feedback_received_count || 0) + (row.feedback_provided_count || 0);
  });

  // Convert to array and calculate averages
  return Array.from(weeklyMap.entries()).map(([week, data]) => ({
    week: new Date(week).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
    receivedSentiment: data.receivedSentiments.length > 0 
      ? data.receivedSentiments.reduce((a, b) => a + b, 0) / data.receivedSentiments.length 
      : null,
    providedSentiment: data.providedSentiments.length > 0 
      ? data.providedSentiments.reduce((a, b) => a + b, 0) / data.providedSentiments.length 
      : null,
    feedbackVolume: data.totalVolume
  }));
}

async function analyzeTrainingNeeds(companyId: string, startDate: Date, endDate: Date): Promise<ThemeAnalysis[]> {
  const { data, error } = await supabase
    .from('weekly_feedback_analysis')
    .select('week_start_date, feedback_received_themes, feedback_provided_themes, feedback_received_sentiment_avg, feedback_provided_sentiment_avg')
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('week_start_date', startDate.toISOString().split('T')[0])
    .lte('week_start_date', endDate.toISOString().split('T')[0])
    .order('week_start_date', { ascending: true });

  if (error) {
    console.error('Error fetching theme data:', error);
    return [];
  }

  // Extract and normalize all themes
  const themeData = new Map<string, {
    mentions: { sentiment: number; week: string }[];
    totalMentions: number;
  }>();

  data?.forEach(row => {
    const week = row.week_start_date;
    
    // Process received themes
    if (row.feedback_received_themes && Array.isArray(row.feedback_received_themes)) {
      row.feedback_received_themes.forEach((theme: string) => {
        const normalizedTheme = normalizeTheme(theme);
        if (!themeData.has(normalizedTheme)) {
          themeData.set(normalizedTheme, { mentions: [], totalMentions: 0 });
        }
        
        const data = themeData.get(normalizedTheme)!;
        data.mentions.push({
          sentiment: row.feedback_received_sentiment_avg || 0,
          week
        });
        data.totalMentions++;
      });
    }

    // Process provided themes
    if (row.feedback_provided_themes && Array.isArray(row.feedback_provided_themes)) {
      row.feedback_provided_themes.forEach((theme: string) => {
        const normalizedTheme = normalizeTheme(theme);
        if (!themeData.has(normalizedTheme)) {
          themeData.set(normalizedTheme, { mentions: [], totalMentions: 0 });
        }
        
        const data = themeData.get(normalizedTheme)!;
        data.mentions.push({
          sentiment: row.feedback_provided_sentiment_avg || 0,
          week
        });
        data.totalMentions++;
      });
    }
  });

  // Filter themes with minimum mentions and calculate scores
  const analyses: ThemeAnalysis[] = [];

  themeData.forEach((data, theme) => {
    if (data.totalMentions < 5) return; // Minimum threshold

    const sentiments = data.mentions.map(m => m.sentiment).filter(s => s !== null);
    const avgSentiment = sentiments.length > 0 
      ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length 
      : 0;

    const negativeInstances = sentiments.filter(s => s < -0.25).length;
    
    // Calculate trend score (comparing first half vs second half)
    const midPoint = Math.floor(data.mentions.length / 2);
    const firstHalfSentiments = data.mentions.slice(0, midPoint).map(m => m.sentiment);
    const secondHalfSentiments = data.mentions.slice(midPoint).map(m => m.sentiment);
    
    const firstHalfAvg = firstHalfSentiments.length > 0 
      ? firstHalfSentiments.reduce((a, b) => a + b, 0) / firstHalfSentiments.length 
      : 0;
    const secondHalfAvg = secondHalfSentiments.length > 0 
      ? secondHalfSentiments.reduce((a, b) => a + b, 0) / secondHalfSentiments.length 
      : 0;
    
    const trendScore = firstHalfAvg - secondHalfAvg; // Positive means declining

    // Calculate priority score
    const consistencyScore = Math.min(data.totalMentions / 20, 1); // Normalize to 0-1
    const negativeSentimentScore = negativeInstances / data.totalMentions;
    const decliningTrendScore = Math.max(trendScore, 0) / 2; // Normalize to 0-1

    const priorityScore = (consistencyScore * 0.3) + (negativeSentimentScore * 0.5) + (decliningTrendScore * 0.2);

    analyses.push({
      theme,
      totalMentions: data.totalMentions,
      avgSentiment,
      negativeInstances,
      trendScore,
      priorityScore,
      trainingRecommendation: getTrainingRecommendation(theme)
    });
  });

  // Sort by priority score descending and return top 10
  return analyses
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return Response.json({ error: 'Company ID is required' }, { status: 400 });
    }

    // Calculate date range (last 3 months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    // Get sentiment trends
    const sentimentTrends = await getWeeklySentimentTrends(companyId, startDate, endDate);

    // Get training needs analysis
    const trainingNeeds = await analyzeTrainingNeeds(companyId, startDate, endDate);

    // Get metadata
    const { data: userCount } = await supabase
      .from('weekly_feedback_analysis')
      .select('user_id')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .gte('week_start_date', startDate.toISOString().split('T')[0])
      .lte('week_start_date', endDate.toISOString().split('T')[0]);

    const uniqueUsers = new Set(userCount?.map(row => row.user_id) || []).size;

    const response: TrainingInsightsResponse = {
      sentimentTrends,
      trainingNeeds,
      metadata: {
        companyId,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        },
        totalUsers: uniqueUsers,
        totalWeeks: sentimentTrends.length
      }
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error in training insights API:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}