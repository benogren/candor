// src/app/feedback/questions/[recipientId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import supabase from '@/lib/supabase/client';
import { FeedbackQuestion, FeedbackRecipient } from '@/app/types/feedback';

type QuestionData = FeedbackQuestion & {
  recipientId: string;
  responseId?: string;
  value?: string | number | null;
  comment?: string | null;
  skipped?: boolean;
  has_comment?: boolean;
};

const RatingComponent = ({ 
  value, 
  onChange 
}: { 
  value: number | null; 
  onChange: (value: number) => void;
}) => {
  return (
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
              value === rating
                ? 'bg-cerulean text-white'
                : 'bg-slate-100 hover:bg-slate-200'
            }`}
          >
            {rating}
          </button>
        ))}
      </div>
    </div>
  );
};

export default function FeedbackQuestionsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const recipientId = params.recipientId as string;
  const sessionId = searchParams.get('session');
  
  const [loading, setLoading] = useState(true);
//   const [submitting, setSubmitting] = useState(false);
  const [recipient, setRecipient] = useState<{ id: string; name: string; email: string } | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showComment, setShowComment] = useState(false);
  const [recipients, setRecipients] = useState<FeedbackRecipient[]>([]);
  const [currentRecipientIndex, setCurrentRecipientIndex] = useState(0);
  
  // Load recipient data and questions
  useEffect(() => {
    const loadData = async () => {
      if (!sessionId || !recipientId) {
        toast({
          title: 'Missing information',
          description: 'Session or recipient information is missing.',
          variant: 'destructive',
        });
        router.push('/feedback');
        return;
      }
      
      try {
        // Get recipient information
        const { data: recipientData, error: recipientError } = await supabase
          .from('company_members')
          .select('id, name, email, company_id')
          .eq('id', recipientId)
          .single();
          
        if (recipientError || !recipientData) {
          throw new Error('Could not find recipient data');
        }
        
        setRecipient(recipientData);
        
        // Get all recipients for this session (for navigation)
        const { data: allRecipients, error: recipientsError } = await supabase
          .from('feedback_recipients')
          .select('id, recipient_id, status, created_at, session_id, updated_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });
          
        if (recipientsError) {
          throw new Error('Could not load recipients list');
        }
        
        setRecipients(allRecipients);
        setCurrentRecipientIndex(
          allRecipients.findIndex(r => r.recipient_id === recipientId)
        );
        
        // Update recipient status to in_progress if it's still pending
        const currentRecipient = allRecipients.find(r => r.recipient_id === recipientId);
        if (currentRecipient && currentRecipient.status === 'pending') {
          await supabase
            .from('feedback_recipients')
            .update({ status: 'in_progress' })
            .eq('id', currentRecipient.id);
        }
        
        // Get feedback questions
        const { data: questionData, error: questionsError } = await supabase
          .from('feedback_questions')
          .select('*')
          .or(`scope.eq.global,and(scope.eq.company,company_id.eq.${recipientData.company_id})`)
          .eq('active', true)
          .order('scope', { ascending: false }) // Company-specific questions first
          .order('created_at', { ascending: true });
          
        if (questionsError) {
          throw new Error('Could not load feedback questions');
        }
        
        // Get existing responses if any
        const { data: responsesData, error: responsesError } = await supabase
          .from('feedback_responses')
          .select('*')
          .eq('recipient_id', currentRecipient?.id);
          
        if (responsesError) {
          console.error('Error fetching responses:', responsesError);
        }
        
        // Map questions with responses if they exist
        const questionsWithResponses = questionData.map(question => {
          const existingResponse = responsesData?.find(r => r.question_id === question.id);
          
          return {
            ...question,
            recipientId: currentRecipient?.id,
            responseId: existingResponse?.id,
            value: existingResponse?.rating_value || existingResponse?.text_response || null,
            comment: existingResponse?.comment_text || null,
            skipped: existingResponse?.skipped || false
          } as QuestionData;
        });
        
        setQuestions(questionsWithResponses);
        setLoading(false);
      } catch (error) {
        console.error('Error loading feedback data:', error);
        toast({
          title: 'Error loading data',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
          variant: 'destructive',
        });
        router.push('/feedback');
      }
    };
    
    loadData();
  }, [sessionId, recipientId, router]);
  
  // Get current question
  const currentQuestion = questions[currentQuestionIndex];
  
  // Handle answer to a question
  const handleAnswer = async (value: string | number | null) => {
    if (!currentQuestion) return;
    
    try {
      // Clone the questions array to update
      const updatedQuestions = [...questions];
      const updatedQuestion = { ...updatedQuestions[currentQuestionIndex] };
      
      // Update the value
      updatedQuestion.value = value;
      updatedQuestion.skipped = false;
      updatedQuestions[currentQuestionIndex] = updatedQuestion;
      setQuestions(updatedQuestions);
      
      // Save to database
      const isRating = currentQuestion.question_type === 'rating';
      
      const responseData = {
        recipient_id: currentQuestion.recipientId,
        question_id: currentQuestion.id,
        [isRating ? 'rating_value' : 'text_response']: value,
        skipped: false,
        has_comment: !!currentQuestion.comment,
        comment_text: currentQuestion.comment
      };
      
      if (currentQuestion.responseId) {
        // Update existing response
        await supabase
          .from('feedback_responses')
          .update(responseData)
          .eq('id', currentQuestion.responseId);
      } else {
        // Create new response
        const { data } = await supabase
          .from('feedback_responses')
          .insert(responseData)
          .select('id')
          .single();
          
        if (data) {
          updatedQuestion.responseId = data.id;
          updatedQuestions[currentQuestionIndex] = updatedQuestion;
          setQuestions(updatedQuestions);
        }
      }
      
      // If it's a rating question and no comment is shown yet, show the comment option
      if (isRating && !showComment) {
        setShowComment(true);
        return;
      }
      
      // Move to next question or recipient
      await moveToNext();
      
    } catch (error) {
      console.error('Error saving response:', error);
      toast({
        title: 'Error saving response',
        description: 'Your response could not be saved. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Save comment for rating question
  const handleCommentSave = async (comment: string) => {
    if (!currentQuestion) return;
    
    try {
      // Clone the questions array to update
      const updatedQuestions = [...questions];
      const updatedQuestion = { ...updatedQuestions[currentQuestionIndex] };
      
      // Update the comment
      updatedQuestion.comment = comment;
      updatedQuestion.has_comment = true;
      updatedQuestions[currentQuestionIndex] = updatedQuestion;
      setQuestions(updatedQuestions);
      
      // Save to database
      if (currentQuestion.responseId) {
        await supabase
          .from('feedback_responses')
          .update({
            comment_text: comment,
            has_comment: true
          })
          .eq('id', currentQuestion.responseId);
      }
      
      // Hide comment form and move to next question
      setShowComment(false);
      await moveToNext();
      
    } catch (error) {
      console.error('Error saving comment:', error);
      toast({
        title: 'Error saving comment',
        description: 'Your comment could not be saved. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Skip current question
  const handleSkip = async () => {
    if (!currentQuestion) return;
    
    try {
      // Clone the questions array to update
      const updatedQuestions = [...questions];
      const updatedQuestion = { ...updatedQuestions[currentQuestionIndex] };
      
      // Mark as skipped
      updatedQuestion.skipped = true;
      updatedQuestions[currentQuestionIndex] = updatedQuestion;
      setQuestions(updatedQuestions);
      
      // Save to database
      const responseData = {
        recipient_id: currentQuestion.recipientId,
        question_id: currentQuestion.id,
        skipped: true
      };
      
      if (currentQuestion.responseId) {
        // Update existing response
        await supabase
          .from('feedback_responses')
          .update(responseData)
          .eq('id', currentQuestion.responseId);
      } else {
        // Create new response
        const { data } = await supabase
          .from('feedback_responses')
          .insert(responseData)
          .select('id')
          .single();
          
        if (data) {
          updatedQuestion.responseId = data.id;
          updatedQuestions[currentQuestionIndex] = updatedQuestion;
          setQuestions(updatedQuestions);
        }
      }
      
      // Move to next question or recipient
      await moveToNext();
      
    } catch (error) {
      console.error('Error skipping question:', error);
      toast({
        title: 'Error skipping question',
        description: 'Could not mark question as skipped. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Cancel comment and continue
  const handleCancelComment = async () => {
    setShowComment(false);
    await moveToNext();
  };
  
  // Move to next question or recipient
  const moveToNext = async () => {
    // Check if there are more questions
    if (currentQuestionIndex < questions.length - 1) {
      // Move to next question
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowComment(false);
      return;
    }
    
    // No more questions, mark recipient as completed
    try {
      const currentRecipient = recipients.find(r => r.recipient_id === recipientId);
      if (currentRecipient) {
        await supabase
          .from('feedback_recipients')
          .update({ status: 'completed' })
          .eq('id', currentRecipient.id);
      }
      
      // Check if there are more recipients
      if (currentRecipientIndex < recipients.length - 1) {
        // Move to next recipient
        const nextRecipient = recipients[currentRecipientIndex + 1];
        router.push(`/feedback/questions/${nextRecipient.recipient_id}?session=${sessionId}`);
      } else {
        // All recipients completed, mark session as completed
        if (sessionId) {
          await supabase
            .from('feedback_sessions')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', sessionId);
        }
        
        // Redirect to completion page
        router.push('/feedback/complete');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error saving progress',
        description: 'Could not update your progress. Please try again.',
        variant: 'destructive',
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
  
  if (!recipient || !currentQuestion) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Feedback</CardTitle>
            <CardDescription>Could not load feedback data. Please try again later.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push('/feedback')}>
              Return to Feedback
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          {currentQuestion.question_type === 'rating' ? (
            <CardTitle>
              {currentQuestion.question_text.replace('{name}', recipient.name)}
            </CardTitle>
          ) : (
            <CardTitle>
              {currentQuestion.question_text.replace('{name}', recipient.name)}
            </CardTitle>
          )}
          <CardDescription>
            Question {currentQuestionIndex + 1} of {questions.length} for {recipient.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentQuestion.question_type === 'rating' ? (
            showComment ? (
              <div className="space-y-4">
                <p className="text-sm font-medium">Add a comment about your rating (optional):</p>
                <Textarea
                  placeholder="Add context to your rating..."
                  value={currentQuestion.comment || ''}
                  onChange={(e) => {
                    const updatedQuestions = [...questions];
                    updatedQuestions[currentQuestionIndex] = {
                      ...updatedQuestions[currentQuestionIndex],
                      comment: e.target.value
                    };
                    setQuestions(updatedQuestions);
                  }}
                  className="min-h-[100px]"
                />
              </div>
            ) : (
              <RatingComponent
                value={
                  typeof currentQuestion.value === 'number' 
                    ? currentQuestion.value 
                    : null
                }
                onChange={handleAnswer}
              />
            )
          ) : (
            <div className="space-y-4">
              <Textarea
                placeholder="Enter your feedback..."
                value={currentQuestion.value as string || ''}
                onChange={(e) => {
                  const updatedQuestions = [...questions];
                  updatedQuestions[currentQuestionIndex] = {
                    ...updatedQuestions[currentQuestionIndex],
                    value: e.target.value
                  };
                  setQuestions(updatedQuestions);
                }}
                className="min-h-[150px]"
              />
              <div className="flex justify-end">
                <Button 
                  onClick={() => handleAnswer(currentQuestion.value as string || '')}
                  disabled={!currentQuestion.value}
                >
                  Save & Continue
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleSkip}
          >
            Skip
          </Button>
          
          {currentQuestion.question_type === 'rating' && showComment && (
            <div className="space-x-2">
              <Button
                variant="outline"
                onClick={handleCancelComment}
              >
                Skip Comment
              </Button>
              <Button
                onClick={() => handleCommentSave(currentQuestion.comment || '')}
              >
                Save & Continue
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}