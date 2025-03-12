// src/app/feedback/questions/QuestionsContent.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import supabase from '@/lib/supabase/client';
import FeedbackHeader from '@/components/feedbackHeader';

interface FeedbackUserIdentity {
  id: string;
  name?: string | null;
  email: string;
}

interface RecipientData {
  id: string;
  recipient_id: string;
  session_id: string;
  feedback_user_identities: FeedbackUserIdentity | FeedbackUserIdentity[];
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
  
  useEffect(() => {
    const loadData = async () => {
      if (!sessionId) {
        toast({ title: 'Missing session', description: 'No session ID provided', variant: 'destructive' });
        return;
      }
    
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
        
        // Step 2: DEBUG - Check ALL feedback_recipients to see what's there
        const { data: recipientDebug } = await supabase
          .from('feedback_recipients')
          .select('id, recipient_id, session_id')
          .order('created_at');
          
        console.log("ALL recipients in system:", recipientDebug?.length || 0);
        console.log("Looking for session:", sessionId);
        
        const sessRecips = recipientDebug?.filter(r => r.session_id === sessionId) || [];
        console.log("Recipients matching this session ID:", sessRecips.length);
        
        // Step 3: Get ONLY the recipients for THIS specific session
        const { data: correctRecipients, error: recipientsError } = await supabase
          .from('feedback_recipients')
          .select(`
            id, 
            recipient_id,
            session_id,
            feedback_user_identities(id, name, email)
          `)
          .eq('session_id', sessionId) // ← This is the critical filter
          .order('created_at');
        
        if (recipientsError) throw recipientsError;
        
        console.log(`Found ${correctRecipients?.length || 0} CORRECT recipients for this session`);
        if (correctRecipients) {
          correctRecipients.forEach(r => {
            console.log(`- Recipient ID: ${r.id}, Session: ${r.session_id}`);
          });
        }
        
        // Step 4: Delete existing responses for THIS SESSION
        await supabase
          .from('feedback_responses')
          .delete()
          .eq('session_id', sessionId);
        
        console.log("Deleted all existing responses for this session");
        
        // Step 5: Get all active questions
        const { data: allQuestions, error: questionsError } = await supabase
          .from('feedback_questions')
          .select('*')
          .eq('active', true);
        
        if (questionsError) throw questionsError;
        
        const ratingQuestions = allQuestions?.filter(q => q.question_type === 'rating') || [];
        const textQuestions = allQuestions?.filter(q => q.question_type === 'text') || [];
        
        // Check if we have the required question types
        if (ratingQuestions.length === 0 || textQuestions.length === 0) {
          throw new Error('Not enough question types available');
        }
        
        // Step 6: Create 2 questions for EACH CORRECT recipient
        const allResponsesToCreate = [];
        
        // Use the FILTERED recipients list
        for (const recipient of correctRecipients || []) {
          // Double-check the session ID matches
          if (recipient.session_id !== sessionId) {
            console.warn(`Skipping recipient with wrong session ID: ${recipient.session_id}`);
            continue;
          }
          
          // Get a random question of each type
          const ratingQuestion = ratingQuestions[Math.floor(Math.random() * ratingQuestions.length)];
          const textQuestion = textQuestions[Math.floor(Math.random() * textQuestions.length)];
          
          console.log(`Creating 2 questions for recipient: ${recipient.id}`);
          
          // Add to batch
          allResponsesToCreate.push(
            {
              recipient_id: recipient.id,
              question_id: ratingQuestion.id,
              session_id: sessionId,
              skipped: false
            },
            {
              recipient_id: recipient.id,
              question_id: textQuestion.id,
              session_id: sessionId,
              skipped: false
            }
          );
        }
        
        console.log(`Creating ${allResponsesToCreate.length} total responses`);
        
        if (allResponsesToCreate.length === 0) {
          throw new Error('No valid recipients found for this session');
        }
        
        // Step 7: Bulk create responses
        const { data: newResponses, error: insertError } = await supabase
          .from('feedback_responses')
          .insert(allResponsesToCreate)
          .select();
        
        if (insertError) throw insertError;
        
        console.log(`Successfully created ${newResponses?.length || 0} new responses`);
        
        // Step 8: Process the created responses
        const questionsMap = new Map();
        allQuestions?.forEach(q => questionsMap.set(q.id, q));
        
        const finalQuestions = [];
        
        for (const response of newResponses || []) {
          const recipient: RecipientData | undefined = correctRecipients?.find(r => r.id === response.recipient_id);
          if (!recipient) continue;
          
          // Get recipient name
          let recipientName = 'Unknown Colleague';
          const recipientProfile = recipient.feedback_user_identities;

          
          if (Array.isArray(recipientProfile) && recipientProfile.length > 0) {
            recipientName = recipientProfile[0]?.name || recipientProfile[0]?.email || 'Unknown';
          } else if (recipientProfile && 'name' in recipientProfile) {
            recipientName = recipientProfile.name || recipientProfile.email || 'Unknown';
          }
          
          // Get question details
          const question = questionsMap.get(response.question_id);
          if (!question) continue;
          
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
            skipped: response.skipped || false,
            recipient_name: recipientName
          });
        }
        
        // Sort questions 
        finalQuestions.sort((a, b) => {
          if (a.recipient_id !== b.recipient_id) {
            return a.recipient_id.localeCompare(b.recipient_id);
          }
          return a.question_type === 'rating' ? -1 : 1;
        });
        
        // Final verification
        console.log(`Total questions created: ${finalQuestions.length} (should be ${(correctRecipients?.length || 0) * 2})`);
        
        // Update state
        setQuestions(finalQuestions);
        if (finalQuestions.length > 0) {
          setCurrentRecipientName(finalQuestions[0].recipient_name);
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
      }
    };

    loadData();
  }, [sessionId, router]);

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

      // Move to next question
      moveToNext();
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

      // If they typed something, we don't auto-navigate
      // They'll need to click "Next" or "Skip"
    } catch (error) {
      console.error('Error saving text response:', error);
      toast({
        title: 'Error saving response',
        description: 'Your response could not be saved. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleSubmitText = () => {
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
            <Button variant="link" onClick={handleSkip} className='pl-0'>Skip</Button>
            </>
          ) : (
            <>
              <Textarea
                placeholder="Enter your response..."
                value={currentQuestion.text_response || ''}
                onChange={(e) => handleTextAnswer(e.target.value)}
                className="min-h-[150px] mb-4"
              />
              <Button onClick={handleSubmitText}>
                Next
              </Button>
              <Button variant="link" onClick={handleSkip}>Skip</Button>
            </>
          )}
    </div>
    </>
  );
}