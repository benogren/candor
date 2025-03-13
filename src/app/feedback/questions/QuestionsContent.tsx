'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Loader2, MessageSquare } from 'lucide-react';
import supabase from '@/lib/supabase/client';
import FeedbackHeader from '@/components/feedbackHeader';

// Define interfaces outside the component to prevent redeclarations
// interface FeedbackUserIdentity {
//   id: string;
//   name?: string | null;
//   email: string;
// }

// interface RecipientData {
//   id: string;
//   recipient_id: string;
//   session_id: string;
//   feedback_user_identities: FeedbackUserIdentity | FeedbackUserIdentity[];
// }

interface Question {
  id: string;
  question_text: string;
  question_description: string;
  question_type: 'rating' | 'text';
  active: boolean;
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
}

type QuestionData = {
  id: string;
  recipient_id: string;
  question_id: string;
  question_text: string;
  question_description: string;
  question_type: 'rating' | 'text';
  session_id: string;
  rating_value: number | null;
  text_response: string | null;
  comment_text: string | null;
  has_comment: boolean;
  skipped: boolean;
  recipient_name: string;
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
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentRecipientName, setCurrentRecipientName] = useState('');
  const [showCommentField, setShowCommentField] = useState(false);
  const [currentComment, setCurrentComment] = useState('');
  
  // Use ref to prevent duplicate database operations in React's strict mode
  const processingRef = useRef<{[key: string]: boolean}>({});
  
  
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
        
        // Step 4: Get active questions
        const { data: allQuestions, error: questionsError } = await supabase
          .from('feedback_questions')
          .select('*')
          .eq('active', true);
        
        if (questionsError) throw questionsError;
        
        // Create a map of questions by ID for easier lookup
        const questionMap = new Map<string, Question>();
        if (allQuestions) {
          for (const question of allQuestions) {
            questionMap.set(question.id, question as Question);
          }
        }
        
        // Filter questions by type
        const ratingQuestions = allQuestions?.filter(q => q.question_type === 'rating') || [];
        const textQuestions = allQuestions?.filter(q => q.question_type === 'text') || [];
        
        if (ratingQuestions.length === 0 || textQuestions.length === 0) {
          throw new Error('Not enough question types available');
        }
        
        // Initialize recipientMap with EMPTY arrays for each recipient ID
        const recipientMap = new Map<string, FeedbackResponse[]>();
        if (recipients) {
          for (const recipient of recipients) {
            recipientMap.set(recipient.id, []);
          }
        }
        
        // Create a more detailed tracking structure for existing responses
        const questionTypeByRecipient = new Map<string, Set<string>>();
        
        // Initialize tracking for each recipient
        if (recipients) {
          for (const recipient of recipients) {
            questionTypeByRecipient.set(recipient.id, new Set<string>());
          }
        }
        
        // Group existing responses by recipient_id and track question types
        if (existingResponses) {
          console.log("Organizing existing responses by recipient ID and question type:");
          for (const response of existingResponses) {
            if (recipientMap.has(response.recipient_id)) {
              // Add to existing array
              const existing = recipientMap.get(response.recipient_id) || [];
              existing.push(response as FeedbackResponse);
              
              // Track question type
              const question = questionMap.get(response.question_id);
              if (question && questionTypeByRecipient.has(response.recipient_id)) {
                questionTypeByRecipient.get(response.recipient_id)?.add(question.question_type);
                console.log(`  Added response ${response.id} to recipient ${response.recipient_id} (type: ${question.question_type})`);
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
        
        // Log how many responses each recipient has
        for (const [recipientId, responses] of recipientMap.entries()) {
          console.log(`Recipient ${recipientId} has ${responses.length} existing responses`);
        }
        
        // Create deterministic question selection function
        function getQuestionForRecipient(
          questions: Question[], 
          recipientId: string, 
          index: number = 0
        ): Question {
          const seed = recipientId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const questionIndex = (seed + index) % questions.length;
          return questions[questionIndex];
        }
        
        // Identify which responses need to be created
        const responsesToCreate: Partial<FeedbackResponse>[] = [];
                
        if (recipients) {
          for (const recipient of recipients) {
            // Get existing question types for this recipient
            const existingTypes = questionTypeByRecipient.get(recipient.id) || new Set<string>();
            
            console.log(`Checking recipient ${recipient.id}: has rating=${existingTypes.has('rating')}, has text=${existingTypes.has('text')}`);
            
            // Create rating question if needed
            if (!existingTypes.has('rating')) {
              const ratingQuestion = getQuestionForRecipient(
                ratingQuestions as Question[], 
                recipient.id
              );
              
              // Double check we aren't creating a duplicate
              const isDuplicate = responsesToCreate.some(r => 
                r.recipient_id === recipient.id && 
                questionMap.get(r.question_id as string)?.question_type === 'rating'
              );
              
              if (!isDuplicate) {
                responsesToCreate.push({
                  recipient_id: recipient.id,
                  question_id: ratingQuestion.id,
                  session_id: sessionId,
                  has_comment: false,
                  skipped: false
                });
                console.log(`  Adding new rating question for recipient ${recipient.id}`);
              } else {
                console.log(`  Skipping duplicate rating question for recipient ${recipient.id}`);
              }
            }
            
            // Create text question if needed
            if (!existingTypes.has('text')) {
              const textQuestion = getQuestionForRecipient(
                textQuestions as Question[], 
                recipient.id, 
                1
              );
              
              // Double check we aren't creating a duplicate
              const isDuplicate = responsesToCreate.some(r => 
                r.recipient_id === recipient.id && 
                questionMap.get(r.question_id as string)?.question_type === 'text'
              );
              
              if (!isDuplicate) {
                responsesToCreate.push({
                  recipient_id: recipient.id,
                  question_id: textQuestion.id,
                  session_id: sessionId,
                  has_comment: false,
                  skipped: false
                });
                console.log(`  Adding new text question for recipient ${recipient.id}`);
              } else {
                console.log(`  Skipping duplicate text question for recipient ${recipient.id}`);
              }
            }
          }
        }
        
        console.log(`Need to create ${responsesToCreate.length} new responses`);
        
        // Gather all responses (existing + new)
        let finalResponses: FeedbackResponse[] = [...(existingResponses as FeedbackResponse[] || [])];
        
        // Create only the necessary responses
        if (responsesToCreate.length > 0) {
          // Double-check one more time that these responses don't already exist
          const { data: finalCheck } = await supabase
            .from('feedback_responses')
            .select('*')
            .eq('session_id', sessionId);
            
          // If more responses were created since we started, abort creation
          if (finalCheck && finalCheck.length > existingResponses?.length) {
            console.log('Additional responses were created while processing, skipping creation');
            // Use the final check data
            finalResponses = finalCheck as FeedbackResponse[];
          } else {
            // Proceed with creation as normal
            const { data: newResponses, error: createError } = await supabase
              .from('feedback_responses')
              .insert(responsesToCreate)
              .select();
            
            if (createError) throw createError;
            console.log(`Successfully created ${newResponses?.length || 0} new responses`);
            
            // Add the new responses to our final list
            if (newResponses) {
              finalResponses = [...finalResponses, ...(newResponses as FeedbackResponse[])];
            }
          }
        }
        
        // Process all responses with question and recipient info
        const finalQuestions: QuestionData[] = [];
        const processedResponseIds = new Set<string>();
        
        // Create a map to track which question types we've already added for each recipient
        const includedQuestionTypes = new Map<string, Set<string>>();
        recipients?.forEach(r => includedQuestionTypes.set(r.id, new Set()));
        
        console.log('Processing all responses for final UI display:');
        
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
          
          const question = questionMap.get(response.question_id);
          if (!question) {
            console.log(`  No question found for response ${response.id} with question_id ${response.question_id}`);
            continue;
          }
          
          // If we already have this question type for this recipient, skip it
          if (includedQuestionTypes.get(recipient.id)?.has(question.question_type)) {
            console.log(`  Skipping duplicate ${question.question_type} question for recipient ${recipient.id}`);
            continue;
          }
          
          // Mark this response as processed
          processedResponseIds.add(response.id);
          includedQuestionTypes.get(recipient.id)?.add(question.question_type);
          
          // Get recipient name
          let recipientName = 'Unknown Colleague';
          const recipientProfile = recipient.feedback_user_identities;
          
          if (Array.isArray(recipientProfile) && recipientProfile.length > 0) {
            recipientName = recipientProfile[0]?.name || recipientProfile[0]?.email || 'Unknown';
          } else if (recipientProfile && typeof recipientProfile === 'object') {
            const singleProfile = Array.isArray(recipientProfile) ? recipientProfile[0] : recipientProfile;
            recipientName = singleProfile.name || singleProfile.email || 'Unknown';
          }
          
          console.log(`  Adding ${question.question_type} question for ${recipientName} (${recipient.id})`);
          
          finalQuestions.push({
            id: response.id,
            recipient_id: response.recipient_id,
            question_id: response.question_id,
            question_text: question.question_text || '',
            question_description: question.question_description || '',
            question_type: question.question_type,
            session_id: response.session_id,
            rating_value: response.rating_value,
            text_response: response.text_response,
            comment_text: response.comment_text,
            has_comment: response.has_comment || false,
            skipped: response.skipped || false,
            recipient_name: recipientName
          });
        }
        
        // Sort questions by recipient and then by question type
        finalQuestions.sort((a, b) => {
          if (a.recipient_id !== b.recipient_id) {
            return a.recipient_id.localeCompare(b.recipient_id);
          }
          return a.question_type === 'rating' ? -1 : 1;
        });
        
        console.log(`Final questions count: ${finalQuestions.length}`);
        
        // Update state
        setQuestions(finalQuestions);
        if (finalQuestions.length > 0) {
          setCurrentRecipientName(finalQuestions[0].recipient_name);
          
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
    if (questions.length > 0 && currentQuestionIndex < questions.length) {
      const question = questions[currentQuestionIndex];
      
      // Reset comment state based on current question
      if (question.has_comment && question.comment_text) {
        setShowCommentField(true);
        setCurrentComment(question.comment_text);
      } else {
        setShowCommentField(false);
        setCurrentComment('');
      }
    }
  }, [currentQuestionIndex, questions]);

  const handleRatingAnswer = async (value: number) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    try {
      // Update the question in our state
      const updatedQuestions = [...questions];
      updatedQuestions[currentQuestionIndex].rating_value = value;
      updatedQuestions[currentQuestionIndex].skipped = false;
      setQuestions(updatedQuestions);

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
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    try {
      // Update the question in our state
      const updatedQuestions = [...questions];
      updatedQuestions[currentQuestionIndex].text_response = value;
      updatedQuestions[currentQuestionIndex].skipped = false;
      setQuestions(updatedQuestions);

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

  const handleCommentChange = async (value: string) => {
    setCurrentComment(value);
    
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    try {
      // Update the question in our state
      const updatedQuestions = [...questions];
      updatedQuestions[currentQuestionIndex].comment_text = value;
      updatedQuestions[currentQuestionIndex].has_comment = true;
      setQuestions(updatedQuestions);

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
      const currentQuestion = questions[currentQuestionIndex];
      if (!currentQuestion) return;
      
      try {
        // Update the question in our state
        const updatedQuestions = [...questions];
        updatedQuestions[currentQuestionIndex].has_comment = false;
        setQuestions(updatedQuestions);

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
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion || !currentQuestion.text_response?.trim()) {
      return;
    }
    
    moveToNext();
  };

  const handleSkip = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    try {
      // Update the question in our state
      const updatedQuestions = [...questions];
      updatedQuestions[currentQuestionIndex].skipped = true;
      setQuestions(updatedQuestions);

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
  };

  const moveToNext = async () => {
    // If there are more questions, go to the next one
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      
      // Update recipient name if we're moving to a different recipient
      if (questions[nextIndex].recipient_name !== currentRecipientName) {
        setCurrentRecipientName(questions[nextIndex].recipient_name);
      }
      
      return;
    }

    // All questions completed
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

  if (questions.length === 0) {
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

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const hasValidTextResponse = currentQuestion.question_type === 'text' && 
    !!currentQuestion.text_response?.trim();
  const hasSelectedRating = currentQuestion.question_type === 'rating' && 
    currentQuestion.rating_value !== null;

  return (
    <>
    <FeedbackHeader />
    <div className="container mx-auto py-8 px-4 max-w-xl">
        <div className='mb-12 flex items-center justify-between'>
            <div className="w-full h-2 bg-slate-100 rounded-full">
                <div className="h-2 bg-cerulean rounded-full transition-all duration-300 ease-in-out" style={{ width: `${progress}%` }}></div>
            </div>
            <span className='text-xs text-slate-500 w-40 text-right'>Question {currentQuestionIndex + 1} of {questions.length}</span>
        </div>

        <h1 className='text-4xl font-light text-berkeleyblue pb-2'>
        {currentQuestion.question_text.split(/\{name\}/g).map((part, i, arr) => (
            <React.Fragment key={i}>
            {part}
            {i < arr.length - 1 && <strong className='font-medium'>{currentRecipientName}</strong>}
            </React.Fragment>
        ))}
        </h1>
        <p className='text-slate-500 text-base font-light pb-4'>
        {(currentQuestion.question_description || '').split(/\{name\}/g).map((part, i, arr) => (
            <React.Fragment key={i}>
            {part}
            {i < arr.length - 1 && <strong className='font-medium'>{currentRecipientName}</strong>}
            </React.Fragment>
        ))}
        </p>

        {currentQuestion.question_type === 'rating' ? (
            <>
              <div className='mb-4'>
                <RatingComponent 
                  value={currentQuestion.rating_value} 
                  onChange={handleRatingAnswer} 
                />
              </div>
              
              {showCommentField ? (
                <div className="mt-6 mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional comments (optional)
                  </label>
                  <Textarea
                    placeholder="Add additional context to your rating..."
                    value={currentComment}
                    onChange={(e) => handleCommentChange(e.target.value)}
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
              <Textarea
                placeholder="Enter your response..."
                value={currentQuestion.text_response || ''}
                onChange={(e) => handleTextAnswer(e.target.value)}
                className="min-h-[150px] mb-4"
              />
              <div className="flex space-x-4">
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
    </div>
    </>
  );
}