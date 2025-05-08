'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { LoadingSpinner } from '@/components/loading-spinner';
import FeedbackList from '@/components/FeedbackList';
import supabase from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useRouter } from "next/navigation";
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { X, Sparkles, NotepadText, Gauge, NotebookPen, PieChart, ArrowLeft } from 'lucide-react';
import Markdown from 'react-markdown';
import { radley } from '@/app/fonts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Avatar } from '@radix-ui/react-avatar';
import { AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmployeeProfile {
  id: string;
  name?: string;
  email: string;
  is_invited: boolean;
}

// Type for feedback summary
type FeedbackSummary = {
  id: string;
  timeframe: string;
  summary: string;
  created_at: string;
  type: string;
};

export default function EmployeeFeedbackPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const employeeId = params.employeeid as string;
  
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // State for feedback summaries
  const [summaries, setSummaries] = useState<FeedbackSummary[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [feedbackSummary, setFeedbackSummary] = useState<string | null>(null);
  const [summaryTimeframe, setSummaryTimeframe] = useState<string | null>(null);
  
  // State for 1:1 preps
  const [preps, setPreps] = useState<FeedbackSummary[]>([]);
  const [isGeneratingPrep, setIsGeneratingPrep] = useState(false);
  const [prepContent, setPrepContent] = useState<string | null>(null);
  
  // Shared modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FeedbackSummary | null>(null);
  const [activeContentType, setActiveContentType] = useState<'summary' | 'prep'>('summary');
  
  // Fetch employee profile and verify manager permissions
  useEffect(() => {
    const verifyAccess = async () => {
      if (!user || !employeeId) {
        return;
      }
      
      try {
        setLoading(true);
        
        // Check if this user is authorized to view this employee's feedback
        const { data: orgData, error: orgError } = await supabase
          .from('org_structure')
          .select('*')
          .eq('id', employeeId);
        
        if (orgError) {
          throw orgError;
        }
        
        // Check if the current user is the manager
        if (orgData && orgData.length > 0 && orgData[0].manager_id === user.id) {
          // User is authorized to view this employee's feedback
          setIsAuthorized(true);
          
          // Set employee profile
          const empData = orgData[0];
          let empProfile: EmployeeProfile = {
            id: empData.id,
            email: empData.email,
            is_invited: empData.is_invited,
            name: empData.is_invited ? empData.email.split('@')[0] : undefined
          };
          
          // If not invited, fetch profile data
          if (!empData.is_invited) {
            const { data: profileData, error: profileError } = await supabase
              .from('user_profiles')
              .select('name, email')
              .eq('id', employeeId);
            
            if (!profileError && profileData && profileData.length > 0) {
              empProfile.name = profileData[0].name || profileData[0].email.split('@')[0];
            }
          }
          
          setEmployeeProfile(empProfile);
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        console.error('Error verifying access:', error);
        toast({
          title: 'Error',
          description: 'Failed to verify your access to this data',
          variant: 'destructive',
        });
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      verifyAccess();
    } else {
      setLoading(false);
    }
  }, [user, employeeId]);
  
  // Fetch summaries and preps when user is authorized
  useEffect(() => {
    if (isAuthorized && user && employeeId) {
      fetchSummaries();
      fetchPreps();
    }
  }, [isAuthorized, user, employeeId]);
  
  // Fetch recent summaries
  const fetchSummaries = async () => {
    if (!user || !employeeId) return;

    try {
      const { data, error } = await supabase
        .from('manager_feedback_summaries')
        .select('id, timeframe, summary, created_at, type')
        .eq('manager_id', user.id)
        .eq('employee_id', employeeId)
        .eq('type', 'summary')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      
      if (data) {
        setSummaries(data);
      }
    } catch (error) {
      console.error('Error fetching feedback summaries:', error);
      toast({
        title: 'Error fetching summaries',
        description: 'Could not load feedback summaries.',
        variant: 'destructive',
      });
    }
  };

  // Fetch recent 1:1 preps
  const fetchPreps = async () => {
    if (!user || !employeeId) return;

    try {
      const { data, error } = await supabase
        .from('manager_feedback_summaries')
        .select('id, timeframe, summary, created_at, type')
        .eq('manager_id', user.id)
        .eq('employee_id', employeeId)
        .eq('type', 'prep')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      
      if (data) {
        setPreps(data);
      }
    } catch (error) {
      console.error('Error fetching 1:1 preps:', error);
      toast({
        title: 'Error fetching 1:1 preps',
        description: 'Could not load 1:1 preparation notes.',
        variant: 'destructive',
      });
    }
  };

  // Generate feedback summary
  const handleSummarizeFeedback = async (timeframe: string) => {
    if (!user || !employeeId) return;

    try {
      setIsSummarizing(true);
      setSummaryTimeframe(timeframe);
      setFeedbackSummary(null);
      setSelectedItem(null);
      setActiveContentType('summary');
      setIsModalOpen(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // Call API to summarize feedback
      const response = await fetch('/api/feedback/manager/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          managerId: user.id,
          employeeId: employeeId,
          timeframe,
          is_invited: employeeProfile?.is_invited,
          type: 'summary'
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to summarize feedback');
      }
      
      const data = await response.json();
      setFeedbackSummary(data.summary);
      
      // Refresh the summaries list
      fetchSummaries();
    } catch (error) {
      console.error('Error summarizing feedback:', error);
      toast({
        title: 'Error summarizing feedback',
        description: 'Could not summarize feedback. Please try again later.',
        variant: 'destructive',
      });
      setFeedbackSummary('An error occurred while summarizing the feedback.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Generate 1:1 prep notes
  const handlePrep = async () => {
    if (!user || !employeeId) return;

    try {
      setIsGeneratingPrep(true);
      setPrepContent(null);
      setSelectedItem(null);
      setActiveContentType('prep');
      setIsModalOpen(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const timeframe = 'week';
      
      // Call API to generate 1:1 prep
      const response = await fetch('/api/feedback/manager/prep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          managerId: user.id,
          employeeId: employeeId,
          is_invited: employeeProfile?.is_invited,
          timeframe,
          type: 'prep'
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate 1:1 prep');
      }
      
      const data = await response.json();
      setPrepContent(data.prep);
      
      // Refresh the preps list
      fetchPreps();
    } catch (error) {
      console.error('Error generating 1:1 prep:', error);
      toast({
        title: 'Error generating 1:1 prep',
        description: 'Could not generate 1:1 preparation. Please try again later.',
        variant: 'destructive',
      });
      setPrepContent('An error occurred while generating the 1:1 preparation.');
    } finally {
      setIsGeneratingPrep(false);
    }
  };

  // Handle clicking on a summary
  const handleSummaryClick = (summary: FeedbackSummary) => {
    setSelectedItem(summary);
    setFeedbackSummary(summary.summary);
    setSummaryTimeframe(summary.timeframe);
    setActiveContentType('summary');
    setIsModalOpen(true);
  };

  // Handle clicking on a prep
  const handlePrepClick = (prep: FeedbackSummary) => {
    setSelectedItem(prep);
    setPrepContent(prep.summary);
    setActiveContentType('prep');
    setIsModalOpen(true);
  };

  // Format the summary title based on timeframe
  const formatTimeframeTitle = (timeframe: string) => {
    switch (timeframe) {
      case 'week':
        return 'Last Week\'s Feedback Summary';
      case 'month':
        return 'Last Month\'s Feedback Summary';
      case 'all':
        return 'Overall Feedback Summary';
      default:
        return 'Feedback Summary';
    }
  };

  // Format prep title
  const formatPrepTitle = (created_at: string) => {
    const date = new Date(created_at);
    return `1:1 Prep Notes (${date.toLocaleDateString()})`;
  };

  // Format relative time (like "1 day ago")
  const formatRelativeTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return 'some time ago';
    }
  };

  // Get a preview of the content (first 150 characters)
  const getContentPreview = (content: string) => {
    return content.length > 150 ? content.substring(0, 150) + '...' : content;
  };
  
  // Redirect if not authorized
  useEffect(() => {
    if (!loading && !isAuthorized && user) {
      router.push('/dashboard/');
    }
  }, [loading, isAuthorized, user, router]);
  
  // Show loading state
  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
          <p className="ml-2">Loading employee data...</p>
        </div>
      </div>
    );
  }
  
  // If not authorized, show nothing (will be redirected)
  if (!isAuthorized) {
    return null;
  }
  
  return (
    <>
    <Link href="/dashboard/manager/feedback" passHref>
      <Button variant="ghost" className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to All Team Feedback
      </Button>
    </Link>

    <div className="container mx-auto px-4">
      <h2 className='text-4xl font-light text-berkeleyblue mb-4'>
        {employeeProfile?.name || (employeeProfile?.email ? employeeProfile.email.split('@')[0] : 'Employee')}
      </h2>
        <div className='grid grid-cols-3 md:grid-cols-4 gap-8 mt-4'>
            {/* Summarized Feedback Card */}
            <div className='rounded-lg bg-white shadow-md pt-8 px-8 pb-6'>    
                <div className='border-b border-slate-200 pb-4 mb-4'>
                    <div className='flex items-center gap-2 mb-6'>
                        <Sparkles className="h-6 w-6 text-cerulean-300" />
                        <h4 className='text-lg font-light text-cerulean truncate'>Summarized Feedback</h4>
                    </div>

                    {summaries.length > 0 ? (
                        summaries.map((summary) => (
                            <div key={summary.id} className='mb-4'>
                                <div className='flex items-center justify-between'>
                                    <div 
                                        className="text-cerulean hover:text-cerulean-300 hover:underline cursor-pointer text-sm font-medium truncate"
                                        onClick={() => handleSummaryClick(summary)}
                                    >
                                        {formatTimeframeTitle(summary.timeframe)}
                                    </div>
                                    <time className="text-xs text-gray-500 truncate">
                                        {formatRelativeTime(summary.created_at)}
                                    </time>
                                </div>
                                <p 
                                    className="text-sm font-light text-slate-500 mt-1 cursor-pointer truncate"
                                    onClick={() => handleSummaryClick(summary)}
                                >
                                  <Markdown 
                                        components={{
                                            pre: ({children}) => <span>{children}</span>,
                                            code: ({children}) => <span>{children}</span>,
                                            h3: ({children}) => <span>{children}</span>,
                                            h4: ({children}) => <span>{children}</span>,
                                            p: ({children}) => <span>{children}</span>,
                                            strong: ({children}) => <span>{children}</span>,
                                            ol: ({children}) => <span>{children}</span>,
                                            ul: ({children}) => <span>{children}</span>,
                                            li: ({children}) => <span>{children}</span>,
                                        }}
                                    >
                                    {getContentPreview(summary.summary)}
                                    </Markdown>
                                </p>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm font-light text-slate-500 italic">
                            Generate your first summary below.
                        </p>
                    )}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant={'outline'} className="hidden md:flex w-full text-center">
                            Generate Summary
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
            </div>

            {/* 1:1 Prep Card */}
            <div className='rounded-lg bg-white shadow-md pt-8 px-8 pb-6'>    
                <div className='border-b border-slate-200 pb-4 mb-4'>
                    <div className='flex items-center gap-2 mb-6'>
                        <NotepadText className="h-6 w-6 text-cerulean-300" />
                        <h4 className='text-lg font-light text-cerulean truncate'>1:1 Prep</h4>
                    </div>

                    {preps.length > 0 ? (
                        preps.map((prep) => (
                            <div key={prep.id} className='mb-4'>
                                <div className='flex items-center justify-between'>
                                    <div 
                                        className="text-cerulean hover:text-cerulean-300 hover:underline cursor-pointer text-sm font-medium truncate"
                                        onClick={() => handlePrepClick(prep)}
                                    >
                                        {formatPrepTitle(prep.created_at)}
                                    </div>
                                    <time className="text-xs text-gray-500 truncate">
                                        {formatRelativeTime(prep.created_at)}
                                    </time>
                                </div>
                                <p 
                                    className="text-sm font-light text-slate-500 mt-1 cursor-pointer truncate"
                                    onClick={() => handlePrepClick(prep)}
                                >
                                  <Markdown 
                                        components={{
                                            pre: ({children}) => <span>{children}</span>,
                                            code: ({children}) => <span>{children}</span>,
                                            h3: ({children}) => <span>{children}</span>,
                                            h4: ({children}) => <span>{children}</span>,
                                            p: ({children}) => <span>{children}</span>,
                                            strong: ({children}) => <span>{children}</span>,
                                            ol: ({children}) => <span>{children}</span>,
                                            ul: ({children}) => <span>{children}</span>,
                                            li: ({children}) => <span>{children}</span>,
                                        }}
                                    >
                                    {getContentPreview(prep.summary)}
                                    </Markdown>
                                </p>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm font-light text-slate-500 italic">
                            Generate your first preparation below.
                        </p>
                    )}
                </div>
                <Button 
                    variant={'outline'} 
                    className="hidden md:flex w-full"
                    onClick={() => handlePrep()}
                >
                    Generate Prep   
                </Button>
            </div>

            {/* Skills Assessment Card */}
            <div className='rounded-lg bg-white shadow-md pt-8 px-8 pb-6'>    
                <div className='border-b border-slate-200 pb-4 mb-4'>
                    <div className='flex items-center gap-2 mb-6'>
                        <PieChart className="h-6 w-6 text-cerulean-300" />
                        <h4 className='text-lg font-light text-cerulean truncate'>Skills Assessment</h4>
                    </div>

                    <p className="text-sm font-light text-slate-500 italic">
                        Generate your first assessment below.
                    </p>
                </div>
                <Button 
                    variant={'outline'} 
                    className="hidden md:flex w-full"
                >
                    Assess Skills   
                </Button>
            </div>

            {/* Review Prep Card */}
            <div className='rounded-lg bg-white shadow-md pt-8 px-8 pb-6'>    
                <div className='border-b border-slate-200 pb-4 mb-4'>
                    <div className='flex items-center gap-2 mb-6'>
                        <NotebookPen className="h-6 w-6 text-cerulean-300" />
                        <h4 className='text-lg font-light text-cerulean truncate'>Review Prep</h4>
                    </div>

                    <p className="text-sm font-light text-slate-500 italic">
                        Generate your first review prep below.
                    </p>
                </div>
                <Button 
                    variant={'outline'} 
                    className="hidden md:flex w-full"
                >
                    Generate Prep   
                </Button>
            </div>
        </div>
    </div>

    <div className="container mx-auto py-8 px-4">
      <h2 className='text-2xl font-light text-berkeleyblue mb-4'>
        Feedback
      </h2>
      
      <FeedbackList 
        employeeId={employeeId} 
      />
    </div>

    {/* Shared Modal for both Feedback Summary and 1:1 Prep */}
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[90%] max-h-[90%] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>
                    {activeContentType === 'summary' ? (
                        isSummarizing ? 'Analyzing feedback...' : 
                        selectedItem ? formatTimeframeTitle(selectedItem.timeframe) :
                        summaryTimeframe === 'week' ? 'Last Week\'s Feedback Summary' :
                        summaryTimeframe === 'month' ? 'Last Month\'s Feedback Summary' :
                        'Overall Feedback Summary'
                    ) : (
                        isGeneratingPrep ? 'Generating 1:1 prep notes...' :
                        selectedItem ? formatPrepTitle(selectedItem.created_at) :
                        '1:1 Preparation Notes'
                    )}
                </DialogTitle>
                <DialogDescription>
                    {activeContentType === 'summary' ? (
                        isSummarizing ? 'Please wait while we generate a feedback summary.' : 
                        `Feedback summary for ${employeeProfile?.name || 'employee'}.`
                    ) : (
                        isGeneratingPrep ? 'Please wait while we generate 1:1 preparation notes.' :
                        `1:1 preparation notes for your meeting with ${employeeProfile?.name || 'employee'}.`
                    )}
                </DialogDescription>
            </DialogHeader>
            
            {activeContentType === 'summary' && isSummarizing || activeContentType === 'prep' && isGeneratingPrep ? (
                <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cerulean"></div>
                </div>
            ) : (
                <div>
                    {activeContentType === 'summary' && feedbackSummary && (
                        <Markdown 
                            components={{
                                pre: ({children}) => <pre className={`text-2xl font-medium text-cerulean mb-3 ${radley.className}`}>{children}</pre>,
                                code: ({children}) => <code className={`text-2xl font-medium text-cerulean mb-3 ${radley.className}`}>{children}</code>,
                                h3: ({children}) => <h3 className="text-xl font-medium text-gray-800 mb-3">{children}</h3>,
                                h4: ({children}) => <h4 className="text-lg font-medium text-gray-800 mt-8 mb-2">{children}</h4>,
                                p: ({children}) => <p className="mb-4">{children}</p>,
                                strong: ({children}) => <strong className="font-bold">{children}</strong>,
                                ol: ({children}) => <ol className="list-decimal pl-6 mb-4">{children}</ol>,
                                ul: ({children}) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
                                li: ({children}) => <li className="mb-1">{children}</li>,
                            }}
                        >
                            {feedbackSummary}
                        </Markdown>
                    )}
                    {activeContentType === 'prep' && prepContent && (
                        <Markdown 
                            components={{
                                pre: ({children}) => <pre className={`text-2xl font-medium text-cerulean mb-3 ${radley.className}`}>{children}</pre>,
                                code: ({children}) => <code className={`text-2xl font-medium text-cerulean mb-3 ${radley.className}`}>{children}</code>,
                                h3: ({children}) => <h3 className="text-xl font-medium text-gray-800 mb-3">{children}</h3>,
                                h4: ({children}) => <h4 className="text-lg font-medium text-gray-800 mt-8 mb-2">{children}</h4>,
                                p: ({children}) => <p className="mb-4">{children}</p>,
                                strong: ({children}) => <strong className="font-bold">{children}</strong>,
                                ol: ({children}) => <ol className="list-decimal pl-6 mb-4">{children}</ol>,
                                ul: ({children}) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
                                li: ({children}) => <li className="mb-1">{children}</li>,
                            }}
                        >
                            {prepContent}
                        </Markdown>
                    )}
                </div>
            )}
        </DialogContent>
    </Dialog>
    </>
  );
}