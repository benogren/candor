'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import supabase from '@/lib/supabase/client';
import FeedbackHeader from '@/components/feedbackHeader';
import UserSearch from '@/components/UserSearch';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library, IconName } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { Badge } from '@/components/ui/badge';
// Import our new FeedbackTextarea component
import { FeedbackTextarea } from '@/components/FeedbackTextarea';
import { Loader2, MessageSquare, Sparkles, Star, MessageCircle, Trophy } from "lucide-react";

// Add all FontAwesome solid icons to the library
library.add(fas);

// Define interfaces
interface Question {
  id: string;
  question_text: string;
  question_description: string;
  question_type: 'rating' | 'text' | 'values';
  question_subtype?: string | null;
  active: boolean;
  company_value_id?: string | null;
  icon?: string | null;
}

interface FeedbackResponse {
  id: string;
  recipient_id: string;
  question_id: string;
  session_id: string;
  rating_value: number | null;
  text_response: string | null;
  comment_text: string | null;
  has_comment: boolean;
  skipped: boolean;
  nominated_user_id?: string | null;
}

interface UserRelationship {
  type: string;
  description: string;
  distance: number;
}

interface RelationshipResponse {
  relationship: UserRelationship;
  users: {
    user1: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
    user2: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  };
}

type QuestionData = {
  id: string;
  recipient_id: string;
  question_id: string;
  question_text: string;
  question_description: string;
  question_type: 'rating' | 'text' | 'values';
  question_subtype?: string | null;
  session_id: string;
  rating_value: number | null;
  text_response: string | null;
  comment_text: string | null;
  has_comment: boolean;
  skipped: boolean;
  recipient_name: string;
  company_value_id?: string | null;
  icon?: string | null;
  nominated_user_id?: string | null;
  relationship_type?: string;
  relationship_description?: string;
  // Add tone score for tracking
  toneScore?: number | null;
};

type Colleague = {
  id: string;
  name: string;
  email: string;
  role?: string;
  status?: string;
  companyid?: string;
};

const RatingComponent = ({ value, onChange }: { value: number | null; onChange: (value: number) => void }) => (
  <div className="flex flex-col space-y-2">
    <div className="flex justify-between">
      <span className="text-sm text-slate-500">Low</span>
      <span className="text-sm text-slate-500">Exceptional</span>
    </div>
    <div className="flex justify-between gap-1">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          className={`h-10 w-10 rounded-full flex items-center justify-center ${
            value === rating ? 'bg-cerulean text-white' : 'bg-slate-100 hover:bg-slate-200'
          }`}
        >
          {rating}
        </button>
      ))}
    </div>
  </div>
);

export default function QuestionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  const [loading, setLoading] = useState(true);
  const [standardQuestions, setStandardQuestions] = useState<QuestionData[]>([]);
  const [valuesQuestion, setValuesQuestion] = useState<Question | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentRecipientName, setCurrentRecipientName] = useState('');
  const [currentRelationship, setCurrentRelationship] = useState<string>('');
  const [showCommentField, setShowCommentField] = useState(false);
  const [currentComment, setCurrentComment] = useState('');
  const [nominatedUser, setNominatedUser] = useState<Colleague | null>(null);
  
  console.log("debug: ", currentRelationship)
  // Use ref to prevent duplicate database operations in React's strict mode
  const processingRef = useRef<{[key: string]: boolean}>({});
  
  // Function to get a display-friendly relationship label
  const getRelationshipLabel = (type: string | undefined): string => {
    if (!type) return '';
    
    switch(type) {
      case 'manager-report':
        return 'Direct Report';
      case 'report-manager':
        return 'Manager';
      case 'peer':
        return 'Peer';
      case 'peer-with-boss':
        return 'Leader';
      case 'skip-level-manager':
        return 'Skip-Level Employee';
      case 'skip-level-report':
        return 'Skip-Level Leader';
      default:
        return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
  };
  
  // Function to get relationship between two users
  const getUserRelationship = async (user1Id: string, user2Id: string): Promise<RelationshipResponse | null> => {
    try {
      const response = await fetch(`/api/user-relationship?user1=${user1Id}&user2=${user2Id}`, {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error fetching relationship:', errorData);
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching user relationship:', error);
      return null;
    }
  };
  
  // Function to generate AI questions using OpenAI based on relationship
  const generateAIQuestions = async (
    providerId: string, 
    recipientId: string, 
    recipientName: string, 
    relationship: RelationshipResponse,
    companyId: string
  ): Promise<{ textQuestion: { questionText: string, questionDescription: string }, ratingQuestion: { questionText: string, questionDescription: string } } | null> => {
    try {
      // Call your OpenAI API endpoint
      const response = await fetch('/api/generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          providerId,
          recipientId,
          recipientName,
          relationship,
          companyId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error generating questions:', errorData);
        return null;
      }
      
      const data = await response.json();
      return { 
        textQuestion: {
          questionText: data.text_question.question_text, 
          questionDescription: data.text_question.question_description
        },
        ratingQuestion: {
          questionText: data.rating_question.question_text,
          questionDescription: data.rating_question.question_description
        }
      };
    } catch (error) {
      console.error('Error generating questions with OpenAI:', error);
      return null;
    }
  };
  
  // Function to create AI questions and responses
  const createAIQuestionsAndResponses = async (
    companyId: string,
    sessionId: string,
    providerId: string,
    recipientId: string,
    generatedQuestions: { textQuestion: { questionText: string, questionDescription: string }, ratingQuestion: { questionText: string, questionDescription: string } },
    relationshipType?: string,
    relationshipDescription?: string
  ): Promise<QuestionData[] | null> => {
    try {
      // First, find the feedback_recipients entry that links this session with this recipient
      const { data: recipientEntry, error: recipientError } = await supabase
        .from('feedback_recipients')
        .select('id, recipient_id')
        .eq('session_id', sessionId)
        .eq('recipient_id', recipientId)
        .single();
      
      if (recipientError || !recipientEntry) {
        console.error('Error finding recipient entry:', recipientError);
        throw new Error(`Recipient entry not found for user ${recipientId} in session ${sessionId}`);
      }
      
      // Create the text question record
      const { data: textQuestionData, error: textQuestionError } = await supabase
        .from('feedback_questions')
        .insert({
          company_id: companyId,
          question_text: generatedQuestions.textQuestion.questionText,
          question_description: generatedQuestions.textQuestion.questionDescription,
          question_type: 'text',
          question_subtype: 'ai',
          active: true,
          scope: 'global',
          is_admin_manageable: false
        })
        .select()
        .single();
      
      if (textQuestionError) throw textQuestionError;
      
      // Create the rating question record
      const { data: ratingQuestionData, error: ratingQuestionError } = await supabase
        .from('feedback_questions')
        .insert({
          company_id: companyId,
          question_text: generatedQuestions.ratingQuestion.questionText,
          question_description: generatedQuestions.ratingQuestion.questionDescription,
          question_type: 'rating',
          question_subtype: 'ai',
          active: true,
          scope: 'global',
          is_admin_manageable: false
        })
        .select()
        .single();
      
      if (ratingQuestionError) throw ratingQuestionError;
      
      // Create response records for both questions
      const { data: textResponseData, error: textResponseError } = await supabase
        .from('feedback_responses')
        .insert({
          recipient_id: recipientEntry.id,
          question_id: textQuestionData.id,
          session_id: sessionId,
          has_comment: false,
          skipped: false
        })
        .select()
        .single();
      
      if (textResponseError) throw textResponseError;
      
      const { data: ratingResponseData, error: ratingResponseError } = await supabase
        .from('feedback_responses')
        .insert({
          recipient_id: recipientEntry.id,
          question_id: ratingQuestionData.id,
          session_id: sessionId,
          has_comment: false,
          skipped: false
        })
        .select()
        .single();
      
      if (ratingResponseError) throw ratingResponseError;
      
      // Get recipient name
      const { data: recipientData } = await supabase
        .from('feedback_user_identities')
        .select('name, email')
        .eq('id', recipientId)
        .single();
      
      const recipientName = recipientData?.name || recipientData?.email?.split('@')[0] || 'Colleague';
      
      // Return formatted question data
      return [
        {
          id: textResponseData.id,
          recipient_id: recipientEntry.id,
          question_id: textQuestionData.id,
          question_text: textQuestionData.question_text,
          question_description: textQuestionData.question_description,
          question_type: 'text',
          question_subtype: 'ai',
          session_id: sessionId,
          rating_value: null,
          text_response: null,
          comment_text: null,
          has_comment: false,
          skipped: false,
          recipient_name: recipientName,
          relationship_type: relationshipType,
          relationship_description: relationshipDescription
        },
        {
          id: ratingResponseData.id,
          recipient_id: recipientEntry.id,
          question_id: ratingQuestionData.id,
          question_text: ratingQuestionData.question_text,
          question_description: ratingQuestionData.question_description,
          question_type: 'rating',
          question_subtype: 'ai',
          session_id: sessionId,
          rating_value: null,
          text_response: null,
          comment_text: null,
          has_comment: false,
          skipped: false,
          recipient_name: recipientName,
          relationship_type: relationshipType,
          relationship_description: relationshipDescription
        }
      ];
    } catch (error) {
      console.error('Error creating AI questions and responses:', error);
      return null;
    }
  };
  
  useEffect(() => {
    const loadData = async () => {
      if (!sessionId) {
        toast({ title: 'Missing session', description: 'No session ID provided', variant: 'destructive' });
        return;
      }
    
      // Prevent duplicate processing in strict mode
      if (processingRef.current[sessionId as string]) {
        console.log('Already processing this session, skipping duplicate operation');
        return;
      }
      processingRef.current[sessionId as string] = true;
    
      try {
        setLoading(true);
        console.log("=== DEBUGGING SESSION:", sessionId, "===");
        
        // Step 1: Check session status
        const { data: session, error: sessionError } = await supabase
          .from('feedback_sessions')
          .select('status')
          .eq('id', sessionId)
          .single();
        
        if (sessionError || !session) {
          throw new Error('Session not found');
        }
        
        if (session.status === 'completed') {
          router.push('/feedback/complete');
          return;
        }
        
        // Step 2: Get recipients for this session
        const { data: recipients, error: recipientsError } = await supabase
          .from('feedback_recipients')
          .select(`
            id, 
            recipient_id,
            session_id,
            feedback_user_identities(id, name, email)
          `)
          .eq('session_id', sessionId)
          .order('created_at');
        
        if (recipientsError) throw recipientsError;
        console.log(`Found ${recipients?.length || 0} recipients for this session`);
        
        // Step 3: Check for existing responses to avoid duplication
        const { data: existingResponses, error: responsesError } = await supabase
          .from('feedback_responses')
          .select('*')
          .eq('session_id', sessionId);
          
        if (responsesError) throw responsesError;
        console.log(`Found ${existingResponses?.length || 0} existing responses`);
        
        // Get all question IDs from the responses
        const questionIds = existingResponses?.map(r => r.question_id) || [];

        // Get all questions associated with these responses to check their types
        const { data: existingQuestions, error: existingQuestionsError } = questionIds.length > 0 
          ? await supabase
              .from('feedback_questions')
              .select('*') // Get all question data, not just id, question_type, question_subtype
              .in('id', questionIds)
          : { data: [], error: null };

        if (existingQuestionsError) {
          console.error("Error fetching existing questions:", existingQuestionsError);
        }

        // Create a map of questions by ID for efficient lookup
        const questionMap = new Map<string, Question>();
        if (existingQuestions) {
          existingQuestions.forEach(q => {
            questionMap.set(q.id, q as Question);
          });
        }

        // Create a map to track which recipients already have AI questions
        const recipientWithAIQuestions = new Map<string, { hasText: boolean, hasRating: boolean }>();

        // Check existing responses to see which recipients already have AI questions
        if (existingResponses && existingQuestions) {
          for (const response of existingResponses) {
            const question = questionMap.get(response.question_id);
            
            if (question?.question_subtype === 'ai') {
              // Get the actual recipient_id from the feedback_recipients table
              const { data: recipientEntry } = await supabase
                .from('feedback_recipients')
                .select('recipient_id')
                .eq('id', response.recipient_id)
                .single();
                
              if (recipientEntry?.recipient_id) {
                const recipientId = recipientEntry.recipient_id;
                const current = recipientWithAIQuestions.get(recipientId) || { hasText: false, hasRating: false };
                
                if (question.question_type === 'text') {
                  current.hasText = true;
                } else if (question.question_type === 'rating') {
                  current.hasRating = true;
                }
                
                recipientWithAIQuestions.set(recipientId, current);
                console.log(`Recipient ${recipientId} has AI ${question.question_type} question`);
              }
            }
          }
        }
        
        // Step 4: Get company ID and provider ID from the session
        const { data: sessionData, error: sessionDataError } = await supabase
          .from('feedback_sessions')
          .select('provider_id, cycle_id')
          .eq('id', sessionId)
          .single();
          
        if (sessionDataError) throw sessionDataError;
        
        const providerId = sessionData.provider_id;
        
        const { data: providerData, error: providerError } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('id', providerId)
          .single();
          
        if (providerError) throw providerError;
        
        const companyId = providerData.company_id;
        console.log("Company ID:", companyId, "Provider ID:", providerId);
        
        // Create a map to store relationship information by recipient ID
        const relationshipMap = new Map<string, { type: string, description: string }>();

        // Fetch relationships for all recipients
        if (recipients && recipients.length > 0) {
          console.log("Fetching relationships for all recipients");
          
          for (const recipient of recipients) {
            try {
              // Get relationship between provider and recipient
              const relationship = await getUserRelationship(providerId, recipient.recipient_id);
              
              if (relationship) {
                relationshipMap.set(
                  recipient.recipient_id, 
                  { 
                    type: relationship.relationship.type,
                    description: relationship.relationship.description
                  }
                );
                console.log(`Found relationship for ${recipient.recipient_id}: ${relationship.relationship.type}`);
              }
            } catch (error) {
              console.error(`Error fetching relationship for recipient ${recipient.recipient_id}:`, error);
            }
          }
        }
        
        // Step 5: We no longer use standard questions - only AI-generated questions
        console.log("Skipping standard question setup - using AI-generated questions only");
        
        // Step 6: Get values questions separately
        const { data: valuesQuestionsData, error: valuesError } = await supabase
          .from('feedback_questions')
          .select(`
            *,
            company_values(icon)
          `)
          .eq('active', true)
          .eq('question_type', 'values')
          .or(`company_id.eq.${companyId},scope.eq.global`);
          
        if (valuesError) throw valuesError;
        console.log(`Found ${valuesQuestionsData?.length || 0} active values questions`);
        
        // If we have values questions, randomly select one for later
        let selectedValuesQuestion = null;
        if (valuesQuestionsData && valuesQuestionsData.length > 0) {
          // Check for an existing values response
          const existingValuesResponse = existingResponses?.find(r => {
            const question = questionMap.get(r.question_id);
            return question?.question_type === 'values';
          });
          
          if (existingValuesResponse) {
            // If we have an existing values response, get the question for it
            const question = valuesQuestionsData.find(q => q.id === existingValuesResponse.question_id);
            if (question) {
              selectedValuesQuestion = {
                ...question,
                icon: question.company_values?.icon || null
              };
              
              // Check if we already have a nominated user
              if (existingValuesResponse.nominated_user_id) {
                // Fetch the nominated user data
                const { data: userData } = await supabase
                  .from('feedback_user_identities')
                  .select('id, name, email')
                  .eq('id', existingValuesResponse.nominated_user_id)
                  .single();
                  
                if (userData) {
                  setNominatedUser({
                    id: userData.id,
                    name: userData.name || '',
                    email: userData.email || ''
                  });
                }
              }
            }
          } else {
            // Select a values question with weighted random selection based on response count
            try {
              // 1. Get all responses for values questions
              const { data: valueResponses } = await supabase
                .from('feedback_responses')
                .select('question_id')
                .in('question_id', valuesQuestionsData.map(q => q.id));
              
              // 2. Count occurrences of each question_id
              const countMap = new Map();
              
              // Initialize all questions with count 0
              valuesQuestionsData.forEach(q => countMap.set(q.id, 0));
              
              // Count actual responses
              if (valueResponses && valueResponses.length > 0) {
                valueResponses.forEach(response => {
                  countMap.set(response.question_id, (countMap.get(response.question_id) || 0) + 1);
                });
              }
              
              // Log the counts for debugging
              console.log("Values question usage counts:");
              valuesQuestionsData.forEach(q => {
                console.log(`  ${q.question_text.substring(0, 30)}... (${q.id}): ${countMap.get(q.id) || 0}`);
              });
              
              // 3. Calculate weights (inverse of counts - fewer responses = higher weight)
              const maxCount = Math.max(...countMap.values());
              const weights = valuesQuestionsData.map(q => (maxCount + 1) / (countMap.get(q.id) + 1));
              const totalWeight = weights.reduce((sum, w) => sum + w, 0);
              
              // 4. Weighted random selection
              let random = Math.random() * totalWeight;
              let selectedIndex = 0;
              
              for (let i = 0; i < weights.length; i++) {
                random -= weights[i];
                if (random <= 0) {
                  selectedIndex = i;
                  break;
                }
              }
              
              selectedValuesQuestion = {
                ...valuesQuestionsData[selectedIndex],
                icon: valuesQuestionsData[selectedIndex].company_values?.icon || null
              };
              
              console.log(`Selected value question: "${selectedValuesQuestion.question_text.substring(0, 30)}..." with weight ${weights[selectedIndex].toFixed(2)}/${totalWeight.toFixed(2)} (count: ${countMap.get(selectedValuesQuestion.id)}/${maxCount})`);
            } catch (error) {
              // Fall back to simple random selection on error
              console.error("Error in weighted question selection:", error);
              const randomIndex = Math.floor(Math.random() * valuesQuestionsData.length);
              selectedValuesQuestion = {
                ...valuesQuestionsData[randomIndex],
                icon: valuesQuestionsData[randomIndex].company_values?.icon || null
              };
              console.log(`Fallback - randomly selected value question: "${selectedValuesQuestion.question_text.substring(0, 30)}..."`);
            }
          }
        }
        
        // Set the selected values question
        setValuesQuestion(selectedValuesQuestion);
        
        // Initialize recipient tracking structures
        const recipientMap = new Map<string, FeedbackResponse[]>();
        const questionTypeByRecipient = new Map<string, Set<string>>();
        
        // Initialize for each recipient
        if (recipients) {
          for (const recipient of recipients) {
            recipientMap.set(recipient.id, []);
            questionTypeByRecipient.set(recipient.id, new Set<string>());
          }
        }
        
        // Group existing responses by recipient_id and track question types
        if (existingResponses) {
          console.log("Organizing existing responses by recipient ID and question type:");
          for (const response of existingResponses) {
            // Only process AI and values questions (no more standard questions)
            const question = questionMap.get(response.question_id);
            if (!question || question.question_type === 'values') continue;
            
            if (recipientMap.has(response.recipient_id)) {
              // Add to existing array
              const existing = recipientMap.get(response.recipient_id) || [];
              existing.push(response as FeedbackResponse);
              
              // Track question type with subtype
              if (questionTypeByRecipient.has(response.recipient_id)) {
                const typeKey = question.question_subtype === 'ai' ? 
                  `${question.question_type}_ai` : question.question_type;
                questionTypeByRecipient.get(response.recipient_id)?.add(typeKey);
                console.log(`  Added response ${response.id} to recipient ${response.recipient_id} (type: ${typeKey})`);
              }
            } else {
              console.log(`  Warning: Response ${response.id} has recipient ${response.recipient_id} which doesn't match any current recipient`);
            }
          }
        }
        
        // Log question types by recipient
        for (const [recipientId, types] of questionTypeByRecipient.entries()) {
          console.log(`Recipient ${recipientId} has question types: ${Array.from(types).join(', ')}`);
        }
        
        // No longer creating standard questions - only AI questions will be generated
        
        // Step 7: Check for and generate AI questions if needed
        const aiQuestionsToGenerate: { recipientId: string, recipientName: string }[] = [];
        
        if (recipients) {
          for (const recipient of recipients) {
            // Check if this recipient already has both AI questions
            const aiQuestionStatus = recipientWithAIQuestions.get(recipient.recipient_id) || { hasText: false, hasRating: false };
            
            if (!aiQuestionStatus.hasText || !aiQuestionStatus.hasRating) {
              // Get recipient name
              let recipientName = 'Unknown Colleague';
              const recipientProfile = recipient.feedback_user_identities;
              
              if (Array.isArray(recipientProfile) && recipientProfile.length > 0) {
                recipientName = recipientProfile[0]?.name || recipientProfile[0]?.email || 'Unknown';
              } else if (recipientProfile && typeof recipientProfile === 'object') {
                const singleProfile = Array.isArray(recipientProfile) ? recipientProfile[0] : recipientProfile;
                recipientName = singleProfile.name || singleProfile.email || 'Unknown';
              }
              
              console.log(`Will generate AI questions for ${recipientName} (${recipient.recipient_id}) - needs text: ${!aiQuestionStatus.hasText}, needs rating: ${!aiQuestionStatus.hasRating}`);
              aiQuestionsToGenerate.push({
                recipientId: recipient.recipient_id,
                recipientName
              });
            } else {
              console.log(`Skipping AI question generation for user ${recipient.recipient_id} - already has both questions`);
            }
          }
        }
        
        // Generate and create AI questions
        const aiQuestionData: QuestionData[] = [];
        
        for (const { recipientId, recipientName } of aiQuestionsToGenerate) {
          console.log(`Generating AI questions for ${recipientName} (${recipientId})`);
          
          // Get relationship between provider and recipient
          const relationship = await getUserRelationship(providerId, recipientId);
          
          if (relationship) {
            console.log(`Relationship found: ${relationship.relationship.type} - ${relationship.relationship.description}`);
            
            // Get relationship details
            const relationshipType = relationship.relationship.type;
            const relationshipDescription = relationship.relationship.description;
            
            // Generate AI questions
            const generatedQuestions = await generateAIQuestions(
              providerId, 
              recipientId,
              recipientName,
              relationship,
              companyId
            );
            
            if (generatedQuestions) {
              console.log(`Generated text question: ${generatedQuestions.textQuestion.questionText}`);
              console.log(`Generated rating question: ${generatedQuestions.ratingQuestion.questionText}`);
              
              // Create question and response records
              const aiQuestions = await createAIQuestionsAndResponses(
                companyId,
                sessionId,
                providerId,
                recipientId,
                generatedQuestions,
                relationshipType,
                relationshipDescription
              );
              
              if (aiQuestions) {
                aiQuestionData.push(...aiQuestions);
                console.log(`Created AI questions for ${recipientName}`);
              }
            }
          } else {
            console.log(`No relationship found between ${providerId} and ${recipientId}`);
          }
        }
        
        // Gather all responses (existing + new AI) - no more standard responses
        const finalResponses: FeedbackResponse[] = [...(existingResponses as FeedbackResponse[] || [])].filter(
          r => {
            const question = questionMap.get(r.question_id);
            return question && question.question_type !== 'values';
          }
        );
        
        // Process all AI responses with question and recipient info
        const finalQuestions: QuestionData[] = [];
        const processedResponseIds = new Set<string>();
        
        // Create maps to track which question types we've already added for each recipient
        const includedQuestionTypes = new Map<string, Set<string>>();
        recipients?.forEach(r => includedQuestionTypes.set(r.id, new Set()));
        
        console.log('Processing all AI responses for final UI display:');
        
        // Process existing responses
        for (const response of finalResponses) {
          // Skip if we've already processed this response
          if (processedResponseIds.has(response.id)) {
            console.log(`  Skipping duplicate response ID: ${response.id}`);
            continue;
          }
          
          const recipient = recipients?.find(r => r.id === response.recipient_id);
          if (!recipient) {
            console.log(`  No recipient found for response ${response.id} with recipient_id ${response.recipient_id}`);
            continue;
          }
          
          // Get question details from DB for AI questions that may not be in the questionMap
          let question = questionMap.get(response.question_id);
          
          if (!question) {
            const { data: questionData } = await supabase
              .from('feedback_questions')
              .select('*')
              .eq('id', response.question_id)
              .single();
              
            if (questionData) {
              question = questionData as Question;
            } else {
              console.log(`  No question found for response ${response.id} with question_id ${response.question_id}`);
              continue;
            }
          }
          
          // Skip values questions - handled separately
          if (question.question_type === 'values') {
            continue;
          }
          
          // Only process AI questions now
          if (question.question_subtype !== 'ai') {
            console.log(`  Skipping non-AI question for response ${response.id}`);
            continue;
          }
          
          // Create unique type key for AI questions
          const typeKey = `${question.question_type}_ai`;
          
          // If we already have this question type for this recipient, skip it
          if (includedQuestionTypes.get(recipient.id)?.has(typeKey)) {
            console.log(`  Skipping duplicate ${typeKey} question for recipient ${recipient.id}`);
            continue;
          }
          
          // Mark this response as processed
          processedResponseIds.add(response.id);
          includedQuestionTypes.get(recipient.id)?.add(typeKey);
          
          // Get recipient name
          let recipientName = 'Unknown Colleague';
          const recipientProfile = recipient.feedback_user_identities;
          
          if (Array.isArray(recipientProfile) && recipientProfile.length > 0) {
            recipientName = recipientProfile[0]?.name || recipientProfile[0]?.email || 'Unknown';
          } else if (recipientProfile && typeof recipientProfile === 'object') {
            const singleProfile = Array.isArray(recipientProfile) ? recipientProfile[0] : recipientProfile;
            recipientName = singleProfile.name || singleProfile.email || 'Unknown';
          }
          
          // Get relationship info for this recipient
          const relationship = relationshipMap.get(recipient.recipient_id);
          
          console.log(`  Adding ${typeKey} question for ${recipientName} (${recipient.id})`);
          
          finalQuestions.push({
            id: response.id,
            recipient_id: response.recipient_id,
            question_id: response.question_id,
            question_text: question.question_text || '',
            question_description: question.question_description || '',
            question_type: question.question_type,
            question_subtype: question.question_subtype,
            session_id: response.session_id,
            rating_value: response.rating_value,
            text_response: response.text_response,
            comment_text: response.comment_text,
            has_comment: response.has_comment || false,
            skipped: response.skipped || false,
            recipient_name: recipientName,
            relationship_type: relationship?.type,
            relationship_description: relationship?.description
          });
        }
        
        // Add AI questions to final questions array
        for (const aiQuestion of aiQuestionData) {
          finalQuestions.push(aiQuestion);
        }
        
        // Sort questions by recipient and then by question type (rating first, then text)
        finalQuestions.sort((a, b) => {
          if (a.recipient_id !== b.recipient_id) {
            return a.recipient_id.localeCompare(b.recipient_id);
          }
          
          // Order: rating, then text (both AI)
          const getTypeOrder = (q: QuestionData) => {
            return q.question_type === 'rating' ? 0 : 1;
          };
          
          return getTypeOrder(a) - getTypeOrder(b);
        });
        
        console.log(`Final AI questions count: ${finalQuestions.length}`);
        
        // Update state
        setStandardQuestions(finalQuestions);
        if (finalQuestions.length > 0) {
          setCurrentRecipientName(finalQuestions[0].recipient_name);
          setCurrentRelationship(finalQuestions[0].relationship_type || '');
          
          // Initialize comment state if applicable
          if (finalQuestions[0].has_comment && finalQuestions[0].comment_text) {
            setShowCommentField(true);
            setCurrentComment(finalQuestions[0].comment_text);
          } else {
            setShowCommentField(false);
            setCurrentComment('');
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading questions:', error);
        toast({
          title: 'Error loading questions',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive'
        });
        setLoading(false);
      } finally {
        processingRef.current[sessionId as string] = false;
      }
    };

    loadData();
  }, [sessionId, router]);

  // Reset comment field when question changes
  useEffect(() => {
    if (standardQuestions.length > 0 && currentQuestionIndex < standardQuestions.length) {
      const question = standardQuestions[currentQuestionIndex];
      
      // Reset comment state based on current question
      if (question.has_comment && question.comment_text) {
        setShowCommentField(true);
        setCurrentComment(question.comment_text);
      } else {
        setShowCommentField(false);
        setCurrentComment('');
      }
    }
  }, [currentQuestionIndex, standardQuestions]);

  const handleRatingAnswer = async (value: number) => {
    const currentQuestion = standardQuestions[currentQuestionIndex];
    if (!currentQuestion) return;

    try {
      // Update the question in our state
      const updatedQuestions = [...standardQuestions];
      updatedQuestions[currentQuestionIndex].rating_value = value;
      updatedQuestions[currentQuestionIndex].skipped = false;
      setStandardQuestions(updatedQuestions);

      // Update in the database
      await supabase
        .from('feedback_responses')
        .update({
          rating_value: value,
          skipped: false
        })
        .eq('id', currentQuestion.id);

      // We no longer auto-navigate to the next question after rating
      // User must explicitly click "Next" button
    } catch (error) {
      console.error('Error saving rating:', error);
      toast({
        title: 'Error saving response',
        description: 'Your rating could not be saved. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleTextAnswer = async (value: string) => {
    const currentQuestion = standardQuestions[currentQuestionIndex];
    if (!currentQuestion) return;

    try {
      // Update the question in our state
      const updatedQuestions = [...standardQuestions];
      updatedQuestions[currentQuestionIndex].text_response = value;
      updatedQuestions[currentQuestionIndex].skipped = false;
      setStandardQuestions(updatedQuestions);

      // Update in the database
      await supabase
        .from('feedback_responses')
        .update({
          text_response: value,
          skipped: false
        })
        .eq('id', currentQuestion.id);

      // No auto-navigation
    } catch (error) {
      console.error('Error saving text response:', error);
      toast({
        title: 'Error saving response',
        description: 'Your response could not be saved. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleValueNomination = async (user: Colleague) => {
    if (!valuesQuestion || !sessionId) return;

    try {
      setNominatedUser(user);
      
      // Check if we already have a values response record
      const { data: existingResponse, error: checkError } = await supabase
        .from('feedback_responses')
        .select('id')
        .eq('session_id', sessionId)
        .eq('question_id', valuesQuestion.id)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" error which is expected
        throw checkError;
      }
      
      if (existingResponse) {
        // Update the existing record
        await supabase
          .from('feedback_responses')
          .update({
            nominated_user_id: user.id,
            nomination_date: new Date().toISOString(),
            skipped: false
          })
          .eq('id', existingResponse.id);
      } else {
        // Create a new record
        // For values questions, we use the first recipient as a placeholder
        const firstRecipientId = standardQuestions.length > 0 ? standardQuestions[0].recipient_id : null;
        
        if (!firstRecipientId) {
          throw new Error('No recipient available for values question');
        }
        
        await supabase
          .from('feedback_responses')
          .insert({
            session_id: sessionId,
            question_id: valuesQuestion.id,
            recipient_id: firstRecipientId,
            nominated_user_id: user.id,
            nomination_date: new Date().toISOString(),
            has_comment: false,
            skipped: false
          });
      }
    } catch (error) {
      console.error('Error saving value nomination:', error);
      toast({
        title: 'Error saving nomination',
        description: 'Your nomination could not be saved. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleCommentChange = async (value: string) => {
    setCurrentComment(value);
    
    const currentQuestion = standardQuestions[currentQuestionIndex];
    if (!currentQuestion) return;

    try {
      // Update the question in our state
      const updatedQuestions = [...standardQuestions];
      updatedQuestions[currentQuestionIndex].comment_text = value;
      updatedQuestions[currentQuestionIndex].has_comment = true;
      setStandardQuestions(updatedQuestions);

      // Update in the database
      await supabase
        .from('feedback_responses')
        .update({
          comment_text: value,
          has_comment: true
        })
        .eq('id', currentQuestion.id);
    } catch (error) {
      console.error('Error saving comment:', error);
      toast({
        title: 'Error saving comment',
        description: 'Your comment could not be saved. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const toggleCommentField = async () => {
    const newShowCommentField = !showCommentField;
    setShowCommentField(newShowCommentField);
    
    // If we're hiding the comment field and there was a comment, save has_comment=false
    if (!newShowCommentField && currentComment) {
      const currentQuestion = standardQuestions[currentQuestionIndex];
      if (!currentQuestion) return;
      
      try {
        // Update the question in our state
        const updatedQuestions = [...standardQuestions];
        updatedQuestions[currentQuestionIndex].has_comment = false;
        setStandardQuestions(updatedQuestions);

        // Update in the database
        await supabase
          .from('feedback_responses')
          .update({
            has_comment: false
          })
          .eq('id', currentQuestion.id);
      } catch (error) {
        console.error('Error updating comment state:', error);
      }
    }
  };

  const submitTextResponse = () => {
    // Don't continue if the text response is empty
    const currentQuestion = standardQuestions[currentQuestionIndex];
    if (!currentQuestion || !currentQuestion.text_response?.trim()) {
      return;
    }
    
    moveToNext();
  };

  const handleSkip = async () => {
    // If we're on a standard question
    if (currentQuestionIndex < standardQuestions.length) {
      const currentQuestion = standardQuestions[currentQuestionIndex];
      if (!currentQuestion) return;

      try {
        // Update the question in our state
        const updatedQuestions = [...standardQuestions];
        updatedQuestions[currentQuestionIndex].skipped = true;
        setStandardQuestions(updatedQuestions);

        // Update in the database
        await supabase
          .from('feedback_responses')
          .update({ skipped: true })
          .eq('id', currentQuestion.id);

        // Move to next question
        moveToNext();
      } catch (error) {
        console.error('Error skipping question:', error);
        toast({
          title: 'Error',
          description: 'Could not skip this question. Please try again.',
          variant: 'destructive'
        });
      }
    } 
    // If we're on the values question, just move on without creating a record
    else if (valuesQuestion) {
      // For values questions, skipping means we don't create/update a record
      completeSession();
    }
  };

  const moveToNext = async () => {
    // If there are more standard questions, go to the next one
    if (currentQuestionIndex < standardQuestions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      
      // Update recipient name if we're moving to a different recipient
      if (standardQuestions[nextIndex].recipient_name !== currentRecipientName) {
        setCurrentRecipientName(standardQuestions[nextIndex].recipient_name);
        setCurrentRelationship(standardQuestions[nextIndex].relationship_type || '');
      }
      
      return;
    }

    // If we've completed all standard questions and have a values question, show it
    if (currentQuestionIndex === standardQuestions.length - 1 && valuesQuestion) {
      // Move to values question (which is not in the standardQuestions array)
      setCurrentQuestionIndex(standardQuestions.length);
      return;
    }

    // All questions completed
    completeSession();
  };

  const completeSession = async () => {
    try {
      // Mark session as completed
      await supabase
        .from('feedback_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      // Navigate to completion page
      router.push('/feedback/complete');
    } catch (error) {
      console.error('Error completing session:', error);
      toast({
        title: 'Error',
        description: 'Could not mark session as complete. Please try again.',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-cerulean" />
      </div>
    );
  }

  if (standardQuestions.length === 0 && !valuesQuestion) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>No Questions Available</CardTitle>
            <CardDescription>There are no feedback questions available at this time.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Calculate total questions (standard + values if present)
  const totalQuestions = standardQuestions.length + (valuesQuestion ? 1 : 0);
  
  // If we're on the values question
  const isOnValuesQuestion = currentQuestionIndex >= standardQuestions.length;
  
  // Get the current standard question if we're not on the values question
  const currentStandardQuestion = isOnValuesQuestion 
    ? null 
    : standardQuestions[currentQuestionIndex];
  
  // Calculate progress
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
  
  // Check if the current question has a valid response
  const hasValidTextResponse = currentStandardQuestion?.question_type === 'text' ? 
    !!currentStandardQuestion?.text_response?.trim() : false;
  const hasSelectedRating = currentStandardQuestion?.question_type === 'rating' && 
    currentStandardQuestion?.rating_value !== null;
  const hasSelectedNominee = isOnValuesQuestion && !!nominatedUser;

  return (
    <>
    <FeedbackHeader />
    <div className="container mx-auto py-8 px-4 max-w-xl">
        <div className='mb-12 flex items-center justify-between'>
            <div className="w-full h-2 bg-slate-100 rounded-full">
                <div className="h-2 bg-cerulean rounded-full transition-all duration-300 ease-in-out" style={{ width: `${progress}%` }}></div>
            </div>
            <span className='text-xs text-slate-500 w-40 text-right'>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
        </div>
        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-2">
          {isOnValuesQuestion && (
            <Badge variant="secondary" className="text-slate-500 font-light uppercase items-center">
              <Trophy className="h-3 w-3 text-slate-400 mr-2" />
              Company Values
            </Badge>
          )}
          {(currentStandardQuestion?.question_type === 'text') && (
            <Badge variant="secondary" className="text-slate-500 font-light uppercase items-center">
              <MessageCircle className="h-3 w-3 text-slate-400" />
            </Badge>
          )}
          {(currentStandardQuestion?.question_type === 'rating') && (
            <Badge variant="secondary" className="text-slate-500 font-light uppercase items-center">
              <Star className="h-3 w-3 text-slate-400" />
            </Badge>
          )}
          {(currentStandardQuestion?.question_subtype === 'ai') && (
            <Badge variant="secondary" className="text-slate-500 font-light uppercase items-center">
              <Sparkles className="h-3 w-3 text-slate-400" />
            </Badge>
          )}
          {!isOnValuesQuestion && currentStandardQuestion?.relationship_type && currentStandardQuestion.relationship_type !== 'unrelated' && (
            <Badge variant="secondary" className="text-slate-500 font-light uppercase items-center">
              {getRelationshipLabel(currentStandardQuestion.relationship_type)}
            </Badge>
          )}
        </div>
        
        {isOnValuesQuestion && valuesQuestion ? (
          // Values question UI
          <>
            <h1 className='text-4xl font-light text-berkeleyblue pb-2'>
              Who is someone who personifies the below value
            </h1>
            
            <div className="p-8 bg-slate-100 rounded-md mb-6">
              <div className="flex items-center mb-2">
                {valuesQuestion.icon && (
                  <FontAwesomeIcon 
                    icon={['fas', valuesQuestion.icon as IconName]} 
                    className="h-8 w-8 text-cerulean mr-2" 
                  />
                )}
                <h3 className='text-2xl font-light text-cerulean'>{valuesQuestion.question_text}</h3>
              </div>
              <p className="text-slate-600 text-base font-light">{valuesQuestion.question_description}</p>
            </div>
            
            <div className="mb-6">
              <UserSearch 
                onSelect={handleValueNomination}
                selectedUser={nominatedUser}
                placeholder="Search for a colleague who exemplifies this value..."
                autoFocus={true}
              />
            </div>
            
            <div className="flex flex-row space-x-4">
              <Button 
                onClick={moveToNext} 
                disabled={!hasSelectedNominee}
              >
                Next
              </Button>
              <Button variant="link" onClick={handleSkip} className='pl-0'>
                Skip
              </Button>
            </div>
          </>
        ) : (
          // Regular rating/text questions
          <>
            <h1 className='text-4xl font-light text-berkeleyblue pb-2'>
            {currentStandardQuestion && currentStandardQuestion.question_text.split(/\{name\}/g).map((part, i, arr) => (
                <React.Fragment key={i}>
                {part}
                {i < arr.length - 1 && <strong className='font-medium'>{currentRecipientName}</strong>}
                </React.Fragment>
            ))}
            </h1>
            <p className='text-slate-500 text-base font-light pb-4'>
            {(currentStandardQuestion?.question_description || '').split(/\{name\}/g).map((part, i, arr) => (
                <React.Fragment key={i}>
                {part}
                {i < arr.length - 1 && <strong className='font-medium'>{currentRecipientName}</strong>}
                </React.Fragment>
            ))}
            </p>

            {currentStandardQuestion && currentStandardQuestion.question_type === 'rating' ? (
                <>
                  <div className='mb-4'>
                    <RatingComponent 
                      value={currentStandardQuestion.rating_value} 
                      onChange={handleRatingAnswer} 
                    />
                  </div>
                  
                  {showCommentField ? (
                    <div className="mt-6 mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Additional comments (optional)
                      </label>
                      <FeedbackTextarea
                        placeholder="Add additional context to your rating..."
                        value={currentComment}
                        onChange={(e) => handleCommentChange(e.target.value)}
                        data-question-text={currentStandardQuestion.question_text}
                        data-question-description={currentStandardQuestion.question_description || ''}
                        className="min-h-[100px]"
                      />
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={toggleCommentField}
                      className="mb-4"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Add a comment
                    </Button>
                  )}
                  
                  <div className="flex flex-row space-x-4">
                    <Button 
                      onClick={moveToNext} 
                      disabled={!hasSelectedRating}
                    >
                      Next
                    </Button>
                    <Button variant="link" onClick={handleSkip} className='pl-0'>
                      Skip
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {currentStandardQuestion && currentStandardQuestion.question_type === 'text' && (
                    <div>
                      <FeedbackTextarea
                        placeholder="Enter your response..."
                        value={currentStandardQuestion.text_response || ''}
                        onChange={(e) => handleTextAnswer(e.target.value)}
                        data-question-text={currentStandardQuestion.question_text}
                        data-question-description={currentStandardQuestion.question_description || ''}
                        className="min-h-[150px] mb-4"
                      />
                    </div>
                  )}
                  <div className="flex flex-row">
                    <Button 
                      onClick={submitTextResponse}
                      disabled={!hasValidTextResponse}
                    >
                      Next
                    </Button>
                    <Button variant="link" onClick={handleSkip}>
                      Skip
                    </Button>
                  </div>
                </>
              )}
          </>
        )}
    </div>
    </>
  );
}