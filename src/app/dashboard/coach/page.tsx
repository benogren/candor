'use client';

import { useState, useEffect } from 'react';
import { radley } from '../../fonts';
import Image from 'next/image';
import { Sparkles, NotepadText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/context/auth-context';
import supabase from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import Markdown from 'react-markdown';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from 'date-fns';

// Types for our data
type FeedbackSummary = {
  id: string;
  timeframe: string;
  summary: string;
  created_at: string;
  type: string;
};

export default function FeedbackCoachPage() {
    const { user } = useAuth();
    
    // State for feedback summaries
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [feedbackSummary, setFeedbackSummary] = useState<string | null>(null);
    const [summaryTimeframe, setSummaryTimeframe] = useState<string | null>(null);
    const [summaries, setSummaries] = useState<FeedbackSummary[]>([]);
    
    // State for 1:1 preps
    const [isGeneratingPrep, setIsGeneratingPrep] = useState(false);
    const [prepContent, setPrepContent] = useState<string | null>(null);
    const [preps, setPreps] = useState<FeedbackSummary[]>([]);
    
    // Shared modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<FeedbackSummary | null>(null);
    const [activeContentType, setActiveContentType] = useState<'summary' | 'prep'>('summary');

    // Fetch recent summaries
    const fetchSummaries = async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('feedback_summaries')
                .select('id, timeframe, summary, created_at, type')
                .eq('user_id', user.id)
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
                description: 'Could not load your feedback summaries.',
                variant: 'destructive',
            });
        }
    };

    // Fetch recent 1:1 preps
    const fetchPreps = async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('feedback_summaries')
                .select('id, timeframe, summary, created_at, type')
                .eq('user_id', user.id)
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
                description: 'Could not load your 1:1 preparation notes.',
                variant: 'destructive',
            });
        }
    };

    // Load data when the component mounts
    useEffect(() => {
        fetchSummaries();
        fetchPreps();
    }, [user]);

    const handleSummarizeFeedback = async (timeframe: string) => {
        if (!user) return;

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
            const response = await fetch('/api/feedback/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    userId: user.id,
                    timeframe,
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
                description: 'Could not summarize your feedback. Please try again later.',
                variant: 'destructive',
            });
            setFeedbackSummary('An error occurred while summarizing your feedback.');
        } finally {
            setIsSummarizing(false);
        }
    };

    const handlePrep = async () => {
        if (!user) return;

        const timeframe = 'week'; // Default to week for 1:1 prep

        try {
            setIsGeneratingPrep(true);
            setPrepContent(null);
            setSelectedItem(null);
            setActiveContentType('prep');
            setIsModalOpen(true);
            
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            
            // Call API to generate 1:1 prep
            const response = await fetch('/api/feedback/prep', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    userId: user.id,
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
                description: 'Could not generate your 1:1 preparation. Please try again later.',
                variant: 'destructive',
            });
            setPrepContent('An error occurred while generating your 1:1 preparation.');
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

    // Format relative time (like "1 day ago")
    const formatRelativeTime = (timestamp: string) => {
        try {
            return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
        } catch (error) {
            return 'some time ago';
            console.log('Error formatting time:', error);
        }
    };

    // Get a preview of the content (first 150 characters)
    const getContentPreview = (content: string) => {
        return content.length > 150 ? content.substring(0, 150) + '...' : content;
    };

    // Format prep title
    const formatPrepTitle = (created_at: string) => {
        const date = new Date(created_at);
        return `1:1 Prep Notes (${date.toLocaleDateString()})`;
    };

    return (
        <>
        <main className="flex-1 flex bg-slate-50 rounded-lg w-full shadow-md">
            <div className="container mx-auto px-4">
                <div className='flex flex-col md:flex-row relative px-12 items-center justify-center'>
                    <div className='w-1/2'>
                        <h1 className={`text-4xl md:text-6xl font-light text-cerulean ${radley.className}`}>
                            Your Personal Feedback Coach.
                        </h1>
                        <p className={`text-slate-500 text-sm md:text-base font-light mt-4`}>
                        Your Feedback Coach helps you get the most out of the feedback you&apos;ve received. Use these tools to understand patterns, identify growth opportunities, and track your progress over time.
                        </p>
                    </div>
                    <div className='w-1/2'>
                        <Image
                            src="/candor-coach-hero.png"
                            alt="Candor Coach"
                            width={300}
                            height={180}
                            className="object-cover w-full h-full mx-auto"
                            priority={true}
                        />
                    </div>
                </div>
            </div>
        </main>
                
        <div className="container mx-auto px-4 py-8">
            <div className='grid grid-cols-1 md:grid-cols-2 gap-8 mt-4'>
                
                {/* Summarized Feedback Card */}
                <div className='rounded-lg bg-white shadow-md pt-8 px-8 pb-6'>    
                    <div className='border-b border-slate-200 pb-4 mb-4'>
                        <div className='flex items-center gap-2 mb-6'>
                            <Sparkles className="h-6 w-6 text-cerulean-300" />
                            <h4 className='text-lg font-light text-cerulean'>Summarized Feedback</h4>
                        </div>

                        {summaries.length > 0 ? (
                            summaries.map((summary) => (
                                <div key={summary.id} className='mb-4'>
                                    <div className='flex items-center justify-between'>
                                        <div 
                                            className="text-cerulean hover:text-cerulean-300 hover:underline cursor-pointer text-sm font-medium"
                                            onClick={() => handleSummaryClick(summary)}
                                        >
                                            {formatTimeframeTitle(summary.timeframe)}
                                        </div>
                                        <time className="text-xs text-gray-500">
                                            {formatRelativeTime(summary.created_at)}
                                        </time>
                                    </div>
                                    <p 
                                        className="text-sm font-light text-slate-500 mt-1 cursor-pointer"
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
                                No feedback summaries yet. Generate your first summary below.
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
                                Last Week&apos;s Feedback
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSummarizeFeedback('month')} className='w-full'>
                                Last Month&apos;s Feedback
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
                            <h4 className='text-lg font-light text-cerulean'>1:1 Prep</h4>
                        </div>

                        {preps.length > 0 ? (
                            preps.map((prep) => (
                                <div key={prep.id} className='mb-4'>
                                    <div className='flex items-center justify-between'>
                                        <div 
                                            className="text-cerulean hover:text-cerulean-300 hover:underline cursor-pointer text-sm font-medium"
                                            onClick={() => handlePrepClick(prep)}
                                        >
                                            {formatPrepTitle(prep.created_at)}
                                        </div>
                                        <time className="text-xs text-gray-500">
                                            {formatRelativeTime(prep.created_at)}
                                        </time>
                                    </div>
                                    <p 
                                        className="text-sm font-light text-slate-500 mt-1 cursor-pointer"
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
                                No 1:1 prep notes yet. Generate your first preparation below.
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
            </div>
        </div>

        {/* Shared Modal for both Feedback Summary and 1:1 Prep */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="sm:max-w-[90%] max-h-[90%] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {activeContentType === 'summary' ? (
                            isSummarizing ? 'Analyzing your feedback...' : 
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
                            isSummarizing ? 'Please wait while we generate your feedback summary.' : 
                            'Here\'s what we found in your feedback.'
                        ) : (
                            isGeneratingPrep ? 'Please wait while we generate your 1:1 preparation notes.' :
                            'Use these notes to prepare for your next 1:1 meeting.'
                        )}
                    </DialogDescription>
                </DialogHeader>
                
                {activeContentType === 'summary' && isSummarizing || activeContentType === 'prep' && isGeneratingPrep ? (
                    <div className="flex justify-center items-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cerulean"></div>
                    </div>
                ) : (
                    <div className="py-4">
                        {activeContentType === 'summary' && feedbackSummary && (
                            <Markdown 
                                components={{
                                    pre: ({children}) => <pre className={`text-2xl font-medium text-cerulean mb-3 ${radley.className}`}>{children}</pre>,
                                    code: ({children}) => <code className={`text-2xl font-medium text-cerulean mb-3 ${radley.className}`}>{children}</code>,
                                    h3: ({children}) => <h3 className="text-xl font-medium text-gray-800 mb-3">{children}</h3>,
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
                        )}
                        {activeContentType === 'prep' && prepContent && (
                            <Markdown 
                                components={{
                                    pre: ({children}) => <pre className={`text-2xl font-medium text-cerulean mb-3 ${radley.className}`}>{children}</pre>,
                                    code: ({children}) => <code className={`text-2xl font-medium text-cerulean mb-3 ${radley.className}`}>{children}</code>,
                                    h3: ({children}) => <h3 className="text-xl font-medium text-gray-800 mb-3">{children}</h3>,
                                    h4: ({children}) => <h4 className="text-lg font-medium text-gray-800 mt-5 mb-2">{children}</h4>,
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