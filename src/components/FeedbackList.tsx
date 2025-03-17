// src/components/FeedbackList.tsx
import { useState, useEffect } from 'react';
import supabase from '@/lib/supabase/client';
import FeedbackCard from './FeedbackCard';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComments } from '@fortawesome/free-regular-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';

// Add all FontAwesome solid icons to the library
library.add(fas);

// Define interfaces that match the database structure exactly
interface FeedbackQuestion {
  id: string;
  question_text: string;
  question_type: string;
  question_subtype?: string;
  company_id?: string;
  scope?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
  question_description?: string;
  company_value_id?: string;
  company_values?: {
    icon?: string | null;
  };
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
  nominated_user_id?: string | null;
  feedback_questions?: FeedbackQuestion;
  feedback_recipients?: FeedbackRecipient;
  nominated_user?: FeedbackUserIdentity;
}

interface FeedbackListProps {
  userId?: string;     // For employee viewing their own feedback
  employeeId?: string; // For filtering in manager view (specific employee)
  managerId?: string;  // For manager viewing all their direct reports
  includeValues?: boolean; // Whether to include value nominations
}

export default function FeedbackList({ 
  userId, 
  employeeId, 
  managerId, 
  includeValues = true 
}: FeedbackListProps) {
  const [feedback, setFeedback] = useState<FeedbackResponse[]>([]);
  const [valueNominations, setValueNominations] = useState<FeedbackResponse[]>([]);
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
                question_type,
                question_subtype,
                company_value_id,
                company_values(
                  icon
                )
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
              ),
              nominated_user:feedback_user_identities(
                id,
                name,
                email
              )
            `)
            .in('recipient_id', recipientIds)
            .eq('skipped', false)
            .eq('feedback_sessions.status', 'completed') // dont show in progress answers
            .in('feedback_questions.question_type', ['text', 'rating']) // exclude values
            .order('created_at', { ascending: false });
            
          if (feedbackError) throw feedbackError;
          
          // Set the feedback
          setFeedback(feedbackData || []);
          
          // If includeValues is true, also fetch value nominations for this user
          if (includeValues) {
            if (targetId) {
              await fetchValueNominations(targetId);
            }
          }
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
                question_type,
                question_subtype,
                company_value_id,
                company_values(
                  icon
                )
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
              ),
              nominated_user:feedback_user_identities(
                id,
                name,
                email
              )
            `)
            .in('recipient_id', recipientIds)
            .eq('skipped', false)
            .in('feedback_questions.question_type', ['text', 'rating']) // exclude values
            .eq('feedback_sessions.status', 'completed') // dont show in progress answers
            .order('created_at', { ascending: false });
            
          if (feedbackError) throw feedbackError;
          
          // Set the feedback
          setFeedback(feedbackData || []);
          
          // If includeValues is true, fetch value nominations for all direct reports
          if (includeValues) {
            await fetchValueNominationsForTeam(directReportIds);
          }
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
    
    // Fetch value nominations for a specific user
    const fetchValueNominations = async (userId: string) => {
      try {
        // Get value nominations where this user is nominated
        const { data: nominations, error } = await supabase
          .from('feedback_responses')
          .select(`
            *,
            feedback_questions!inner(
              id,
              question_text,
              question_type,
              question_description,
              company_value_id,
              company_values(
                icon
              )
            ),
            feedback_sessions!inner(
              id,
              status
            ),
            nominated_user:feedback_user_identities!inner(
              id,
              name,
              email
            )
          `)
          .eq('nominated_user_id', userId)
          .eq('skipped', false)
          .eq('feedback_sessions.status', 'completed')
          .in('feedback_questions.question_type', ['values'])
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        setValueNominations(nominations || []);
      } catch (error) {
        console.error('Error fetching value nominations:', error);
      }
    };
    
    // Fetch value nominations for a team
    const fetchValueNominationsForTeam = async (teamMemberIds: string[]) => {
      try {
        // Get value nominations where any team member is nominated
        const { data: nominations, error } = await supabase
          .from('feedback_responses')
          .select(`
            *,
            feedback_questions!inner(
              id,
              question_text,
              question_type,
              question_subtype,
              question_description,
              company_value_id,
              company_values(
                icon
              )
            ),
            feedback_sessions!inner(
              id,
              status
            ),
            nominated_user:feedback_user_identities!inner(
              id,
              name,
              email
            )
          `)
          .in('nominated_user_id', teamMemberIds)
          .eq('skipped', false)
          .eq('feedback_sessions.status', 'completed')
          .in('feedback_questions.question_type', ['values'])
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        setValueNominations(nominations || []);
      } catch (error) {
        console.error('Error fetching value nominations for team:', error);
      }
    };
    
    fetchFeedback();
  }, [userId, employeeId, managerId, includeValues]);
  
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
  
  // Combine regular feedback and value nominations
  const combinedFeedback = [...feedback, ...valueNominations].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
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
  
  if (combinedFeedback.length === 0) {
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
      {combinedFeedback.map(item => {
        // Extract icon from company_values if it exists
        const icon = item.feedback_questions?.company_values?.icon || null;
        // Create a copy of feedback_questions with the icon
        const questionsWithIcon = item.feedback_questions 
        ? {
            ...item.feedback_questions,
            // Ensure the icon is properly structured according to your interface
            icon: icon // If FeedbackQuestion has a direct icon property
            // OR if icon should stay in company_values:
            // company_values: {...item.feedback_questions.company_values, icon}
          } 
        : undefined;
          
        return (
          <FeedbackCard
            key={item.id}
            id={item.id}
            feedback_questions={questionsWithIcon}
            feedback_recipients={item.feedback_recipients}
            text_response={item.text_response}
            rating_value={item.rating_value}
            comment_text={item.comment_text}
            created_at={item.created_at}
            is_flagged={item.is_flagged || false}
            nominated_user={item.nominated_user}
            onFlag={handleFlag}
          />
        );
      })}
    </div>
  );
}