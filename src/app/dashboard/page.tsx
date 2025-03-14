// src/app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth, useIsAdmin } from '@/lib/context/auth-context';
import Link from 'next/link';
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// import { UserCog, Flag, Users } from 'lucide-react';
import FeedbackList from '@/components/FeedbackList';
import { LoadingSpinner } from '@/components/loading-spinner';
import supabase from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import { faStarHalfStroke, faStar } from '@fortawesome/free-solid-svg-icons';
import { faComments } from '@fortawesome/free-regular-svg-icons';

export default function DashboardPage() {
  const { user, memberStatus } = useAuth();
  const fullName = user?.user_metadata?.name || '';
  const firstName = fullName.split(' ')[0] || '';
  const router = useRouter();
  const { isAdmin } = useIsAdmin();
  const [isManager, setIsManager] = useState(false);
  const [activeFeedbackCycle, setActiveFeedbackCycle] = useState<{ id: string; name: string } | null>(null);
  const [hasActiveSessions, setHasActiveSessions] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  
  // Check if the user is a manager (has direct reports)
  useEffect(() => {
    const checkIsManager = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Check if user has any direct reports in org_structure
        const { data, error } = await supabase
          .from('org_structure')
          .select('id')
          .eq('manager_id', user.id)
          .limit(1);
          
        if (error) throw error;
        
        // If we found any direct reports, the user is a manager
        setIsManager(data && data.length > 0);

        // Get user's company
        const { data: userData, error: userError } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('id', user.id)
          .single();
          
        if (userError) throw userError;

        // Get active feedback cycle
        const { data: cycleData, error: cycleError } = await supabase
          .from('feedback_cycles')
          .select('id, cycle_name')
          .eq('company_id', userData.company_id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (!cycleError && cycleData) {
          setActiveFeedbackCycle({ id: cycleData.id, name: cycleData.cycle_name });
          
          // Check for active sessions
          const { data: sessionsData, error: sessionsError } = await supabase
            .from('feedback_sessions')
            .select('id, status')
            .eq('cycle_id', cycleData.id)
            .eq('provider_id', user.id);
            
          if (!sessionsError && sessionsData && sessionsData.length > 0) {
            // get token
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const response = await fetch(`/api/feedback/check?sessionid=${sessionsData[0].id}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            const takenData = await response.json();
            console.log(takenData);


            setHasActiveSessions(true);
            
            // Count completed sessions
            const completed = sessionsData.filter(s => s.status === 'completed').length;
            setCompletedCount(completed);
            console.log(completedCount);
            
            // Count pending sessions
            const pending = sessionsData.filter(s => s.status !== 'completed').length;
            setPendingCount(pending);
          }
        }
      } catch (error) {
        console.error('Error checking manager status:', error);
        setIsManager(false);
      } finally {
        setLoading(false);
      }
    };
    
    checkIsManager();
  }, [user, completedCount]);

  const handleStartFeedback = async () => {
    if (!activeFeedbackCycle) {
      toast({
        title: 'No active feedback cycle',
        description: 'There is no active feedback cycle at this time.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Create a new feedback session
      const { data: sessionsData, error } = await supabase
        .from('feedback_sessions')
        .insert({
          cycle_id: activeFeedbackCycle.id,
          provider_id: user!.id,
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();
        
      if (error) throw error;

      // get token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`/api/feedback/check?sessionid=${sessionsData.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const takenData = await response.json();
      console.log(takenData);
      
      // Navigate to select recipients
      console.log(`Sending user to start feedback, session id:`, sessionsData);
      router.push(`/feedback/select-recipients?session=${sessionsData.id}`);
    } catch (error) {
      console.error('Error starting feedback:', error);
      toast({
        title: 'Error starting feedback',
        description: 'Could not start feedback session. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  const handleContinueFeedback = async () => {
    if (!activeFeedbackCycle) return;
    
    try {
      // Find in-progress session
      const { data, error } = await supabase
        .from('feedback_sessions')
        .select('id')
        .eq('cycle_id', activeFeedbackCycle.id)
        .eq('provider_id', user!.id)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (error) throw error;
      
      // Navigate to select recipients
      console.log(`Sending user to continue feedback: session id:`, data);
      router.push(`/feedback/select-recipients?session=${data.id}`);
    } catch (error) {
      console.error('Error continuing feedback:', error);
      toast({
        title: 'Error retrieving session',
        description: 'Could not find your feedback session. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Show loading state while checking permissions
  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
          <p className="ml-2">Loading your dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <>
      {memberStatus === 'pending' && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-md text-sm text-center">
          <p className="text-amber-700">
            <strong>Account Pending Approval.</strong> Your account is waiting for admin approval. Some features may be limited until your account is approved.
          </p>
        </div>
      )}
      <div className="container mx-auto py-8 px-4">
        {!activeFeedbackCycle ? (
          <></>
        ) : hasActiveSessions && pendingCount > 0 ? (
          <>
          <div className='bg-cerulean-400 p-4 rounded-md gap-4 shadow-md mb-12'>
            <div className='flex items-center gap-4 mb-2 text-white'>
              <FontAwesomeIcon 
                icon={faComments} 
                className="h-8 w-8"
              />
              <h4 className='text-lg font-light'>
              Hey {firstName}, your colleagues are waiting on your feedback!
              </h4>
            </div>
            <p className='text-cerulean-100 text-base font-light mb-4'>
            Feedback is a great way to acknowledge and help a colleague identify their strengths and areas for improvement.
            </p>
            <Button onClick={handleContinueFeedback}>Continue your Feedback</Button>
          </div>
          </>
        ) : !hasActiveSessions ? (
          <>
          <div className='bg-cerulean-400 p-4 rounded-md gap-4 shadow-md mb-12'>
            <div className='flex items-center gap-4 mb-2 text-white'>
              <FontAwesomeIcon 
                icon={faComments} 
                className="h-8 w-8"
              />
              <h4 className='text-lg font-light'>
              Hey {firstName}, your colleagues are waiting on your feedback!
              </h4>
            </div>
            <p className='text-cerulean-100 text-base font-light mb-4'>
              Feedback is a great way to acknowledge and help a colleague identify their strengths and areas for improvement.
            </p>
            <Button onClick={handleStartFeedback} variant="outline">Let&#39;s get started!</Button>
          </div>
          </>
        ) : (
          <></>
        )}

        <div className="flex justify-between items-center mb-6">
          <h2 className='text-4xl font-light text-berkeleyblue'>Your Feedback</h2>
          {/* Show team feedback button to managers or admins */}
          {(isManager || isAdmin) && (
            <Button 
              variant="outline" 
              size="sm" 
              asChild
            >
              <Link href="/dashboard/manager/feedback">
                View Your Team&#39;s Feedback
              </Link>
            </Button>
          )}
        </div>
        <FeedbackList userId={user?.id} />
      </div>
    </>
  );
}