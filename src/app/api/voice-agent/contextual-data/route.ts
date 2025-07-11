// src/app/api/voice-agent/contextual-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface FeedbackQuestion {
  question_text: string;
  question_type: string;
  question_subtype: string;
}

interface FeedbackResponse {
  feedback_questions: FeedbackQuestion | FeedbackQuestion[];
}

export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { providerId, recipientId, relationship } = await req.json();

    if (!providerId || !recipientId) {
      return NextResponse.json(
        { error: 'Missing required fields: providerId, recipientId' },
        { status: 400 }
      );
    }

    // Get provider's company ID
    const { data: providerData, error: providerError } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('id', providerId)
      .single();

    if (providerError || !providerData) {
      return NextResponse.json({
        companyName: '',
        companyIndustry: '',
        recentQuestionsContext: 'No recent questions to avoid.',
        relationshipType: relationship?.type || 'peer'
      });
    }

    const companyId = providerData.company_id;

    // Get company information
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name, industry')
      .eq('id', companyId)
      .single();

    let companyName = '';
    let companyIndustry = '';
    
    if (!companyError && companyData) {
      companyName = companyData.name || '';
      companyIndustry = companyData.industry || '';
    }

    // Get recent questions for this recipient to avoid repetition
    const { data: recipientEntries, error: recipientEntriesError } = await supabase
      .from('feedback_recipients')
      .select('id')
      .eq('recipient_id', recipientId);

    let recentQuestionsContext = "No recent questions to avoid.";
    
    // Declare recentFeedback so it's always defined
    let recentFeedback: FeedbackResponse[] | null = null;

    if (!recipientEntriesError && recipientEntries && recipientEntries.length > 0) {
      const recipientIds = recipientEntries.map(r => r.id);

      // Get the last 4 AI-generated questions this recipient received
      const { data, error: feedbackError } = await supabase
        .from('feedback_responses')
        .select(`
          feedback_questions!inner(question_text, question_type, question_subtype)
        `)
        .in('recipient_id', recipientIds)
        .eq('feedback_questions.question_type', 'ai') // Only AI-generated questions
        .order('created_at', { ascending: false })
        .limit(4);

      recentFeedback = data as FeedbackResponse[] | null;

      if (!feedbackError && recentFeedback && recentFeedback.length > 0) {
        const recentQuestions = (recentFeedback as FeedbackResponse[]).map((r: FeedbackResponse) => {
          const question = Array.isArray(r.feedback_questions) ? r.feedback_questions[0] : r.feedback_questions;
          return question?.question_text;
        }).filter(Boolean);
        
        if (recentQuestions.length > 0) {
          recentQuestionsContext = `Recent questions to avoid repeating themes: ${recentQuestions.slice(0, 3).join('; ')}. Please explore different aspects of their performance.`;
        }
      }
    }

    // Get recent feedback analysis for additional context
    const { data: recentAnalysis, error: analysisError } = await supabase
      .from('weekly_feedback_analysis')
      .select('feedback_received_summary')
      .eq('user_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(1);

    let recentAnalysisContext = '';
    if (!analysisError && recentAnalysis && recentAnalysis.length > 0 && recentAnalysis[0].feedback_received_summary) {
      recentAnalysisContext = ` Recent feedback themes: ${recentAnalysis[0].feedback_received_summary.slice(0, 200)}...`;
      recentQuestionsContext += recentAnalysisContext;
    }

    // Determine relationship type
    const relationshipType = relationship?.type || 'peer';

    // Get any recent voice session transcripts to avoid repetition
    const { data: recentVoiceSessions, error: voiceSessionError } = await supabase
      .from('voice_session_recipients')
      .select('transcript')
      .eq('recipient_id', recipientId)
      .eq('discussed', true)
      .order('completed_at', { ascending: false })
      .limit(2);

    if (!voiceSessionError && recentVoiceSessions && recentVoiceSessions.length > 0) {
      const recentTopics = recentVoiceSessions
        .map(session => session.transcript?.slice(0, 100))
        .filter(Boolean)
        .join(' ');
      
      if (recentTopics.length > 50) {
        recentQuestionsContext += ` Recent voice conversation topics covered: ${recentTopics}. Explore new angles and different aspects.`;
      }
    }

    return NextResponse.json({
      companyName,
      companyIndustry,
      recentQuestionsContext,
      relationshipType,
      // Additional context for debugging
      debug: {
        companyId,
        recipientEntriesCount: recipientEntries?.length || 0,
        recentFeedbackCount: recentFeedback?.length || 0,
        hasRecentAnalysis: !!recentAnalysisContext
      }
    });

  } catch (error) {
    console.error('Error fetching contextual data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch contextual data',
        details: error instanceof Error ? error.message : 'Unknown error',
        // Fallback data
        companyName: '',
        companyIndustry: '',
        recentQuestionsContext: 'No recent questions to avoid.',
        relationshipType: 'peer'
      },
      { status: 500 }
    );
  }
}