// src/app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth, useIsAdmin } from '@/lib/context/auth-context';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import FeedbackList from '@/components/FeedbackList';
import { LoadingSpinner } from '@/components/loading-spinner';
import { ProfileModal } from '@/components/ProfileModal';
import supabase from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { MessagesSquare, X, ChevronDown, Sparkles, NotepadText, NotebookPen } from 'lucide-react'; // Added ChevronDown
import Markdown from 'react-markdown';
import { radley } from '../fonts';

export default function DashboardPage() {
  const { user, memberStatus } = useAuth();
  const fullName = user?.user_metadata?.name || '';
  const firstName = fullName.split(' ')[0] || '';
  const router = useRouter();
  const { isAdmin } = useIsAdmin();
  const [isManager, setIsManager] = useState(false);
  const [activeCycle, setActiveCycle] = useState<{ id: string; name: string } | null>(null);
  const [activeOccurrence, setActiveOccurrence] = useState<{ 
    id: string; 
    start_date: string; 
    end_date: string;
    cycle_id: string;
  } | null>(null);
  const [needsFeedback, setNeedsFeedback] = useState(false);
  const [feedbackStarted, setFeedbackStarted] = useState(false);
  const [inProgressSession, setInProgressSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isButtonLoading, setIsButtonLoading] = useState(false);
  
  // State for pending navigation
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [cookieIsSet, setCookieIsSet] = useState(false);

  // State for user profile data
  const [userProfile, setUserProfile] = useState<{
    name: string;
    email: string;
    job_title?: string;
  } | null>(null);
  
  // State for profile modal
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // State for feedback coach drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // State for feedback summarization
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [feedbackSummary, setFeedbackSummary] = useState<string | null>(null);
  const [summaryTimeframe, setSummaryTimeframe] = useState<string | null>(null);

  async function handleAdminPending() {
    if (isAdmin && memberStatus === 'pending' && user) {
      console.log('***User is admin and pending');
      try {
        const { error } = await supabase.rpc('approve_team_member', {
          member_id: user.id
        });
        if (error) {
          console.error('Error approving team member:', error);
          return false;
        }
      } catch (error) {
        console.error('Error updating user status:', error);
        return false;
      }
    }
    return false;
  }

  // Effect to handle cookie setting and navigation
  useEffect(() => {
    if (pendingNavigation && cookieIsSet) {
      // Navigate now that the cookie is set
      router.push(pendingNavigation);
      // Reset state
      setPendingNavigation(null);
      setCookieIsSet(false);
    }
  }, [pendingNavigation, cookieIsSet, router]);

  // Effect to fetch user profile and check for job title
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('name, email, job_title')
          .eq('id', user.id)
          .single();
          
        if (error) throw error;
        
        setUserProfile(data);
        
        // If user doesn't have a job title, show the profile modal
        if (!data.job_title) {
          setIsProfileModalOpen(true);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    
    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    const checkFeedbackStatus = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Check if user has any direct reports in org_structure
        const { data: reportsData, error: reportsError } = await supabase
          .from('org_structure')
          .select('id')
          .eq('manager_id', user.id)
          .limit(1);
          
        if (reportsError) throw reportsError;
        
        // If we found any direct reports, the user is a manager
        setIsManager(reportsData && reportsData.length > 0);

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
          
        if (cycleError) {
          console.log('No active feedback cycle found');
          setLoading(false);
          return;
        }
        
        // Store active cycle
        setActiveCycle({ id: cycleData.id, name: cycleData.cycle_name });
        
        // Get active occurrence for this cycle
        const { data: occurrenceData, error: occurrenceError } = await supabase
          .from('feedback_cycle_occurrences')
          .select('id, cycle_id, start_date, end_date')
          .eq('cycle_id', cycleData.id)
          .eq('status', 'active')
          .single();
          
        if (occurrenceError) {
          console.log('No active occurrence found');
          setLoading(false);
          return;
        }
        
        // Store active occurrence
        setActiveOccurrence(occurrenceData);
        
        // Check if today is between start_date and end_date
        const today = new Date();
        const startDate = new Date(occurrenceData.start_date);
        const endDate = new Date(occurrenceData.end_date);
        
        if (today < startDate || today > endDate) {
          // Today is outside the valid date range
          setNeedsFeedback(false);
          setLoading(false);
          return;
        }

        // Check if user has already provided feedback for this occurrence
        const { data: sessionData, error: sessionError } = await supabase
          .from('feedback_sessions')
          .select('id, status')
          .eq('cycle_id', cycleData.id)
          .eq('occurrence_id', occurrenceData.id)
          .eq('provider_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (sessionError || !sessionData || sessionData.length === 0) {
          // No session found, user needs to provide feedback
          setNeedsFeedback(true);
          setInProgressSession(null);
        } else {
          const session = sessionData[0];
          if (session.status === 'completed') {
            // User has already completed feedback for this occurrence
            setNeedsFeedback(false);
          } else if (session.status === 'in_progress') {
            // User has an in-progress session
            setNeedsFeedback(true);
            setInProgressSession(session.id);
            setFeedbackStarted(true);
          } else {
            setNeedsFeedback(true);
            setInProgressSession(session.id);
            setFeedbackStarted(false);
          }
        }
      } catch (error) {
        console.error('Error checking feedback status:', error);
      } finally {
        setLoading(false);
      }
    };
    checkFeedbackStatus();
  }, [user]);

  // Helper function to set the feedback auth cookie
  const ensureFeedbackAuth = async (sessionId: string) => {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Call the check endpoint to set the feedback_auth cookie
      const response = await fetch(`/api/feedback/check?sessionid=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to set feedback auth');
      }
      
      // Signal that cookie is set
      setCookieIsSet(true);
      return true;
    } catch (error) {
      console.error('Error setting feedback auth:', error);
      return false;
    }
  };

  const handleStartFeedback = async () => {
    if (!activeCycle || !activeOccurrence) {
      toast({
        title: 'No active feedback cycle',
        description: 'There is no active feedback cycle at this time.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsButtonLoading(true);
      
      // Create a new feedback session
      const { data: sessionData, error } = await supabase
        .from('feedback_sessions')
        .insert({
          cycle_id: activeCycle.id,
          occurrence_id: activeOccurrence.id,
          provider_id: user!.id,
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();
        
      if (error) throw error;
      
      // Set navigation target
      const targetUrl = `/feedback/select-recipients?session=${sessionData.id}`;
      setPendingNavigation(targetUrl);
      
      // Ensure the feedback auth cookie is set
      // This will trigger the useEffect to navigate after cookie is set
      await ensureFeedbackAuth(sessionData.id);
    } catch (error) {
      console.error('Error starting feedback:', error);
      toast({
        title: 'Error starting feedback',
        description: 'Could not start feedback session. Please try again.',
        variant: 'destructive',
      });
      setIsButtonLoading(false);
    }
  };
  
  const handleContinueFeedback = async () => {
    try {
      setIsButtonLoading(true);
      
      if (!inProgressSession) {
        return handleStartFeedback();
      }
      
      // Set navigation target
      const targetUrl = `/feedback/select-recipients?session=${inProgressSession}`;
      setPendingNavigation(targetUrl);
      
      // Ensure the feedback auth cookie is set
      // This will trigger the useEffect to navigate after cookie is set
      await ensureFeedbackAuth(inProgressSession);
    } catch (error) {
      console.error('Error continuing feedback:', error);
      toast({
        title: 'Error retrieving session',
        description: 'Could not find your feedback session. Please try again.',
        variant: 'destructive',
      });
      setIsButtonLoading(false);
    }
  };

  const handleProfileUpdate = () => {
    // Refresh user profile data after update
    if (user) {
      supabase
        .from('user_profiles')
        .select('name, email, job_title')
        .eq('id', user.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setUserProfile(data);
          }
        });
    }
  };

  // Function to handle feedback summarization
  // Function to handle feedback summarization
const handleSummarizeFeedback = async (timeframe: string) => {
  if (!user) return;
  
  try {
    setIsSummarizing(true);
    setSummaryTimeframe(timeframe);
    setFeedbackSummary(null);
    
    // Calculate date range based on timeframe
    const today = new Date();
    let startDate = new Date();
    
    if (timeframe === 'week') {
      // Last week's feedback
      startDate.setDate(today.getDate() - 7);
    } else if (timeframe === 'month') {
      // Last month's feedback
      startDate.setMonth(today.getMonth() - 1);
    } else {
      // All feedback - use a very old date
      startDate = new Date(2000, 0, 1);
    }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    // Call API to summarize feedback
    const response = await fetch('/api/feedback/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: user.id,
        timeframe
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to summarize feedback');
    }
    
    const data = await response.json();
    setFeedbackSummary(data.summary);
  } catch (error) {
    console.error('Error summarizing feedback:', error);
    toast({
      title: 'Error summarizing feedback',
      description: 'Could not summarize your feedback. Please try again later.',
      variant: 'destructive',
    });
    setFeedbackSummary('An error occurred while summarizing your feedback.');
  } finally {
    setIsSummarizing(false);
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
      {/* Profile Modal */}
      {userProfile && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            handleAdminPending();
            handleProfileUpdate();
          }}
          defaultValues={userProfile}
        />
      )}
      
      {isAdmin && !activeCycle && (
        <div className='container mx-auto py-8 px-4'>
          <div className="mb-6 p-4 bg-cerulean-200 border border-cerulean-500 rounded-md text-sm text-center">
          <p className="text-cerulean-700">
            You&#39;re a company admin &mdash; manage your company settings and feedback cycles in your <Link className='text-cerulean-800 underline underline-offset-4 hover:text-cerulean-900' href='/dashboard/admin/'>Admin Dashboard</Link>
          </p>
          </div>
        </div>
      )}
      {memberStatus === 'pending' && !isAdmin && (
        <div className='container mx-auto py-8 px-4'>
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-md text-sm text-center">
          <p className="text-amber-700">
            <strong>Account Pending Approval.</strong> Your account is waiting for admin approval. Some features may be limited until your account is approved.
          </p>
          </div>
        </div>
      )}
      <div className="container mx-auto py-8 px-4">
        {needsFeedback && (
          <div className='bg-cerulean-400 p-4 rounded-md gap-4 shadow-md mb-12'>
            <div className='flex items-center gap-4 mb-2 text-white'>
              <MessagesSquare className="h-8 w-8" />
              <h4 className='text-lg font-light'>
              {feedbackStarted ? (
                <>
                Hey {firstName}, finish your feedback!
                </>
              ) : (
                <>
                Hey {firstName}, your colleagues are waiting on your feedback!
                </>
              )}
              </h4>
            </div>
            <p className='text-cerulean-100 text-base font-light mb-4'>
              Feedback is a great way to acknowledge and help a colleague identify their strengths and areas for improvement.
            </p>
            {feedbackStarted ? (
              <Button 
              onClick={inProgressSession ? handleContinueFeedback : handleStartFeedback} 
              variant={inProgressSession ? "default" : "outline"}
              disabled={isButtonLoading}
            >
              {isButtonLoading ? (
                <>
                  Loading...
                </>
              ) 
              : "Continue your Feedback"
              }
            </Button>
            ) : (
              <>
              <Button 
              onClick={inProgressSession ? handleContinueFeedback : handleStartFeedback} 
              variant={inProgressSession ? "default" : "outline"}
              disabled={isButtonLoading}
            >
              {isButtonLoading ? (
                <>
                  Loading...
                </>
              ) 
              : "Get Started"
              }
            </Button>
              </>
            )
          }
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h2 className='text-4xl font-light text-berkeleyblue'>Your Feedback</h2>
          <div className="flex gap-2">
            
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
            
            {/* Feedback Coach button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            >
              Feedback Coach
            </Button>
          </div>
        </div>
        <FeedbackList userId={user?.id} />
        
        {/* Feedback Coach Drawer */}
        <div 
          className={`fixed inset-y-0 right-0 w-1/3 bg-white shadow-lg transform transition-transform ${
            isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          } ease-in-out duration-300 z-50 overflow-y-auto`}
        >
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-medium text-berkeleyblue">Feedback Coach</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsDrawerOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Welcome content */}
            {!feedbackSummary && !isSummarizing && (
              <>
              <div className="mb-8">
                <h4 className="text-lg font-medium text-gray-800 mb-3">Welcome to your Feedback Coach</h4>
                <p className="text-gray-600 mb-4">
                  Your Feedback Coach helps you get the most out of the feedback you receive. 
                  Use these tools to understand patterns, identify growth opportunities, and track your progress over time.
                </p>
                <p className="text-gray-600 mb-4">
                  Regular reflection on feedback is key to professional growth. Your coach is here to help you gain insights 
                  and develop actionable strategies for improvement.
                </p>
              </div>
              <div className='mb-8'>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex flex-col py-3 h-auto">
                        <Sparkles className="h-6 w-6 mx-auto" />
                        Summarize Feedback
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className='w-full'>
                      <DropdownMenuItem onClick={() => handleSummarizeFeedback('week')} className='w-full'>
                        Last Week's Feedback
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSummarizeFeedback('month')} className='w-full'>
                        Last Month's Feedback
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSummarizeFeedback('all')} className='w-full'>
                        All Feedback
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button 
                    variant="outline"
                    className="flex flex-col py-3 h-auto"
                  >
                    <p className='text-center items-center'>
                      <NotepadText className="h-6 w-6 mb-2 mx-auto" />
                      Prep for 1:1
                    </p>
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex flex-col py-3 h-auto"
                  >
                    <p className='text-center items-center'>
                      <NotebookPen className="h-6 w-6 mb-2 mx-auto" />
                      Prep for Self Eval
                    </p>
                  </Button>
                </div>
              </div>
              </>
            )}
            
            {/* Feedback summarization section */}
            <div className="mb-8">
              
              {/* Feedback summary results */}
              {isSummarizing && (
                <div className="bg-gray-50 p-4 rounded-md mb-4">
                  <div className="items-center">
                    <p className="ml-2 text-gray-600 text-center animate-pulse">Analyzing your feedback...</p>
                  </div>
                </div>
              )}
              
              {feedbackSummary && !isSummarizing && (
                <>
                {/* Dropdown for feedback summarization */}
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between mb-4">
                    Summarize Again
                    <ChevronDown className="" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className='w-full'>
                  <DropdownMenuItem onClick={() => handleSummarizeFeedback('week')} className='w-full'>
                    Last Week's Feedback
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSummarizeFeedback('month')} className='w-full'>
                    Last Month's Feedback
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSummarizeFeedback('all')} className='w-full'>
                    All Feedback
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

                <div className="bg-gray-50 p-4 rounded-md mb-4">
                  {/* <h5 className="font-medium text-gray-800 mb-2">
                    {summaryTimeframe === 'week' && 'Last Week\'s Feedback Summary'}
                    {summaryTimeframe === 'month' && 'Last Month\'s Feedback Summary'}
                    {summaryTimeframe === 'all' && 'Overall Feedback Summary'}
                  </h5> */}
                  <div className="text-gray-600">
                    <Markdown 
                      components={{
                        pre: ({children}) => <pre className={`text-2xl font-medium text-cerulean mb-3 ${radley.className}`}>{children}</pre>,
                        code: ({children}) => <code className={`text-2xl font-medium text-cerulean mb-3 ${radley.className}`}>{children}</code>,
                        h3: ({children}) => <h3 className="text-xl font-medium text-gray-800 mt-6 mb-3">{children}</h3>,
                        h4: ({children}) => <h4 className="text-lg font-medium text-gray-800 mt-5 mb-2">{children}</h4>,
                        p: ({children}) => <p className="mb-4">{children}</p>,
                        strong: ({children}) => <strong className="font-bold">{children}</strong>,
                        ol: ({children}) => <ol className="list-decimal pl-6 mb-4">{children}</ol>,
                        ul: ({children}) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
                        li: ({children}) => <li className="mb-1">{children}</li>,
                      }}
                    >
                      {feedbackSummary}
                    </Markdown>
                  </div>
                </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}