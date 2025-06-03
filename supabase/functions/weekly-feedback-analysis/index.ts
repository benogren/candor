// Supabase Edge Function: weekly-feedback-analysis
// File: supabase/functions/weekly-feedback-analysis/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuration
const BATCH_SIZE = 75; // Users per batch
const MAX_BATCHES = 50; // Safety limit 
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Types
interface UserBatch {
  user_id: string;
  company_id: string;
  user_name: string;
  user_email: string;
  company_user_count: number;
}

interface FeedbackAnalysis {
  received_count: number;
  received_sentiment: number | null;
  received_summary: string | null;
  received_themes: string[];
  provided_count: number;
  provided_sentiment: number | null;
  provided_summary: string | null;
  provided_themes: string[];
  company_values_count: number;
}

interface HealthScores {
  volume_received_score: number;
  volume_provided_score: number;
  sentiment_received_score: number;
  sentiment_provided_score: number;
  consistency_received_score: number;
  consistency_provided_score: number;
  company_values_score: number;
  overall_health_score: number;
}

// Initialize Supabase client
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Main handler
serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    console.log('🚀 Starting weekly feedback analysis...');

    const supabase = createSupabaseClient();
    
    // Check for manual week override in request body (for testing)
    let targetWeekStart: string;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        targetWeekStart = body.week_start_date || await getCurrentWeekStart(supabase);
      } catch {
        targetWeekStart = await getCurrentWeekStart(supabase);
      }
    } else {
      targetWeekStart = await getCurrentWeekStart(supabase);
    }
    
    console.log(`📅 Processing week starting: ${targetWeekStart}`);

    let totalProcessed = 0;
    let totalErrors = 0;
    let batchCount = 0;
    let offset = 0;

    // Main batch processing loop
    while (batchCount < MAX_BATCHES) {
      console.log(`📦 Processing batch ${batchCount + 1}, offset: ${offset}`);
      
      // Get batch of users
      const userBatch = await getUserBatch(supabase, BATCH_SIZE, offset, targetWeekStart);
      
      if (userBatch.length === 0) {
        console.log('✅ No more users to process');
        break;
      }

      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        userBatch.map(user => processUser(supabase, user, targetWeekStart))
      );

      // Count results
      const batchProcessed = batchResults.filter(r => r.status === 'fulfilled').length;
      const batchErrors = batchResults.filter(r => r.status === 'rejected').length;

      totalProcessed += batchProcessed;
      totalErrors += batchErrors;

      console.log(`📊 Batch ${batchCount + 1} complete: ${batchProcessed} processed, ${batchErrors} errors`);

      // Log any errors
      batchResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`❌ Error processing user ${userBatch[index].user_id}:`, result.reason);
        }
      });

      batchCount++;
      offset += BATCH_SIZE;

      // Small delay between batches to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log(`✨ Weekly analysis complete!`);
    console.log(`📈 Total processed: ${totalProcessed}`);
    console.log(`❌ Total errors: ${totalErrors}`);
    console.log(`⏱️ Total time: ${totalTime}s`);

    return new Response(
      JSON.stringify({
        success: true,
        week_start_date: targetWeekStart,
        total_processed: totalProcessed,
        total_errors: totalErrors,
        batches_processed: batchCount,
        execution_time_seconds: totalTime
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('💥 Fatal error in weekly analysis:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Get current week start date
async function getCurrentWeekStart(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc('get_week_start_date');
  
  if (error) {
    throw new Error(`Failed to get week start date: ${error.message}`);
  }
  
  return data;
}

// Get batch of users for processing
async function getUserBatch(
  supabase: any, 
  batchSize: number, 
  offset: number, 
  weekStartDate: string
): Promise<UserBatch[]> {
  const { data, error } = await supabase.rpc('get_users_for_weekly_analysis', {
    batch_size: batchSize,
    offset_count: offset,
    target_week_start_date: weekStartDate
  });

  if (error) {
    throw new Error(`Failed to get user batch: ${error.message}`);
  }

  return data || [];
}

// Process a single user
async function processUser(
  supabase: any, 
  user: UserBatch, 
  weekStartDate: string
): Promise<void> {
  console.log(`👤 Processing user: ${user.user_name} (${user.user_id})`);

  try {
    // Create or update analysis record
    const { data: recordId, error: recordError } = await supabase.rpc('upsert_weekly_analysis_record', {
      target_user_id: user.user_id,
      target_company_id: user.company_id,
      target_week_start_date: weekStartDate,
      record_status: 'processing'
    });

    if (recordError) {
      throw new Error(`Failed to create analysis record: ${recordError.message}`);
    }

    // Get feedback data for analysis
    const analysis = await analyzeUserFeedback(supabase, user, weekStartDate);
    
    // Update analysis results
    const { error: updateError } = await supabase.rpc('update_analysis_results', {
      record_id: recordId,
      received_count: analysis.received_count,
      received_sentiment: analysis.received_sentiment,
      received_summary: analysis.received_summary,
      received_themes: analysis.received_themes,
      provided_count: analysis.provided_count,
      provided_sentiment: analysis.provided_sentiment,
      provided_summary: analysis.provided_summary,
      provided_themes: analysis.provided_themes,
      company_values_count: analysis.company_values_count,
      record_status: 'completed'
    });

    if (updateError) {
      throw new Error(`Failed to update analysis results: ${updateError.message}`);
    }

    // Calculate and store health scores
    await calculateAndStoreHealthScores(supabase, user, weekStartDate, analysis);

    console.log(`✅ User ${user.user_name} processed successfully`);

  } catch (error) {
    console.error(`❌ Error processing user ${user.user_id}:`, error);
    
    // Update record status to failed
    await supabase.rpc('upsert_weekly_analysis_record', {
      target_user_id: user.user_id,
      target_company_id: user.company_id,
      target_week_start_date: weekStartDate,
      record_status: 'failed'
    });

    throw error;
  }
}

// Analyze user feedback with AI
async function analyzeUserFeedback(
  supabase: any, 
  user: UserBatch, 
  weekStartDate: string
): Promise<FeedbackAnalysis> {
  console.log(`🔍 Analyzing feedback for ${user.user_name}...`);
  
  try {
    // Calculate week boundaries
    const weekStart = new Date(weekStartDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7); // Add 7 days
    
    console.log(`📅 Week range: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

    // Get feedback RECEIVED by user during this week
    const { data: receivedData, error: receivedError } = await supabase.rpc('get_user_feedback_summary', {
      target_user_id: user.user_id,
      manager_user_id: null,
      start_date: weekStart.toISOString(),
      is_invited_user: false
    });

    if (receivedError) {
      console.error(`Error getting received feedback for ${user.user_id}:`, receivedError);
      throw new Error(`Failed to get received feedback: ${receivedError.message}`);
    }

    // Get feedback PROVIDED by user during this week
    const { data: providedData, error: providedError } = await supabase.rpc('get_user_provided_feedback_summary', {
      provider_user_id: user.user_id,
      start_date: weekStart.toISOString(),
      end_date: weekEnd.toISOString()
    });

    if (providedError) {
      console.error(`Error getting provided feedback for ${user.user_id}:`, providedError);
      throw new Error(`Failed to get provided feedback: ${providedError.message}`);
    }

    // Process received feedback
    const receivedFeedback = receivedData?.feedback_data || [];
    const receivedThisWeek = receivedFeedback.filter((feedback: any) => {
      const feedbackDate = new Date(feedback.created_at);
      return feedbackDate >= weekStart && feedbackDate < weekEnd;
    });

    // Process provided feedback
    const providedFeedback = providedData?.feedback_data || [];
    const providedThisWeek = providedFeedback.filter((feedback: any) => {
      const feedbackDate = new Date(feedback.created_at);
      return feedbackDate >= weekStart && feedbackDate < weekEnd;
    });

    // Count company value nominations received
    const companyValueNominations = receivedThisWeek.filter((feedback: any) => 
      feedback.feedback_questions?.question_type === 'values' && feedback.nominated_user_id
    ).length;

    console.log(`📊 Found ${receivedThisWeek.length} received, ${providedThisWeek.length} provided, ${companyValueNominations} nominations for ${user.user_name}`);

    // Use AI for analysis
    const receivedSentiment = await calculateAISentiment(receivedThisWeek);
    const providedSentiment = await calculateAISentiment(providedThisWeek);

    // Generate AI summaries
    const receivedSummary = await generateAISummary(receivedThisWeek, 'received', user.user_name);
    const providedSummary = await generateAISummary(providedThisWeek, 'provided', user.user_name);

    // Extract AI-powered themes
    const receivedThemes = await extractAIThemes(receivedSummary ? receivedSummary : receivedThisWeek);
    const providedThemes = await extractAIThemes(providedSummary ? providedSummary : providedThisWeek);

    return {
      received_count: receivedThisWeek.length,
      received_sentiment: receivedSentiment,
      received_summary: receivedSummary,
      received_themes: receivedThemes,
      provided_count: providedThisWeek.length,
      provided_sentiment: providedSentiment,
      provided_summary: providedSummary,
      provided_themes: providedThemes,
      company_values_count: companyValueNominations
    };

  } catch (error) {
    console.error(`Error analyzing feedback for ${user.user_id}:`, error);
    throw error;
  }
}

// Calculate and store health scores
async function calculateAndStoreHealthScores(
  supabase: any,
  user: UserBatch,
  weekStartDate: string,
  analysis: FeedbackAnalysis
): Promise<void> {
  console.log(`📊 Calculating health scores for ${user.user_name}...`);

  try {
    // Get volume scores
    const { data: volumeScores, error: volumeError } = await supabase.rpc('calculate_volume_scores', {
      received_count: analysis.received_count,
      provided_count: analysis.provided_count,
      company_size: user.company_user_count
    });

    if (volumeError) {
      throw new Error(`Failed to calculate volume scores: ${volumeError.message}`);
    }

    // Get consistency scores
    const { data: consistencyScores, error: consistencyError } = await supabase.rpc('calculate_consistency_scores', {
      target_user_id: user.user_id,
      target_week_start_date: weekStartDate
    });

    if (consistencyError) {
      throw new Error(`Failed to calculate consistency scores: ${consistencyError.message}`);
    }

    // Convert sentiment scores
    const { data: sentimentReceivedScore, error: sentRecError } = await supabase.rpc('convert_sentiment_to_score', {
      sentiment_avg: analysis.received_sentiment
    });

    const { data: sentimentProvidedScore, error: sentProvError } = await supabase.rpc('convert_sentiment_to_score', {
      sentiment_avg: analysis.provided_sentiment
    });

    if (sentRecError || sentProvError) {
      throw new Error(`Failed to convert sentiment scores`);
    }

    // Calculate company values score
    const { data: companyValuesScore, error: valuesError } = await supabase.rpc('calculate_company_values_score', {
      nominations_received: analysis.company_values_count
    });

    if (valuesError) {
      throw new Error(`Failed to calculate company values score: ${valuesError.message}`);
    }

    // Calculate overall health score
    const { data: overallScore, error: overallError } = await supabase.rpc('calculate_feedback_health_score', {
      volume_received_score: volumeScores.volume_received_score,
      volume_provided_score: volumeScores.volume_provided_score,
      sentiment_received_score: sentimentReceivedScore,
      sentiment_provided_score: sentimentProvidedScore,
      consistency_received_score: consistencyScores.consistency_received_score,
      consistency_provided_score: consistencyScores.consistency_provided_score,
      company_values_score: companyValuesScore
    });

    if (overallError) {
      throw new Error(`Failed to calculate overall health score: ${overallError.message}`);
    }

    // Store health scores
    const { error: storeError } = await supabase.rpc('upsert_health_scores', {
      target_user_id: user.user_id,
      target_week_start_date: weekStartDate,
      vol_received: volumeScores.volume_received_score,
      vol_provided: volumeScores.volume_provided_score,
      sent_received: sentimentReceivedScore,
      sent_provided: sentimentProvidedScore,
      consist_received: consistencyScores.consistency_received_score,
      consist_provided: consistencyScores.consistency_provided_score,
      company_vals: companyValuesScore,
      overall_score: overallScore
    });

    if (storeError) {
      throw new Error(`Failed to store health scores: ${storeError.message}`);
    }

    console.log(`📈 Health scores calculated and stored for ${user.user_name}`);

  } catch (error) {
    console.error(`Failed to calculate health scores for ${user.user_id}:`, error);
    throw error;
  }
}

// AI-powered sentiment analysis
async function calculateAISentiment(feedbackItems: any[]): Promise<number | null> {
  if (feedbackItems.length === 0) return null;
  
  try {
    console.log(`🎯 Starting AI sentiment analysis for ${feedbackItems.length} items`);
    
    // Extract text content for analysis
    const textContent = feedbackItems
      .map(item => [item.text_response, item.comment_text])
      .flat()
      .filter(text => text && text.trim().length > 0)
      .join(' ');
    
    console.log(`📊 Text content length: ${textContent.length}`);
    console.log(`📄 Text preview: ${textContent.substring(0, 150)}...`);
    
    // If no text content, fall back to rating-based sentiment
    if (!textContent.trim()) {
      console.log(`⚠️ No text content for sentiment analysis, using basic calculation`);
      return calculateBasicSentiment(feedbackItems);
    }
    
    const prompt = `Analyze the sentiment of this workplace feedback. Return ONLY a number between -1 and 1, where:
-1 = very negative
-0.5 = somewhat negative  
0 = neutral
0.5 = somewhat positive
1 = very positive

Feedback text: "${textContent}"

Respond with only the number (e.g., 0.3):`;

    console.log(`🚀 Calling OpenAI for sentiment analysis...`);
    const response = await callOpenAI(prompt, 50); // Short response
    console.log(`✅ AI sentiment response: ${response}`);
    
    // Clean response of any markdown formatting
    let cleanResponse = response.trim();
    if (cleanResponse.includes('```')) {
      cleanResponse = cleanResponse.replace(/```[a-z]*\s*/g, '').replace(/\s*```/g, '');
    }
    
    const sentiment = parseFloat(cleanResponse);
    
    if (isNaN(sentiment) || sentiment < -1 || sentiment > 1) {
      console.warn(`❌ Invalid AI sentiment response: ${response}, falling back to basic calculation`);
      return calculateBasicSentiment(feedbackItems);
    }
    
    return Math.round(sentiment * 100) / 100; // Round to 2 decimal places
    
  } catch (error) {
    console.error('❌ Error in AI sentiment analysis:', error);
    return calculateBasicSentiment(feedbackItems);
  }
}

// AI-powered theme extraction
async function extractAIThemes(feedbackItems: any[]): Promise<string[]> {
  if (feedbackItems.length === 0) return [];
  
  try {
    console.log(`🏷️ Starting AI theme extraction for ${feedbackItems.length} items`);
    
    // Extract text content and question context
    // const feedbackContext = feedbackItems.map(item => ({
    //   question: item.feedback_questions?.question_text || 'General feedback',
    //   response: item.text_response || '',
    //   comment: item.comment_text || '',
    //   rating: item.rating_value
    // }));
    
    // const contextText = feedbackContext
    //   .map(fb => `Q: ${fb.question} | A: ${fb.response} ${fb.comment}`.trim())
    //   .join('\n');
    
    // console.log(`📊 Theme context length: ${contextText.length}`);
    
    // if (!contextText.trim()) {
    //   console.log(`⚠️ No context for theme extraction, using basic themes`);
    //   return extractBasicThemes(feedbackItems);
    // }
    
    const prompt = `Extract 3-5 key themes from this workplace feedback. Return ONLY a JSON array of theme strings.

    Examples of good themes: ["communication", "technical skills", "leadership", "collaboration", "problem solving", "creativity", "time management"]
    Do not include "rating", "text", or "comment" in the themes since these are question types, not themes.

    Feedback Summary:
    ${feedbackItems}

    Respond with only the JSON array:`;

    console.log(`🚀 Calling OpenAI for theme extraction...`);
    const response = await callOpenAI(prompt, 150);
    console.log(`✅ AI themes response: ${response}`);
    
    try {
      // Strip markdown code blocks if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log(`🧹 Cleaned response: ${cleanResponse}`);
      
      const themes = JSON.parse(cleanResponse);
      if (Array.isArray(themes) && themes.every(t => typeof t === 'string')) {
        console.log(`🎯 Successfully extracted themes:`, themes);
        return themes.slice(0, 5); // Limit to 5 themes
      } else {
        console.warn(`❌ Themes not in expected format:`, themes);
      }
    } catch (parseError) {
      console.warn(`❌ Could not parse AI themes response: ${response}`, parseError);
    }
    
    console.log(`🔄 Falling back to basic themes for ${feedbackItems.length} items`);
    return extractBasicThemes(feedbackItems);
    
  } catch (error) {
    console.error('❌ Error in AI theme extraction:', error);
    console.log(`🔄 Falling back to basic themes due to error`);
    return extractBasicThemes(feedbackItems);
  }
}

// AI-powered summary generation
async function generateAISummary(feedbackItems: any[], type: 'received' | 'provided', userName: string): Promise<string | null> {
  if (feedbackItems.length === 0) return null;
  
  try {
    console.log(`🤖 Starting AI summary for ${userName} (${type}), ${feedbackItems.length} items`);
    
    const feedbackContext = feedbackItems.map(item => ({
      question: item.feedback_questions?.question_text || 'General feedback',
      response: item.text_response || '',
      comment: item.comment_text || '',
      rating: item.rating_value,
      from: item.feedback_recipients?.feedback_user_identities?.name || 'Anonymous'
    }));
    
    const contextText = feedbackContext
      .map(fb => `From ${fb.from}: Q: ${fb.question} | Rating: ${fb.rating}/5 | Response: ${fb.response} ${fb.comment}`.trim())
      .join('\n');
    
    console.log(`📝 Context text length: ${contextText.length}`);
    console.log(`📄 Context preview: ${contextText.substring(0, 200)}...`);
    
    if (!contextText.trim()) {
      console.log(`⚠️ Empty context text, falling back to basic summary for ${userName}`);
      return generateBasicSummary(feedbackItems, type);
    }
    
    const actionWord = type === 'received' ? 'received' : 'provided';
    const prompt = `${actionWord === 'received' ? `Create a comprehensive analysis of feedback that ${userName} received this week with these sections:
    
    **STRENGTHS IDENTIFIED:**
    - List top 3 specific strengths with examples from the feedback ${userName} received this week

    **AREAS FOR IMPROVEMENT:**
    - List top 3 areas with specific examples from feedback ${userName} received this week

    **KEY THEMES & PATTERNS:**
    - Identify 2-3 recurring themes across all feedback ${userName} received this week

    **NOTABLE QUOTES:**
    - Include 2-3 most impactful direct quotes from the feedback (if any)

    **QUANTITATIVE INSIGHTS:**
    - Summary of rating patterns and averages (if ratings provided)

    **SPECIFIC RECOMMENDATIONS:**
    - 3 actionable recommendations based on the feedback ${userName} received this week
    ` : `Create a comprehensive analysis of feedback that ${userName} provided this week with these sections:

    **Overall Tone and Sentiment:**
    - Summarize the overall tone of the feedback provided by ${userName} this week
    
    **Overall Engagement:**
    - Summarize the overall engagement level of ${userName} in providing feedback this week

    **Identify Potential Conflicts:**
    - Identify any potential conflicts or issues in the feedback provided by ${userName} this week
    
    **Key Themes and Patterns:**
    - Identify 2-3 recurring themes across all feedback provided by ${userName}
    `}
    Be specific, constructive, and focus on actionable insights. 
    Base everything on the actual feedback provided. 
    If limited feedback is available, acknowledge this in your analysis.

    Feedback data:
    ${contextText}`;

    console.log(`🚀 Calling OpenAI for ${userName} summary...`);
    const response = await callOpenAI(prompt, 300);
    console.log(`✅ AI response received for ${userName}: ${response.substring(0, 100)}...`);
    
    return response.trim() || generateBasicSummary(feedbackItems, type);
    
  } catch (error) {
    console.error(`❌ Error in AI summary generation for ${userName}:`, error);
    return generateBasicSummary(feedbackItems, type);
  }
}

// OpenAI API call helper
async function callOpenAI(prompt: string, maxTokens: number = 150): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiApiKey) {
    console.error('❌ OPENAI_API_KEY environment variable not set');
    throw new Error('OPENAI_API_KEY environment variable not set');
  }
  
  console.log(`🤖 Making OpenAI API call with ${maxTokens} max tokens...`);
  
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.3, // Lower temperature for more consistent results
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ OpenAI API error: ${response.status} - ${errorText}`);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('❌ Invalid OpenAI API response format:', data);
    throw new Error('Invalid OpenAI API response format');
  }
  
  console.log(`✅ OpenAI API call successful`);
  return data.choices[0].message.content;
}

// Fallback functions (for when AI fails)

// Basic sentiment analysis (fallback for AI)
function calculateBasicSentiment(feedbackItems: any[]): number | null {
  if (!Array.isArray(feedbackItems) || feedbackItems.length === 0) {
    console.warn(`⚠️ calculateBasicSentiment received invalid input:`, typeof feedbackItems);
    return null;
  }
  
  const ratingsOnly = feedbackItems
    .filter(item => item.rating_value !== null && item.rating_value !== undefined)
    .map(item => item.rating_value);
  
  if (ratingsOnly.length === 0) return null;
  
  // Convert 1-5 scale to -1 to 1 scale
  // 1,2 = negative, 3 = neutral, 4,5 = positive
  const sentimentValues = ratingsOnly.map(rating => {
    if (rating <= 2) return -0.5;
    if (rating === 3) return 0;
    return 0.5;
  });
  
  const avgSentiment = sentimentValues.reduce((sum, val) => sum + val, 0) / sentimentValues.length;
  return Math.round(avgSentiment * 100) / 100; // Round to 2 decimal places
}

// Basic theme extraction (fallback for AI)
function extractBasicThemes(feedbackItems: any[]): string[] {
  if (!Array.isArray(feedbackItems) || feedbackItems.length === 0) {
    console.warn(`⚠️ extractBasicThemes received invalid input:`, typeof feedbackItems, feedbackItems);
    return [];
  }
  
  const themes = new Set<string>();
  
  feedbackItems.forEach(item => {
    // Extract themes from question types
    if (item.feedback_questions?.question_type) {
      themes.add(item.feedback_questions.question_type);
    }
    
    // Extract themes from company values
    if (item.feedback_questions?.company_values?.name) {
      themes.add(`company_value: ${item.feedback_questions.company_values.name}`);
    }
  });
  
  return Array.from(themes).slice(0, 5); // Limit to 5 themes
}

// Basic summary generation (fallback for AI)
function generateBasicSummary(feedbackItems: any[], type: 'received' | 'provided'): string | null {
  if (!Array.isArray(feedbackItems) || feedbackItems.length === 0) {
    console.warn(`⚠️ generateBasicSummary received invalid input:`, typeof feedbackItems);
    return null;
  }
  
  const ratingCount = feedbackItems.filter(item => item.rating_value).length;
  const textCount = feedbackItems.filter(item => item.text_response?.trim()).length;
  const avgRating = ratingCount > 0 
    ? feedbackItems.reduce((sum, item) => sum + (item.rating_value || 0), 0) / ratingCount 
    : null;
  
  let summary = `${type === 'received' ? 'Received' : 'Provided'} ${feedbackItems.length} feedback responses`;
  
  if (ratingCount > 0) {
    summary += ` with an average rating of ${avgRating?.toFixed(1)}/5`;
  }
  
  if (textCount > 0) {
    summary += ` including ${textCount} detailed comments`;
  }
  
  summary += '.';
  
  return summary;
}