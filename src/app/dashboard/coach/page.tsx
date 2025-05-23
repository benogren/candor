'use client';

import { useState, useEffect, useCallback } from 'react';
import { radley } from '../../fonts';
import { Sparkles, NotepadText, Calendar, FileText, Plus, Trash2, AlertCircle, Users, NotebookPen, BotMessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from '@/lib/context/auth-context';
import supabase from '@/lib/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow, format } from 'date-fns';

// Type for our notes data
type Note = {
  id: string;
  title: string;
  content: string;
  content_type: string;
  creator_id: string;
  subject_member_id?: string;
  subject_invited_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  is_generating: boolean;
};

// Helper function to safely strip HTML for previews
const stripHtml = (html: string) => {
  if (!html) return '';
  
  try {
    // For browser environments
    if (typeof window !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || '';
    } 
    // Fallback for SSR
    return html.replace(/<[^>]*>?/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    // Fallback if parsing fails
    return html.replace(/<[^>]*>?/gm, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
};

export default function FeedbackCoachPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [userName, setUserName] = useState<string>('');
    
    // State for summaries and preps from notes table
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isGeneratingPrep, setIsGeneratingPrep] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [summaries, setSummaries] = useState<Note[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [preps, setPreps] = useState<Note[]>([]);
    const [recentNotes, setRecentNotes] = useState<Note[]>([]);
    const [allNotes, setAllNotes] = useState<Note[]>([]);
    const [isGeneratingReview, setIsGeneratingReview] = useState(false);
    
    // State for delete confirmation
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // is manager?
    const [isManager, setIsManager] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [directReports, setDirectReports] = useState<{id: string}[]>([]);

    const getUserName = useCallback(async () => {
        if (!user?.id) return;

        try {
            const { data: userData, error: userError } = await supabase
                .from('user_profiles')
                .select('name')
                .eq('id', user.id)
                .single();

            if (userError) throw userError;

            if (userData?.name) {
                setUserName(userData.name);
            }
        } catch (error) {
            console.log('Error getting user name:', error);
        }
    }, [user?.id]);


    const checkIfManager = useCallback(async () => {
        if (!user) return;
        
        try {

            const { data: reportsData, error: reportsError } = await supabase
            .from('org_structure')
            .select('id')
            .eq('manager_id', user.id)
            .limit(1);
            
            if (reportsError) throw reportsError;
            
            // If we found any direct reports, the user is a manager
            setIsManager(reportsData && reportsData.length > 0);
            setDirectReports(reportsData || []);
        } catch (error) {
            console.error('Error checking manager status:', error);
        }
    }, [user]);

    // Fetch recent summaries from notes table
    const fetchSummaries = useCallback(async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('creator_id', user.id)
                .eq('content_type', 'summary')
                .is('subject_member_id', null)   // Only get personal notes
                .is('subject_invited_id', null)  // Only get personal notes
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
    }, [user, toast]);

    // Fetch recent 1:1 preps from notes table
    const fetchPreps = useCallback(async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('creator_id', user.id)
                .eq('content_type', 'prep')
                .is('subject_member_id', null)   // Only get personal notes
                .is('subject_invited_id', null)  // Only get personal notes
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
    }, [user, toast]);

    // Fetch all recent notes for the top section
    const fetchRecentNotes = useCallback(async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('creator_id', user.id)
                .is('subject_member_id', null)   // Only get personal notes
                .is('subject_invited_id', null)  // Only get personal notes
                .order('updated_at', { ascending: false })
                .limit(3);  // Only show 3 most recent notes in the top section

            if (error) throw error;
            
            if (data) {
                setRecentNotes(data);
            }
        } catch (error) {
            console.error('Error fetching recent notes:', error);
        }
    }, [user]);

    // Fetch all notes for the full list section
    const fetchAllNotes = useCallback(async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('creator_id', user.id)
                .is('subject_member_id', null)   // Only get personal notes
                .is('subject_invited_id', null)  // Only get personal notes
                .order('updated_at', { ascending: false })
                .limit(20);  // Show more notes in the full list

            if (error) throw error;
            
            if (data) {
                setAllNotes(data);
            }
        } catch (error) {
            console.error('Error fetching all notes:', error);
        }
    }, [user]);

    // Delete a note
    const deleteNote = async () => {
        if (!noteToDelete || !user) return;
        
        try {
            setIsDeleting(true);
            
            // Delete the note from the database
            const { error } = await supabase
                .from('notes')
                .delete()
                .eq('id', noteToDelete.id)
                .eq('creator_id', user.id);
                
            if (error) throw error;
            
            // Close the modal
            setDeleteModalOpen(false);
            setNoteToDelete(null);
            
            // Show success message
            toast({
                title: 'Note deleted',
                description: 'Your note has been deleted successfully.',
            });
            
            // Refresh the lists
            fetchSummaries();
            fetchPreps();
            fetchRecentNotes();
            fetchAllNotes();
            
        } catch (error) {
            console.error('Error deleting note:', error);
            toast({
                title: 'Error deleting note',
                description: 'Could not delete your note. Please try again later.',
                variant: 'destructive',
            });
        } finally {
            setIsDeleting(false);
        }
    };

    // Handle delete click - open confirmation modal
    const handleDeleteClick = (note: Note, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigating to the note
        setNoteToDelete(note);
        setDeleteModalOpen(true);
    };

    // Load data when the component mounts
    useEffect(() => {
    fetchSummaries();
    fetchPreps();
    fetchRecentNotes();
    fetchAllNotes();
    checkIfManager();
    getUserName();
    }, [fetchSummaries, fetchPreps, fetchRecentNotes, fetchAllNotes, checkIfManager, getUserName]);

    // Handle clicking on a note
    const handleNoteClick = (note: Note) => {
        router.push(`/dashboard/notes/${note.id}`);
    };

    // Generate summary handler
    const handleSummarizeFeedback = async (timeframe: string) => {
    if (!user) return;

    try {
        setIsSummarizing(true);
        
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        // First, check if there's feedback for this timeframe
        const checkResponse = await fetch('/api/feedback/check-feedback', {
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
        
        if (!checkResponse.ok) {
        const errorData = await checkResponse.json();
        throw new Error(errorData.error || 'Failed to check feedback');
        }
        
        const { hasFeedback } = await checkResponse.json();
        
        if (!hasFeedback) {
        // No feedback for this timeframe, show a message to the user
        toast({
            description: `You have no feedback for the ${timeframe === 'week' ? 'past week' : timeframe === 'month' ? 'past month' : 'selected period'}.`,
        });

        // fallback
        alert(`You have no feedback for the ${timeframe === 'week' ? 'past week' : timeframe === 'month' ? 'past month' : 'selected period'}.`);
        return;
        }
        
        // Feedback exists, proceed with creating a note
        let catTitle = '';
        if (timeframe === 'week') {
        catTitle = 'Last Week\'s Feedback Summary';
        } else if (timeframe === 'month') {
        catTitle = 'Last Month\'s Feedback Summary';
        } else {
        catTitle = 'Overall Feedback Summary';
        }

        catTitle += ` (${new Date().toLocaleDateString()})`;
        
        // Create a new note
        const response = await fetch('/api/notes/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            title: catTitle,
            content_type: 'summary',
            metadata: { timeframe },
            subject_member_id: null,
            subject_invited_id: null
        }),
        });
        
        if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create note');
        }
        
        const data = await response.json();
        
        // Navigate to the editor page
        router.push(`/dashboard/notes/${data.id}`);
    } catch (error) {
        console.error('Error creating summary note:', error);
        toast({
        title: 'Error creating summary',
        description: 'Could not create your feedback summary. Please try again later.',
        variant: 'destructive',
        });
    } finally {
        setIsSummarizing(false);
    }
    };

    // Generate prep handler
    const handlePrep = async () => {
        if (!user) return;

        try {
            setIsGeneratingPrep(true);
            
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            let catTitle = '1:1 Preparation Notes';
            catTitle += ` (${new Date().toLocaleDateString()})`;
            
            // Create a new note
            const response = await fetch('/api/notes/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    title: catTitle,
                    content_type: 'prep',
                    metadata: { timeframe: 'week' },
                    subject_member_id: null,
                    subject_invited_id: null
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create note');
            }
            
            const data = await response.json();
            
            // Navigate to the editor page
            router.push(`/dashboard/notes/${data.id}`);
        } catch (error) {
            console.error('Error creating prep note:', error);
            toast({
                title: 'Error creating prep notes',
                description: 'Could not create your 1:1 preparation. Please try again later.',
                variant: 'destructive',
            });
        } finally {
            setIsGeneratingPrep(false);
        }
    };

    // Generate review handler
    const handleReview = async () => {
        if (!user) return;

        try {
            setIsGeneratingReview(true);
            
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            let catTitle = 'Self-Evaluation Notes';
            catTitle += ` (${new Date().toLocaleDateString()})`;
            
            // Create a new note
            const response = await fetch('/api/notes/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    title: catTitle,
                    content_type: 'review',
                    metadata: { timeframe: 'all' },
                    subject_member_id: null,
                    subject_invited_id: null
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create note');
            }
            
            const data = await response.json();
            
            // Navigate to the editor page
            router.push(`/dashboard/notes/${data.id}`);
        } catch (error) {
            console.error('Error creating review note:', error);
            toast({
                title: 'Error creating self-evaluation notes',
                description: 'Could not create your self-evaluation preparation. Please try again later.',
                variant: 'destructive',
            });
        } finally {
            setIsGeneratingReview(false);
        }
    };

    // Format relative time (like "1 day ago")
    const formatRelativeTime = (timestamp: string) => {
        try {
            return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
        } catch (error) {
            console.log('Error formatting date:', error);
            return 'some time ago';
        }
    };

    // Get a preview of the content (first 180 characters)
    const getContentPreview = (content: string) => {
        if (!content) return '';
        const plainText = stripHtml(content);
        return plainText.length > 160 ? plainText.substring(0, 160) + '...' : plainText;
    };

    const ContentPreview = ({ content }: { content: string }) => {
    return (
        <div className="h-[72px] overflow-hidden relative">
        <p className="text-sm text-slate-400 line-clamp-3">
            {getContentPreview(content)}
        </p>
        <div className="absolute bottom-0 w-full h-6 bg-gradient-to-t from-white to-transparent"></div>
        </div>
        );
    };

    // Get note type display label
    const getNoteTypeLabel = (note: Note) => {
        if (note.content_type === 'summary') {
            return 'Feedback Summary';
        } 
        if (note.content_type === 'prep') {
            return '1:1 Prep Notes';
        }
        if (note.content_type === 'review') {
            return 'Self-Evaluation Prep';
        }
        return 'Note';
    };

    return (
        <div className="container mx-auto">
            <div className='bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100'>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center'>
                        <div className='bg-cerulean rounded-md p-2 mr-4 items-center'>
                            <BotMessageSquare className="h-12 w-12 text-cerulean-100" />
                        </div>
                        <div>
                            <h2 className={`text-4xl font-light text-cerulean ${radley.className}`}>{userName || 'Loading...'}</h2>
                            <p className='text-cerulean-300'>Feedback Coach</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {isManager && (
                            <Button
                            variant="secondary"
                            className="flex items-center gap-2"
                            onClick={() => router.push('/dashboard/coach/manager')}
                            >
                            <Users className="h-5 w-5 text-cerulean-400" />
                            Switch to Manager View
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-10">
                {/* <h2 className='text-2xl font-light text-berkeleyblue mb-4'>Generate New</h2> */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                            variant="secondary" 
                            className="w-full flex items-center justify-between px-4 py-12 text-left"
                            disabled={isSummarizing}
                            >
                                <div className="flex items-center">
                                    <Sparkles className="h-7 w-7 text-cerulean-400 mr-4" />
                                    <div>
                                        <div className="font-light text-lg text-cerulean">Feedback Summary</div>
                                        <div className="text-sm text-gray-500">Analyze your received feedback</div>
                                    </div>
                                </div>
                                <Plus className="h-5 w-5 text-cerulean" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem 
                                onClick={() => handleSummarizeFeedback('week')} 
                                className="cursor-pointer"
                                disabled={isSummarizing}
                            >
                                {isSummarizing ? 'Checking feedback...' : 'Last Week\'s Feedback'}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onClick={() => handleSummarizeFeedback('month')} 
                                className="cursor-pointer"
                                disabled={isSummarizing}
                            >
                                {isSummarizing ? 'Checking feedback...' : 'Last Month\'s Feedback'}
                            </DropdownMenuItem>
                            {/* <DropdownMenuItem 
                                onClick={() => handleSummarizeFeedback('all')} 
                                className="cursor-pointer"
                                disabled={isSummarizing}
                            >
                                {isSummarizing ? 'Checking feedback...' : 'All Feedback'}
                            </DropdownMenuItem> */}
                            </DropdownMenuContent>
                    </DropdownMenu>

                    <Button 
                        variant="secondary" 
                        className="w-full flex items-center justify-between px-4 py-12 text-left"
                        onClick={() => handlePrep()}
                        disabled={isGeneratingPrep}
                    >
                        <div className="flex items-center">
                            <NotepadText className="h-7 w-7 text-cerulean-400 mr-4" />
                            <div>
                                <div className="font-light text-lg text-cerulean">1:1 Preparation</div>
                                <div className="text-sm text-gray-500">Create notes for your next meeting</div>
                            </div>
                        </div>
                        <Plus className="h-5 w-5 text-cerulean" />
                    </Button>

                    <Button 
                        variant="secondary" 
                        className="w-full flex items-center justify-between px-4 py-12 text-left"
                        onClick={() => handleReview()}
                        disabled={isGeneratingReview}
                    >
                        <div className="flex items-center">
                            <NotebookPen className="h-7 w-7 text-cerulean-400 mr-4" />
                            <div>
                                <div className="font-light text-lg text-cerulean">Self-Evaluation Preparation</div>
                                <div className="text-sm text-gray-500">Create notes for your next career discussion</div>
                            </div>
                        </div>
                        <Plus className="h-5 w-5 text-cerulean" />
                    </Button>
                </div>
            </div>

            {/* Recent Activity Section */}
            {recentNotes.length > 0 && (
                <div className="mb-10">
                    <h2 className='text-2xl font-light text-berkeleyblue mb-4'>Recently Updated</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {recentNotes.map(note => (
                            <div 
                        key={note.id}
                        className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-100 overflow-hidden cursor-pointer h-[210px] flex flex-col"
                        onClick={() => handleNoteClick(note)}
                        >
                        <div className="p-5 flex-1 flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                                {note.content_type === 'summary' && (
                                <Sparkles className="h-4 w-4 text-cerulean-400 mr-2" />
                                )}
                                {note.content_type === 'prep' && (
                                <NotepadText className="h-4 w-4 text-cerulean-400 mr-2" />
                                )}
                                {note.content_type === 'review' && (
                                <NotebookPen className="h-4 w-4 text-cerulean-400 mr-2" />
                                )}
                                <span className="text-xs font-medium text-cerulean-500 uppercase tracking-wide">
                                {getNoteTypeLabel(note)}
                                </span>
                            </div>
                            <span className="text-xs text-gray-500">
                                {formatRelativeTime(note.updated_at)}
                            </span>
                            </div>
                            <h4 className="font-medium text-gray-900 mb-2 truncate">{note.title}</h4>
                            <ContentPreview content={note.content} />
                        </div>
                        <div className="bg-slate-50 px-5 py-2 text-xs text-gray-500 flex items-center justify-between mt-auto">
                            <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>{format(new Date(note.created_at), 'MMM d, yyyy')}</span>
                            </div>
                            <button 
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            onClick={(e) => handleDeleteClick(note, e)}
                            title="Delete"
                            >
                            <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                        </div>
                        ))}
                    </div>
                </div>
            )}

            <div className='mb-8'>
                <h2 className='text-2xl font-light text-berkeleyblue mb-4'>All My Notes</h2>
                <div className='rounded-lg bg-white shadow-md border border-gray-100'>
                    {allNotes.length > 0 ? (
                        <>
                        {allNotes.map((note, index) => (
                            <div 
                            key={note.id}
                            className={`px-6 py-4 hover:bg-slate-50 cursor-pointer ${index !== 0 ? 'border-t border-gray-100' : ''}`}
                            onClick={() => handleNoteClick(note)}
                            >
                                <div className='flex items-center justify-between w-full'>
                                    <div className='flex items-center'>
                                        {note.content_type === 'summary' ? (
                                            <Sparkles className="h-5 w-5 text-cerulean-400 mr-2" />
                                        ) : note.content_type === 'prep' ? (
                                            <NotepadText className="h-5 w-5 text-cerulean-400 mr-2" />
                                        ) : note.content_type === 'review' ? (
                                            <NotebookPen className="h-5 w-5 text-cerulean-400 mr-2" />
                                        ) : (
                                            <FileText className="h-5 w-5 text-cerulean-400 mr-2" />
                                        )}
                                        <h4 className="font-medium text-cerulean truncate">{note.title}</h4>
                                    </div>
                                    <div className='flex items-center text-xs text-gray-500'>
                                        <span>{formatRelativeTime(note.updated_at)}</span>
                                        <button 
                                            className="text-gray-400 hover:text-red-500 transition-colors ml-4"
                                            onClick={(e) => handleDeleteClick(note, e)}
                                            title="Delete"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className='mt-2 text-sm text-slate-400'>
                                    {getContentPreview(note.content)}
                                </div>
                                
                            </div>
                        ))}
                        </>
                    ) : (
                        <div className="text-center p-6">
                            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">Generate your first note using the options above.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center">
                            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                            Confirm Deletion
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this note? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {noteToDelete && (
                        <div className="my-2 p-3 bg-gray-50 rounded-md">
                            <p className="font-medium text-sm">{noteToDelete.title}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Created {format(new Date(noteToDelete.created_at), 'MMMM d, yyyy')}
                            </p>
                        </div>
                    )}
                    
                    <DialogFooter className="flex justify-end gap-2 mt-4">
                        <Button 
                            variant="outline" 
                            onClick={() => setDeleteModalOpen(false)} 
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={deleteNote} 
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}