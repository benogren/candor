// src/app/api/notes/generate/summary/route.ts
import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface FeedbackSummaryRequest {
  userId: string;
  employeeId?: string;
  timeframe: string;
  isInvited?: boolean;
}

interface UserContext {
  userName: string;
  jobTitle: string;
  company: string;
  industry: string;
}

interface WeeklyAnalysis {
  id: string;
  user_id: string;
  week_start_date: string;
  company_id: string;
  feedback_received_count: number;
  feedback_received_sentiment_avg: number | null;
  feedback_received_summary: string | null;
  feedback_received_themes: string[];
  feedback_provided_count: number;
  feedback_provided_sentiment_avg: number | null;
  feedback_provided_summary: string | null;
  feedback_provided_themes: string[];
  company_value_nominations_received: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AggregatedSummary {
  totalFeedbackReceived: number;
  totalFeedbackProvided: number;
  averageReceivedSentiment: number;
  averageProvidedSentiment: number;
  totalValueNominations: number;
  combinedReceivedSummary: string;
  combinedProvidedSummary: string;
  weeksAnalyzed: number;
  dateRange: { start: string; end: string };
  receivedThemes: string[];
  providedThemes: string[];
}

interface StructuredFeedbackAnalysis {
  strengths: string[];
  developmentAreas: string[];
  keyThemes: {
    received: string[];
    provided: string[];
  };
  performanceIndicators: {
    engagementLevel: string;
    recognitionLevel: string;
    sentimentLevel: string;
  };
  notableQuotes: string[];
  condensedSummary: string;
}

interface DatabaseCompany {
  name: string;
  industry: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as FeedbackSummaryRequest;
    const { userId, employeeId, timeframe, isInvited = false } = body;

    console.log('=== Stage 1: Starting feedback analysis from weekly summaries ===');
    console.log('Target user:', employeeId || userId, 'Timeframe:', timeframe);

    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bearerToken = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get user context and weekly summaries
    const data = await fetchWeeklySummaries(
      supabase, 
      employeeId || userId, 
      timeframe, 
      isInvited
    );

    if (!data.weeklySummaries || data.weeklySummaries.length === 0) {
      return NextResponse.json({
        success: true,
        summary: `No feedback analysis available for the ${timeframe} timeframe.`,
        structuredAnalysis: getEmptyStructuredAnalysis(),
        userContext: data.userContext,
        feedbackCount: 0,
        metadata: {
          weeksAnalyzed: 0,
          source: 'weekly_analysis',
          status: 'no_data'
        }
      });
    }

    // Aggregate weekly summaries
    const aggregatedSummary = aggregateWeeklySummaries(data.weeklySummaries);
    
    // Generate both detailed and structured summaries
    const detailedSummary = generateDetailedSummaryText(aggregatedSummary, data.userContext);
    const structuredAnalysis = generateStructuredAnalysis(aggregatedSummary, data.userContext);

    console.log('=== Stage 1: Analysis complete ===');
    return NextResponse.json({
      success: true,
      summary: detailedSummary, // Keep for backward compatibility
      structuredAnalysis, // New structured format for AI consumption
      userContext: data.userContext,
      feedbackCount: aggregatedSummary.totalFeedbackReceived,
      metadata: {
        weeksAnalyzed: aggregatedSummary.weeksAnalyzed,
        dateRange: aggregatedSummary.dateRange,
        source: 'weekly_analysis',
        status: 'success',
        totalValueNominations: aggregatedSummary.totalValueNominations,
        averageSentiment: aggregatedSummary.averageReceivedSentiment
      }
    });

  } catch (error) {
    console.error('Stage 1 error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze feedback' }, 
      { status: 500 }
    );
  }
}

function generateStructuredAnalysis(
  summary: AggregatedSummary, 
  userContext: UserContext
): StructuredFeedbackAnalysis {
  
  // Extract strengths and development areas from summaries
  const { strengths, developmentAreas, quotes } = extractKeyInsights(
    summary.combinedReceivedSummary, 
    summary.combinedProvidedSummary
  );

  const sentimentDescription = (score: number) => {
    if (score >= 0.7) return 'very positive';
    if (score >= 0.5) return 'positive';
    if (score >= 0.3) return 'neutral';
    if (score >= 0.1) return 'mixed';
    return 'needs attention';
  };

  // Create condensed summary for AI consumption (much shorter)
  const condensedSummary = `${userContext.userName} (${userContext.jobTitle}) - ${summary.weeksAnalyzed} weeks analysis: 
${summary.totalFeedbackReceived} feedback responses received, ${summary.totalValueNominations} value nominations.
Overall sentiment: ${sentimentDescription(summary.averageReceivedSentiment)} (${(summary.averageReceivedSentiment * 100).toFixed(1)}%).
Key strengths: ${strengths.slice(0, 3).join(', ')}.
Development areas: ${developmentAreas.slice(0, 3).join(', ')}.
Primary themes: ${summary.receivedThemes.slice(0, 3).join(', ')}.`;

  return {
    strengths: strengths.slice(0, 5), // Limit to top 5
    developmentAreas: developmentAreas.slice(0, 5),
    keyThemes: {
      received: summary.receivedThemes.slice(0, 5),
      provided: summary.providedThemes.slice(0, 5)
    },
    performanceIndicators: {
      engagementLevel: summary.totalFeedbackProvided > 0 ? 'Active contributor' : 'Limited activity',
      recognitionLevel: summary.totalValueNominations > 0 
        ? `${summary.totalValueNominations} value nominations` 
        : 'No recent nominations',
      sentimentLevel: sentimentDescription(summary.averageReceivedSentiment)
    },
    notableQuotes: quotes.slice(0, 3), // Limit to 3 most relevant quotes
    condensedSummary
  };
}

function extractKeyInsights(receivedSummary: string, providedSummary: string) {
  // Simple keyword-based extraction (you could enhance this with NLP)
  const strengthKeywords = [
    'effective', 'excellent', 'strong', 'skilled', 'proficient', 'outstanding',
    'reliable', 'consistent', 'clear communication', 'leadership', 'collaborative',
    'knowledgeable', 'helpful', 'responsive', 'organized', 'proactive'
  ];

  const developmentKeywords = [
    'could improve', 'needs work', 'development area', 'challenge', 'struggle',
    'difficulty', 'inconsistent', 'unclear', 'delayed', 'missed', 'avoid',
    'hesitant', 'defensive', 'overwhelmed'
  ];

  const strengths: string[] = [];
  const developmentAreas: string[] = [];
  const quotes: string[] = [];

  const allText = receivedSummary + ' ' + providedSummary;
  const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 20);

  sentences.forEach(sentence => {
    const lowerSentence = sentence.toLowerCase();
    
    // Extract notable quotes (sentences with specific feedback)
    if (sentence.includes('"') || sentence.includes('noted') || sentence.includes('feedback')) {
      quotes.push(sentence.trim());
    }

    // Identify strengths
    strengthKeywords.forEach(keyword => {
      if (lowerSentence.includes(keyword)) {
        const insight = extractInsightFromSentence(sentence, keyword, 'strength');
        if (insight && !strengths.includes(insight)) {
          strengths.push(insight);
        }
      }
    });

    // Identify development areas
    developmentKeywords.forEach(keyword => {
      if (lowerSentence.includes(keyword)) {
        const insight = extractInsightFromSentence(sentence, keyword, 'development');
        if (insight && !developmentAreas.includes(insight)) {
          developmentAreas.push(insight);
        }
      }
    });
  });

  return { strengths, developmentAreas, quotes };
}

function extractInsightFromSentence(sentence: string, keyword: string, type: 'strength' | 'development'): string | null {
  // Clean up and format the insight
  console.log(`Extracting insights: "${keyword}" as ${type}`);

  const cleaned = sentence.trim();
  if (cleaned.length > 200) return null; // Skip overly long sentences
  
  // Return a concise version of the insight
  return cleaned.length > 100 ? cleaned.substring(0, 97) + '...' : cleaned;
}

function getEmptyStructuredAnalysis(): StructuredFeedbackAnalysis {
  return {
    strengths: [],
    developmentAreas: [],
    keyThemes: { received: [], provided: [] },
    performanceIndicators: {
      engagementLevel: 'No data',
      recognitionLevel: 'No data',
      sentimentLevel: 'No data'
    },
    notableQuotes: [],
    condensedSummary: 'No feedback data available for analysis.'
  };
}

// Keep the original detailed summary for backward compatibility
function generateDetailedSummaryText(summary: AggregatedSummary, userContext: UserContext): string {
  const sentimentDescription = (score: number) => {
    if (score >= 0.7) return 'very positive';
    if (score >= 0.5) return 'positive';
    if (score >= 0.3) return 'neutral';
    if (score >= 0.1) return 'mixed';
    return 'needs attention';
  };

  return `**FEEDBACK ANALYSIS FOR ${userContext.userName.toUpperCase()}**

**OVERVIEW:**
- Analysis period: ${summary.weeksAnalyzed} weeks (${summary.dateRange.start} to ${summary.dateRange.end})
- Total feedback received: ${summary.totalFeedbackReceived} responses
- Total feedback provided: ${summary.totalFeedbackProvided} responses
- Company value nominations received: ${summary.totalValueNominations}
- Overall sentiment of received feedback: ${sentimentDescription(summary.averageReceivedSentiment)} (${(summary.averageReceivedSentiment * 100).toFixed(1)}%)

**FEEDBACK RECEIVED ANALYSIS:**
${summary.combinedReceivedSummary || 'No detailed feedback received summary available.'}

**FEEDBACK PROVIDED ANALYSIS:**
${summary.combinedProvidedSummary || 'No detailed feedback provided summary available.'}

**KEY THEMES IDENTIFIED:**
${summary.receivedThemes.length > 0 ? `
Feedback Received Themes: ${summary.receivedThemes.slice(0, 5).join(', ')}` : ''}
${summary.providedThemes.length > 0 ? `
Feedback Provided Themes: ${summary.providedThemes.slice(0, 5).join(', ')}` : ''}

**PERFORMANCE INDICATORS:**
- Feedback engagement: ${summary.totalFeedbackProvided > 0 ? 'Active contributor' : 'Limited feedback activity'}
- Recognition level: ${summary.totalValueNominations > 0 ? `${summary.totalValueNominations} value-based nominations` : 'No recent value nominations'}
- Peer perception: ${sentimentDescription(summary.averageReceivedSentiment)} overall sentiment

*This analysis is compiled from ${summary.weeksAnalyzed} weeks of processed feedback data and represents comprehensive insights into performance and collaboration patterns.*`;
}

// ... rest of your existing functions (fetchWeeklySummaries, calculateWeekRange, aggregateWeeklySummaries)
async function fetchWeeklySummaries(
  supabase: SupabaseClient, 
  targetUserId: string, 
  timeframe: string,
  isInvited: boolean
): Promise<{ userContext: UserContext; weeklySummaries: WeeklyAnalysis[] }> {
  console.log('Fetching weekly summaries from database...');
  
  const { startDate, weeksToFetch } = calculateWeekRange(timeframe);
  
  console.log(`Fetching weekly summaries from ${startDate.toISOString()} (${weeksToFetch} weeks)`);

  let userContext: UserContext;
  
  if (isInvited) {
    const { data: invitedUser, error: invitedError } = await supabase
      .from('invited_users')
      .select(`
        id, name, email, job_title, role,
        companies!inner(name, industry)
      `)
      .eq('id', targetUserId)
      .single();

    if (invitedError || !invitedUser) {
      throw new Error(`Failed to fetch invited user data: ${invitedError?.message}`);
    }

    const userData = invitedUser as {
      name: string | null;
      job_title: string | null;
      companies: DatabaseCompany | DatabaseCompany[];
    };
    
    const companyData = Array.isArray(userData.companies) 
      ? userData.companies[0] 
      : userData.companies;
    
    userContext = {
      userName: userData.name || 'User',
      jobTitle: userData.job_title || 'Team Member',
      company: companyData?.name || 'Company',
      industry: companyData?.industry || 'Unknown Industry'
    };
  } else {
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select(`
        id, name, email, job_title,
        company_members!inner(
          company_id,
          companies!inner(name, industry)
        )
      `)
      .eq('id', targetUserId)
      .single();

    if (userError || !userData) {
      throw new Error(`Failed to fetch user data: ${userError?.message}`);
    }

    const user = userData as {
      name: string | null;
      job_title: string | null;
      company_members: Array<{
        companies: DatabaseCompany | DatabaseCompany[];
      }> | {
        companies: DatabaseCompany | DatabaseCompany[];
      };
    };

    const companyMembers = Array.isArray(user.company_members) 
      ? user.company_members[0] 
      : user.company_members;
      
    const companies = companyMembers?.companies;
    const companyData = Array.isArray(companies) ? companies[0] : companies;

    userContext = {
      userName: user.name || 'User',
      jobTitle: user.job_title || 'Team Member',
      company: companyData?.name || 'Company',
      industry: companyData?.industry || 'Unknown Industry'
    };
  }

  const { data: weeklySummaries, error: summariesError } = await supabase
    .from('weekly_feedback_analysis')
    .select('*')
    .eq('user_id', targetUserId)
    .eq('status', 'completed')
    .gte('week_start_date', startDate.toISOString().split('T')[0])
    .order('week_start_date', { ascending: false })
    .limit(weeksToFetch);

  if (summariesError) {
    console.error('Error fetching weekly summaries:', summariesError);
    throw new Error(`Failed to fetch weekly summaries: ${summariesError.message}`);
  }

  console.log(`Found ${weeklySummaries?.length || 0} completed weekly summaries`);

  return {
    userContext,
    weeklySummaries: (weeklySummaries || []) as WeeklyAnalysis[]
  };
}

function calculateWeekRange(timeframe: string): { startDate: Date; weeksToFetch: number } {
  const today = new Date();
  const startDate = new Date();
  let weeksToFetch: number;

  switch (timeframe) {
    case 'week':
      startDate.setDate(today.getDate() - 7);
      weeksToFetch = 1;
      break;
    case 'month':
      startDate.setDate(today.getDate() - 30);
      weeksToFetch = 4;
      break;
    case 'quarter':
      startDate.setDate(today.getDate() - 90);
      weeksToFetch = 12;
      break;
    case 'year':
      startDate.setDate(today.getDate() - 180);
      weeksToFetch = 26;
      break;
    default:
      startDate.setFullYear(today.getFullYear() - 1);
      weeksToFetch = 52;
      break;
  }

  return { startDate, weeksToFetch };
}

function aggregateWeeklySummaries(weeklySummaries: WeeklyAnalysis[]): AggregatedSummary {
  if (weeklySummaries.length === 0) {
    throw new Error('No weekly summaries to aggregate');
  }

  const sortedSummaries = weeklySummaries.sort(
    (a, b) => new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime()
  );

  const totalFeedbackReceived = sortedSummaries.reduce(
    (sum, week) => sum + (week.feedback_received_count || 0), 0
  );
  
  const totalFeedbackProvided = sortedSummaries.reduce(
    (sum, week) => sum + (week.feedback_provided_count || 0), 0
  );

  const totalValueNominations = sortedSummaries.reduce(
    (sum, week) => sum + (week.company_value_nominations_received || 0), 0
  );

  let totalReceivedSentiment = 0;
  let totalReceivedWeight = 0;
  let totalProvidedSentiment = 0;
  let totalProvidedWeight = 0;

  sortedSummaries.forEach(week => {
    if (week.feedback_received_sentiment_avg && week.feedback_received_count > 0) {
      totalReceivedSentiment += week.feedback_received_sentiment_avg * week.feedback_received_count;
      totalReceivedWeight += week.feedback_received_count;
    }
    if (week.feedback_provided_sentiment_avg && week.feedback_provided_count > 0) {
      totalProvidedSentiment += week.feedback_provided_sentiment_avg * week.feedback_provided_count;
      totalProvidedWeight += week.feedback_provided_count;
    }
  });

  const averageReceivedSentiment = totalReceivedWeight > 0 
    ? totalReceivedSentiment / totalReceivedWeight 
    : 0;
  
  const averageProvidedSentiment = totalProvidedWeight > 0 
    ? totalProvidedSentiment / totalProvidedWeight 
    : 0;

  const receivedSummaries = sortedSummaries
    .filter(week => week.feedback_received_summary && week.feedback_received_summary.trim())
    .slice(0, 6)
    .map(week => week.feedback_received_summary!);

  const providedSummaries = sortedSummaries
    .filter(week => week.feedback_provided_summary && week.feedback_provided_summary.trim())
    .slice(0, 6)
    .map(week => week.feedback_provided_summary!);

  const allReceivedThemes = sortedSummaries
    .flatMap(week => week.feedback_received_themes || [])
    .filter((theme): theme is string => typeof theme === 'string' && theme.trim().length > 0);
  
  const allProvidedThemes = sortedSummaries
    .flatMap(week => week.feedback_provided_themes || [])
    .filter((theme): theme is string => typeof theme === 'string' && theme.trim().length > 0);

  const receivedThemes = [...new Set(allReceivedThemes)];
  const providedThemes = [...new Set(allProvidedThemes)];

  return {
    totalFeedbackReceived,
    totalFeedbackProvided,
    averageReceivedSentiment,
    averageProvidedSentiment,
    totalValueNominations,
    combinedReceivedSummary: receivedSummaries.join('\n\n'),
    combinedProvidedSummary: providedSummaries.join('\n\n'),
    weeksAnalyzed: sortedSummaries.length,
    dateRange: {
      start: sortedSummaries[sortedSummaries.length - 1]?.week_start_date || '',
      end: sortedSummaries[0]?.week_start_date || ''
    },
    receivedThemes,
    providedThemes
  };
}