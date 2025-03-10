// src/app/dashboard/feedback/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Users, MessageSquare, CheckCircle } from 'lucide-react';
import supabase from '@/lib/supabase/client';
import { useAuth } from '@/lib/context/auth-context';

export default function FeedbackDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [hasActiveSessions, setHasActiveSessions] = useState(false);
  const [activeFeedbackCycle, setActiveFeedbackCycle] = useState<{ id: string; name: string } | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  
  useEffect(() => {
    async function loadFeedbackData() {
      if (!user) return;
      
      try {
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
            setHasActiveSessions(true);
            
            // Count completed sessions
            const completed = sessionsData.filter(s => s.status === 'completed').length;
            setCompletedCount(completed);
            
            // Count pending sessions
            const pending = sessionsData.filter(s => s.status !== 'completed').length;
            setPendingCount(pending);
          }
        }
      } catch (error) {
        console.error('Error loading feedback data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadFeedbackData();
  }, [user]);
  
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
      const { data: session, error } = await supabase
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
      
      // Navigate to select recipients
      router.push(`/feedback/select-recipients?session=${session.id}`);
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
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-cerulean" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Feedback Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Active Cycle</CardTitle>
            <Users className="h-5 w-5 text-slate-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {activeFeedbackCycle ? activeFeedbackCycle.name || 'Unnamed Cycle' : 'None'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Completed</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{completedCount}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Pending</CardTitle>
            <MessageSquare className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Provide Feedback</CardTitle>
          <CardDescription>
            Share your thoughts about your colleagues to help them grow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!activeFeedbackCycle ? (
            <div className="text-center py-6">
              <MessageSquare className="h-10 w-10 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No active feedback cycle</p>
              <p className="text-gray-400 text-sm mt-1">
                There is no active feedback cycle at this time.
              </p>
            </div>
          ) : hasActiveSessions ? (
            <div className="text-center py-6">
              <MessageSquare className="h-10 w-10 mx-auto text-cerulean mb-4" />
              <p className="text-slate-700 mb-2">You have an active feedback session</p>
              {pendingCount > 0 ? (
                <p className="text-slate-500 text-sm">
                  You have {pendingCount} pending feedback {pendingCount === 1 ? 'session' : 'sessions'} to complete.
                </p>
              ) : (
                <p className="text-green-600 text-sm">
                  You have completed all your feedback for this cycle!
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <MessageSquare className="h-10 w-10 mx-auto text-cerulean mb-4" />
              <p className="text-slate-700 mb-2">Ready to provide feedback</p>
              <p className="text-slate-500 text-sm">
                Share your thoughts about your colleagues to help them grow.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          {!activeFeedbackCycle ? (
            <Button disabled>No Active Feedback Cycle</Button>
          ) : hasActiveSessions && pendingCount > 0 ? (
            <Button onClick={handleContinueFeedback}>Continue Feedback</Button>
          ) : !hasActiveSessions ? (
            <Button onClick={handleStartFeedback}>Start Feedback</Button>
          ) : (
            <Button disabled>Feedback Completed</Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}