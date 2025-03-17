// components/FeedbackCard.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import ReactTimeAgo from 'react-timeago';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStarHalfStroke, faStar, faComments, faAward } from '@fortawesome/free-solid-svg-icons';
import { faFlag, faMessage } from '@fortawesome/free-regular-svg-icons';


// Match the feedback question structure from database
interface FeedbackQuestion {
  id: string;
  question_text: string;
  question_type: string;
  question_subtype?: string;
  company_value_id?: string;
  icon?: string | null;  // Update to match the same type as in other files
}

interface FeedbackUserIdentity {
  id: string;
  name: string | null;
  email: string | null;
}

interface FeedbackRecipient {
  id: string;
  recipient_id: string;
  feedback_user_identities?: FeedbackUserIdentity;
}

export interface FeedbackCardProps {
  id: string;
  feedback_questions?: FeedbackQuestion;
  feedback_recipients?: FeedbackRecipient;
  text_response: string | null;
  rating_value: number | null;
  comment_text: string | null;
  created_at: string;
  is_flagged: boolean;
  nominated_user?: FeedbackUserIdentity | null;
  onFlag: (id: string) => Promise<void>;
}

export default function FeedbackCard({ 
  id, 
  feedback_questions,
  feedback_recipients,
  text_response,
  rating_value,
  comment_text,
  created_at, 
  is_flagged,
  nominated_user,
  onFlag 
}: FeedbackCardProps) {
  const [flagging, setFlagging] = useState(false);
  
  const handleFlag = async () => {
    if (is_flagged) return;
    
    setFlagging(true);
    try {
      await onFlag(id);
      toast({
        title: 'Feedback flagged',
        description: 'An administrator will review this feedback.',
      });
    } catch (error) {
      console.error('Error flagging feedback:', error);
      toast({
        title: 'Error',
        description: 'Failed to flag feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setFlagging(false);
    }
  };

  // Helper to render stars based on rating
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className={`text-xl ${i < rating ? 'text-cerulean-400' : 'text-cerulean-100'}`}>
            <FontAwesomeIcon 
            icon={faStar} 
            className="h-4 w-4"
            />
          </span>
        ))}
        <span className="ml-2 text-sm text-gray-600">{rating}/10</span>
      </div>
    );
  };

  // Function to replace {name} with the actual name
  const formatQuestionText = (text: string): string => {
    // Get recipient name through the nested relationship
    const recipientName = 
      feedback_recipients?.feedback_user_identities?.name || 
      'this person';

    // Replace {name} with the actual name
    return text.replace(/\{name\}/g, recipientName);
  };

  // Check if we have valid feedback questions data
  const rawQuestionText = feedback_questions?.question_text || 'Feedback';
  const questionText = formatQuestionText(rawQuestionText);
  const questionType = feedback_questions?.question_type || 'text';
  const isValuesFeedback = questionType === 'values';
  // const icon = feedback_questions?.icon;

  // For value nominations
  const renderValueNomination = () => {
    if (!isValuesFeedback || !nominated_user) return null;
    
    return (
      <>
      <div className='flex justify-between items-center'>
        <div className='flex items-center gap-2'>
          <FontAwesomeIcon 
            icon={faAward} 
            className="h-6 w-6 text-pantonered-300"
          />
          <h4 className='text-lg font-light text-cerulean'>
          {nominated_user.name} was recognized for exemplifying this value: <strong>{questionText}</strong>
          </h4>
        </div>
        <span className='text-xs text-slate-400'>
            <ReactTimeAgo date={created_at} />
        </span>
      </div>
      </>
    );
  };

  return (
    <>
    <div className='bg-white p-4 rounded-md shadow-md mb-4'>
        {isValuesFeedback ? (
          <>
          {renderValueNomination()}
          </>
        ) : (
          <>
        <div className='flex justify-between items-center'>
            <div className='flex items-center gap-2 pb-4'>
                  <FontAwesomeIcon 
                    icon={questionType === 'rating' ? faStarHalfStroke : faComments} 
                    className="h-6 w-6 text-berkeleyblue-200"
                  />
                <h4 className='text-lg font-light text-berkeleyblue'>
                    {questionText}
                </h4>
            </div>
            <div className='flex items-center gap-2'>
                <span className='text-xs text-slate-400'>
                    <ReactTimeAgo date={created_at} />
                </span>
                {!is_flagged && !isValuesFeedback && (
                  <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-red-600"
                      onClick={handleFlag}
                      disabled={flagging}
                  >
                      <FontAwesomeIcon 
                      icon={faFlag} 
                      className="h-4 w-4 text-berkeleyblue-200"
                      />
                  </Button>
                )}
            </div>
        </div>
        
        {questionType === 'rating' && rating_value ? (
          <div className="mb-4">
            {renderStars(rating_value)}
          </div>
        ) : null}
        
        {text_response ? (
            <p className='text-slate-500 text-base font-light text-pretty'>
            {text_response}
            </p>
        ) : null}
        
        {comment_text ? (
          <div className="mb-2 text-gray-700">
            <div className="flex items-start gap-2 items-center">
                <FontAwesomeIcon 
                icon={faMessage} 
                className="h-4 w-4 text-berkeleyblue-200"
                />
                <p className='text-slate-500 text-base font-light'>{comment_text}</p>
            </div>
          </div>
        ) : null}

        {is_flagged && (
          <div className="mt-4 flex items-center text-amber-700 text-sm bg-amber-100 p-2 rounded-md">
            <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>This feedback has been flagged for review</span>
          </div>
        )}
        </>
        )}
    </div>
    </>
  );
}