// src/components/FeedbackList.tsx
import { useState, useEffect } from 'react';
import supabase from '@/lib/supabase/client';
import FeedbackCard from './FeedbackCard';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComments } from '@fortawesome/free-regular-svg-icons';

// Define interfaces that match the database structure exactly
interface FeedbackQuestion {
  id: string;
  question_text: string;
  question_type: string;
  company_id?: string;
  scope?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
  question_description?: string;
}

interface FeedbackUserIdentity {
  id: string;
  name: string | null;
  email: string | null;
  user_id: string | null;
}

interface FeedbackRecipient {
  id: string;
  recipient_id: string;
  feedback_user_identities: FeedbackUserIdentity;
}

interface FeedbackResponse {
  id: string;
  recipient_id: string;
  question_id: string;
  session_id: string;
  rating_value: number | null;
  text_response: string | null;
  has_comment: boolean | null;
  comment_text: string | null;
  skipped: boolean | null;
  created_at: string;
  updated_at: string | null;
  is_flagged?: boolean | null;
  flagged_by?: string | null;
  flagged_at?: string | null;
  feedback_questions?: FeedbackQuestion;
  feedback_recipients?: FeedbackRecipient;
  // [key: string]: any; // Allow other fields that might be in the database
}

interface FeedbackListProps {
  userId?: string;     // For employee viewing their own feedback
  employeeId?: string; // For filtering in manager view (specific employee)
  managerId?: string;  // For manager viewing all their direct reports
}

export default function FeedbackList({ userId, employeeId, managerId }: FeedbackListProps) {
  const [feedback, setFeedback] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch feedback
  useEffect(() => {
    const fetchFeedback = async () => {
      setLoading(true);
      
      try {
        // Handle different scenarios:
        // 1. Employee viewing their own feedback (userId provided)
        // 2. Manager viewing a specific employee's feedback (employeeId provided)
        // 3. Manager viewing all direct reports' feedback (managerId provided)
        
        // CASE 1 & 2: Get feedback for a specific user (either self or a specific employee)
        if (userId || employeeId) {
          const targetId = userId || employeeId;
          
          // For this type of query - use the targetId directly with feedback_user_identities
          // as it appears id is the primary identifier in your database
          const { data: recipientData, error: recipientError } = await supabase
            .from('feedback_recipients')
            .select('id')
            .eq('recipient_id', targetId);
            
          if (recipientError) throw recipientError;
          
          const recipientIds = (recipientData || []).map(r => r.id);
          
          if (recipientIds.length === 0) {
            setFeedback([]);
            setLoading(false);
            return;
          }
          
          // Now get feedback responses for these recipients, joining with questions
          const { data: feedbackData, error: feedbackError } = await supabase
            .from('feedback_responses')
            .select(`
              *,
              feedback_questions!inner(
                id,
                question_text,
                question_type
              ),
              feedback_sessions!inner(
                id,
                status
              ),
              feedback_recipients!inner(
                id,
                recipient_id,
                feedback_user_identities!inner(
                  id,
                  name,
                  email
                )
              )
            `)
            .in('recipient_id', recipientIds)
            .eq('skipped', false)
            .eq('feedback_sessions.status', 'completed') // dont show in progress answers
            .order('created_at', { ascending: false })
            
          if (feedbackError) throw feedbackError;
          
          // Set the feedback
          setFeedback(feedbackData || []);
        }
        // CASE 3: Manager viewing all their direct reports' feedback
        else if (managerId) {
          // First get IDs of all direct reports from org_structure
          const { data: directReports, error: directReportsError } = await supabase
            .from('org_structure')
            .select('id')
            .eq('manager_id', managerId);
          
          if (directReportsError) throw directReportsError;
          
          if (!directReports || directReports.length === 0) {
            setFeedback([]);
            setLoading(false);
            return;
          }
          
          const directReportIds = directReports.map(dr => dr.id);
          
          // Get recipient IDs for these direct reports
          const { data: recipientData, error: recipientError } = await supabase
            .from('feedback_recipients')
            .select('id')
            .in('recipient_id', directReportIds);
            
          if (recipientError) throw recipientError;
          
          if (!recipientData || recipientData.length === 0) {
            setFeedback([]);
            setLoading(false);
            return;
          }
          
          const recipientIds = recipientData.map(r => r.id);
          
          // Now get feedback responses for all these recipients
          const { data: feedbackData, error: feedbackError } = await supabase
            .from('feedback_responses')
            .select(`
              *,
              feedback_questions!inner(
                id,
                question_text,
                question_type
              ),
              feedback_sessions!inner(
                id,
                status
              ),
              feedback_recipients!inner(
                id,
                recipient_id,
                feedback_user_identities!inner(
                  id,
                  name,
                  email
                )
              )
            `)
            .in('recipient_id', recipientIds)
            .eq('skipped', false)
            .eq('feedback_sessions.status', 'completed') // dont show in progress answers
            .order('created_at', { ascending: false })
            
          if (feedbackError) throw feedbackError;
          
          // Set the feedback
          setFeedback(feedbackData || []);
        }
      } catch (error) {
        console.error('Error fetching feedback:', error);
        toast({
          title: 'Error',
          description: 'Failed to load feedback',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchFeedback();
  }, [userId, employeeId, managerId]);
  
  // Flag feedback as inappropriate
  const handleFlag = async (feedbackId: string) => {
    try {
      const { error } = await supabase
        .from('feedback_responses')
        .update({ 
          is_flagged: true,
          flagged_by: userId || managerId,
          flagged_at: new Date().toISOString()
        })
        .eq('id', feedbackId);
      
      if (error) throw error;
      
      // Update local state
      setFeedback(prev => 
        prev.map(item => 
          item.id === feedbackId ? { ...item, is_flagged: true } : item
        )
      );
    } catch (error) {
      console.error('Error flagging feedback:', error);
      throw error;
    }
  };
  
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-4">
              <Skeleton className="h-4 w-24" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }
  
  if (feedback.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 flex flex-col items-center">
        <FontAwesomeIcon 
          icon={faComments} 
          className="h-12 w-12 text-gray-300 mb-2"
        />
        <p>
          {employeeId 
            ? "We're still collecting feedback for this team member." 
            : managerId 
              ? "We're still collecting feedback for your team." 
              : "We're still collecting feedback for you. Check back soon!"}
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {feedback.map(item => (
        <FeedbackCard
          key={item.id}
          id={item.id}
          feedback_questions={item.feedback_questions}
          feedback_recipients={item.feedback_recipients}
          text_response={item.text_response}
          rating_value={item.rating_value}
          comment_text={item.comment_text}
          created_at={item.created_at}
          is_flagged={item.is_flagged || false}
          onFlag={handleFlag}
        />
      ))}
    </div>
  );
}