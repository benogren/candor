// src/app/dashboard/manager/feedback/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/loading-spinner';
import FeedbackList from '@/components/FeedbackList';
import supabase from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { redirect } from "next/navigation";
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MessagesSquare, X, ChevronDown, Sparkles, NotepadText, Gauge, NotebookPen, PieChart } from 'lucide-react'; // Added ChevronDown
import Markdown from 'react-markdown';
import { radley } from '../../../fonts';
import Link from 'next/link';

interface DirectReport {
  id: string;
  name?: string;
  email: string;
  is_invited: boolean;
}

export default function ManagerFeedbackPage() {
  const { user } = useAuth();
  const [directReports, setDirectReports] = useState<DirectReport[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);

  // State for feedback coach drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // State for feedback summarization
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [feedbackSummary, setFeedbackSummary] = useState<string | null>(null);
  const [summaryTimeframe, setSummaryTimeframe] = useState<string | null>(null);
  
  const handleCoachingPlan = async (timeframe: string, empId: string) => {
    console.log('Generating coaching plan for:', empId, 'Timeframe:', timeframe);
  
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

      console.log('UserId:', empId);
      console.log('Timeframe:', timeframe);
      
      // Call API to summarize feedback
      const response = await fetch('/api/feedback/manager/coaching', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          empId: empId,
          timeframe,
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
  }
  
  // Fetch direct reports
  useEffect(() => {
    const fetchDirectReports = async () => {
      if (!user) return;
      
      setLoading(true);
      
      try {
        // First check if this user is a manager of anyone
        const { data: directReportsData, error: directReportsError } = await supabase
          .from('org_structure')
          .select(`
            id,
            email,
            is_invited
          `)
          .eq('manager_id', user.id);
        
        if (directReportsError) {
          throw directReportsError;
        }
        
        // If we have direct reports, fetch their profile info for those who aren't invited
        if (directReportsData && directReportsData.length > 0) {
          setIsManager(true);
          
          // Create a map to efficiently find and update the direct report info
          const reportsMap = new Map(
            directReportsData.map(report => [report.id, { 
              ...report,
              // For invited users, we'll display the email as name if needed
              name: report.is_invited ? report.email.split('@')[0] : undefined
            }])
          );
          
          // Get the IDs of non-invited users to fetch their profiles
          const nonInvitedUserIds = directReportsData
            .filter(report => !report.is_invited)
            .map(report => report.id);
          
          if (nonInvitedUserIds.length > 0) {
            // Fetch profile data for non-invited users
            const { data: profilesData, error: profilesError } = await supabase
              .from('user_profiles')
              .select('id, name, email')
              .in('id', nonInvitedUserIds);
            
            if (profilesError) {
              console.error('Error fetching profiles:', profilesError);
            } else if (profilesData) {
              // Update the map with profile data
              profilesData.forEach(profile => {
                const report = reportsMap.get(profile.id);
                if (report) {
                  report.name = profile.name || report.name || profile.email.split('@')[0];
                }
              });
            }
          }
          
          // Convert map back to array
          setDirectReports(Array.from(reportsMap.values()));
        } else {
          setIsManager(false);
          setDirectReports([]);
        }
      } catch (error) {
        console.error('Error fetching direct reports:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your team members',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchDirectReports();
  }, [user]);
  
  // Show loading state
  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
          <p className="ml-2">Loading team data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
        {!isManager ? (
            redirect('/dashboard')
        ) : (
            <>
            <div className="flex justify-between items-center mb-6">
            <h2 className='text-4xl font-light text-berkeleyblue'>My Team&#39;s Feedback</h2>
            <div className='flex items-center gap-2'>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="default">
                    All Team Members
                    <ChevronDown className="h-5 w-5 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className='w-full'>
                {directReports.map(employee => (
                  <DropdownMenuItem className='w-full' key={employee.id}>
                    <Link key={employee.id} href={`/dashboard/manager/feedback/${employee.id}`}>
                      {employee.name || employee.email.split('@')[0]}
                      {employee.is_invited && " (Invited)"}
                      </Link>
                      </DropdownMenuItem>
                    
                  ))}

                </DropdownMenuContent>
              </DropdownMenu>
                </div>
                
            </div>
            <div>
                <h3 className='text-2xl font-light text-berkeleyblue mb-4'>
                    Feedback for: <strong className='font-medium'>
                    {selectedEmployee
                    ? `${directReports.find(e => e.id === selectedEmployee)?.name || 'All Team Members'}`
                    : 'All Team Feedback'}
                    </strong>
                </h3>
                <FeedbackList 
                  employeeId={selectedEmployee !== 'all' ? selectedEmployee : undefined} 
                  managerId={selectedEmployee === 'all' ? user?.id : undefined} 
                />

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
                  {/* {selectedEmployee} */}
                  Your Feedback Coach helps you get the most out of the feedback you receive. 
                  Use these tools to understand patterns, identify growth opportunities, and track your progress over time.
                </p>
              </div>
              <div className='mb-8'>
                <h4 className="text-lg font-medium text-gray-800">Coaching for {directReports.find(e => e.id === selectedEmployee)?.name || 'All Team Members'}:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                  <Button 
                    variant="outline"
                    className="flex flex-col py-3 h-auto"
                  >
                    <p className='text-center items-center'>
                      <Sparkles className="h-6 w-6 mb-2 mx-auto" />
                      Summarize Feedback
                    </p>
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex flex-col py-3 h-auto"
                  >
                    <p className='text-center items-center'>
                      <NotepadText className="h-6 w-6 mb-2 mx-auto" />
                      Prep for 1:1
                    </p>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex flex-col py-3 h-auto">
                        <Gauge className="h-6 w-6 mx-auto" />
                        Coaching Plan
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className='w-full'>
                      <DropdownMenuItem onClick={() => handleCoachingPlan('week', selectedEmployee)} className='w-full'>
                        Last Week's Feedback
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCoachingPlan('month', selectedEmployee)} className='w-full'>
                        Last Month's Feedback
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCoachingPlan('all', selectedEmployee)} className='w-full'>
                        All Feedback
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button 
                    variant="outline"
                    className="flex flex-col py-3 h-auto"
                  >
                    <p className='text-center items-center'>
                      <NotebookPen className="h-6 w-6 mb-2 mx-auto" />
                      Prep for Review
                    </p>
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex flex-col py-3 h-auto"
                  >
                    <p className='text-center items-center'>
                      <PieChart className="h-6 w-6 mb-2 mx-auto" />
                      Skills Assessment
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
                {/* <DropdownMenu>
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
              </DropdownMenu> */}

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
        )}
      
    </div>
  );
}