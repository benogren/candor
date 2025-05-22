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

// Define interfaces that match the RPC response structure
interface FeedbackQuestion {
  id: string;
  question_text: string;
  question_type: string;
  question_subtype?: string;
  question_description?: string;
  company_value_id?: string;
  company_values?: {
    icon?: string | null;
    description?: string;
  };
}

interface FeedbackUserIdentity {
  id: string;
  name: string | null;
  email: string | null;
}

interface FeedbackRecipient {
  id: string;
  recipient_id: string;
  feedback_user_identities: FeedbackUserIdentity;
}

interface FeedbackSession {
  id: string;
  status: string;
  provider_id: string;
}

interface FeedbackResponse {
  id: string;
  recipient_id: string;
  session_id: string;
  rating_value: number | null;
  text_response: string | null;
  has_comment: boolean | null;
  comment_text: string | null;
  skipped: boolean | null;
  created_at: string;
  updated_at: string | null;
  nominated_user_id?: string | null;
  feedback_questions: FeedbackQuestion;
  feedback_recipients: FeedbackRecipient;
  feedback_sessions: FeedbackSession;
  nominated_user?: FeedbackUserIdentity;
  is_flagged?: boolean | null;
  flagged_by?: string | null;
  flagged_at?: string | null;
}

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  job_title?: string | null;
  role?: string;
  company_id?: string;
  status?: string;
  created_at: string;
  updated_at?: string | null;
  avatar_url?: string | null;
  additional_data?: Record<string, unknown>;
}

interface CompanyInfo {
  id: string;
  name: string;
  industry?: string;
  created_at: string;
  updated_at: string;
  domains?: string[];
}

interface RpcResponse {
  user_profile: UserProfile;
  manager_profile?: UserProfile;
  company_info: CompanyInfo;
  feedback_data: FeedbackResponse[];
  metadata: {
    is_invited_user: boolean;
    query_executed_at: string;
    start_date_filter?: string;
    feedback_count: number;
  };
}

interface FeedbackListProps {
  userId?: string;     // For employee viewing their own feedback
  employeeId?: string; // For filtering in manager view (specific employee)
  managerId?: string;  // For manager viewing all their direct reports
  includeValues?: boolean; // Whether to include value nominations
  startDate?: Date;    // Optional date filter
  isInvitedUser?: boolean; // Whether the target user is an invited user
}

export default function FeedbackList({ 
  userId, 
  employeeId, 
  managerId, 
  includeValues = true,
  startDate,
  isInvitedUser = false
}: FeedbackListProps) {
  const [allFeedback, setAllFeedback] = useState<FeedbackResponse[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [managerProfile, setManagerProfile] = useState<UserProfile | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  console.log('feedback for:', userProfile?.id, 'manager: ', managerProfile?.id, 'company: ', companyInfo?.id);

  // Fetch feedback using RPC
  useEffect(() => {
    const fetchFeedback = async () => {
      setLoading(true);
      
      try {
        // Handle different scenarios:
        // 1. Employee viewing their own feedback (userId provided)
        // 2. Manager viewing a specific employee's feedback (employeeId provided)  
        // 3. Manager viewing all direct reports' feedback (managerId provided)
        
        if (userId || employeeId) {
          // CASE 1 & 2: Get feedback for a specific user
          const targetId = userId || employeeId;
          
          const { data, error } = await supabase.rpc('get_user_feedback_summary', {
            target_user_id: targetId,
            manager_user_id: managerId || null,
            start_date: startDate?.toISOString() || null,
            is_invited_user: isInvitedUser
          });
          
          if (error) throw error;
          
          const response = data as RpcResponse;
          
          // Set all the data from RPC response
          setUserProfile(response.user_profile);
          setManagerProfile(response.manager_profile || null);
          setCompanyInfo(response.company_info);
          
          // Filter feedback based on includeValues flag
          const filteredFeedback = includeValues 
            ? response.feedback_data 
            : response.feedback_data.filter(item => 
                !['values'].includes(item.feedback_questions.question_type)
              );
          
          setAllFeedback(filteredFeedback);
          
        } else if (managerId) {
          // CASE 3: Manager viewing all their direct reports' feedback
          // First get IDs of all direct reports from org_structure
          const { data: directReports, error: directReportsError } = await supabase
            .from('org_structure')
            .select('id')
            .eq('manager_id', managerId);
          
          if (directReportsError) throw directReportsError;
          
          if (!directReports || directReports.length === 0) {
            setAllFeedback([]);
            setLoading(false);
            return;
          }
          
          // Get feedback for each direct report using RPC and combine
          const allTeamFeedback: FeedbackResponse[] = [];
          
          for (const directReport of directReports) {
            const { data, error } = await supabase.rpc('get_user_feedback_summary', {
              target_user_id: directReport.id,
              manager_user_id: managerId,
              start_date: startDate?.toISOString() || null,
              is_invited_user: false // Direct reports are typically not invited users
            });
            
            if (error) {
              console.error(`Error fetching feedback for user ${directReport.id}:`, error);
              continue;
            }
            
            const response = data as RpcResponse;
            
            // Filter feedback based on includeValues flag
            const filteredFeedback = includeValues 
              ? response.feedback_data 
              : response.feedback_data.filter(item => 
                  !['values'].includes(item.feedback_questions.question_type)
                );
            
            allTeamFeedback.push(...filteredFeedback);
          }
          
          // Sort all feedback by created_at descending
          allTeamFeedback.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          
          setAllFeedback(allTeamFeedback);
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
  }, [userId, employeeId, managerId, includeValues, startDate, isInvitedUser]);
  
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
      setAllFeedback(prev => 
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
  
  if (allFeedback.length === 0) {
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
      {allFeedback.map(item => {
        // Extract icon from company_values if it exists
        const icon = item.feedback_questions?.company_values?.icon || null;
        
        // Create a copy of feedback_questions with the icon properly structured
        const questionsWithIcon = {
          ...item.feedback_questions,
          icon: icon // Add icon directly to the question object for FeedbackCard
        };
          
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