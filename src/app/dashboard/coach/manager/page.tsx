'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, NotepadText, Calendar, UserCircle, FileText, Plus, Trash2, AlertCircle, Users, NotebookPen } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// Type for team member
type TeamMember = {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  is_invited_user: boolean;
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

export default function ManagerCoachPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    // State for team members and notes
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [selectedMember, setSelectedMember] = useState<string>('all');
    const [managerNotes, setManagerNotes] = useState<Note[]>([]);
    const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
    const [recentNotes, setRecentNotes] = useState<Note[]>([]);
    
    // Loading states
    const [isLoading, setIsLoading] = useState(true);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isGeneratingPrep, setIsGeneratingPrep] = useState(false);
    const [isGeneratingReview, setIsGeneratingReview] = useState(false);
    
    // Delete confirmation state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Manager state
    // const [isManager, setIsManager] = useState(false);
    // const [directReports, setDirectReports] = useState<any[]>([]);

    // Fetch team members (direct reports)
    const fetchTeamMembers = useCallback(async () => {
        if (!user) return;
        
        try {
            setIsLoading(true);
            
            // Get direct reports from org_structure view
            const { data: directReports, error: reportsError } = await supabase
                .from('org_structure')
                .select('id, email, is_invited')
                .eq('manager_id', user.id);
                
            if (reportsError) throw reportsError;
            
            if (!directReports || directReports.length === 0) {
                setIsLoading(false);
                return;
            }
            
            // Separate regular users and invited users
            const regularUserIds = directReports
                .filter(record => !record.is_invited)
                .map(record => record.id);
                
            const invitedUserIds = directReports
                .filter(record => record.is_invited)
                .map(record => record.id);
            
            // Fetch details for regular users
            let members: TeamMember[] = [];
            
            if (regularUserIds.length > 0) {
                const { data: userData, error: userError } = await supabase
                    .from('user_profiles')
                    .select('id, name, email, avatar_url')
                    .in('id', regularUserIds);
                    
                if (userError) throw userError;
                
                members = userData?.map(user => ({
                    id: user.id,
                    full_name: user.name || 'Unknown',
                    email: user.email,
                    avatar_url: user.avatar_url,
                    is_invited_user: false
                })) || [];
            }
            
            // Fetch details for invited users
            if (invitedUserIds.length > 0) {
                const { data: invitedData, error: invitedError } = await supabase
                    .from('invited_users')
                    .select('id, name, email')
                    .in('id', invitedUserIds);
                    
                if (invitedError) throw invitedError;
                
                const invitedMembers = invitedData?.map(user => ({
                    id: user.id,
                    full_name: user.name || 'Unknown',
                    email: user.email,
                    is_invited_user: true
                })) || [];
                
                members = [...members, ...invitedMembers];
            }
            
            // Sort alphabetically by name
            members.sort((a, b) => a.full_name.localeCompare(b.full_name));
            
            setTeamMembers(members);
        } catch (error) {
            console.error('Error fetching team members:', error);
            toast({
                title: 'Error fetching team',
                description: 'Could not load your team members.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    // Fetch all manager notes
    const fetchManagerNotes = useCallback(async () => {
        if (!user) return;

        try {
            setIsLoading(true);
            
            // Fetch notes where the user is the creator and has a subject_member_id or subject_invited_id
            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('creator_id', user.id)
                .not('subject_member_id', 'is', null)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            // Also fetch notes with subject_invited_id
            const { data: invitedData, error: invitedError } = await supabase
                .from('notes')
                .select('*')
                .eq('creator_id', user.id)
                .not('subject_invited_id', 'is', null)
                .order('created_at', { ascending: false });

            if (invitedError) throw invitedError;
            
            // Combine both sets of notes
            const combinedNotes = [
                ...(data || []),
                ...(invitedData || [])
            ];
            
            // Remove duplicates (in case a note has both subject_member_id and subject_invited_id)
            const uniqueNotes = combinedNotes.filter((note, index, self) =>
                index === self.findIndex((n) => n.id === note.id)
            );
            
            // Sort by updated_at
            uniqueNotes.sort((a, b) => 
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );
            
            if (uniqueNotes.length > 0) {
                setManagerNotes(uniqueNotes);
                setFilteredNotes(uniqueNotes);
                setRecentNotes(uniqueNotes.slice(0, 3));
            } else {
                setManagerNotes([]);
                setFilteredNotes([]);
                setRecentNotes([]);
            }
        } catch (error) {
            console.error('Error fetching manager notes:', error);
            toast({
                title: 'Error fetching notes',
                description: 'Could not load your team notes.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    // Filter notes by team member
    const filterNotesByMember = (memberId: string) => {
        setSelectedMember(memberId);
        
        if (memberId === 'all') {
            setFilteredNotes(managerNotes);
            setRecentNotes(managerNotes.slice(0, 3)); // Update recent notes to show all
            return;
        }
        
        // Check if the member is an invited user based on our team members data
        const member = teamMembers.find(m => m.id === memberId);
        
        if (!member) {
            setFilteredNotes([]);
            setRecentNotes([]);
            return;
        }
        
        // Filter based on whether it's an invited user or regular member
        const filtered = managerNotes.filter(note => {
            if (member.is_invited_user) {
                return note.subject_invited_id === memberId;
            } else {
                return note.subject_member_id === memberId;
            }
        });
        
        setFilteredNotes(filtered);
        setRecentNotes(filtered.slice(0, 3)); // Update recent notes for this member
    };

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
            
            // Refresh the notes
            fetchManagerNotes();
            
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

    // Handle delete click
    const handleDeleteClick = (note: Note, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigating to the note
        setNoteToDelete(note);
        setDeleteModalOpen(true);
    };

    // Generate summary handler
    const handleSummarizeFeedback = async (memberId: string, timeframe: string) => {
        if (!user || !memberId) return;

        try {
            setIsSummarizing(true);
            
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            
            // First, check if there's feedback for this member and timeframe
            const checkResponse = await fetch('/api/feedback/check-feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    userId: memberId,
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
                    description: `No feedback available for this team member in the ${timeframe === 'week' ? 'past week' : timeframe === 'month' ? 'past month' : 'selected period'}.`,
                });

                //fall back
                alert(`No feedback available for this team member in the ${timeframe === 'week' ? 'past week' : timeframe === 'month' ? 'past month' : 'selected period'}.`);
                
                return;
            }
            
            // Get the member name
            const member = teamMembers.find(m => m.id === memberId);
            if (!member) throw new Error('Team member not found');
            
            // Create title
            let catTitle = '';
            if (timeframe === 'week') {
                catTitle = `${member.full_name}'s Last Week's Feedback Summary`;
            } else if (timeframe === 'month') {
                catTitle = `${member.full_name}'s Last Month's Feedback Summary`;
            } else {
                catTitle = `${member.full_name}'s Overall Feedback Summary`;
            }

            catTitle += ` (${new Date().toLocaleDateString()})`;
            
            // Create note with subject member ID
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
                    // Add the subject member or invited user ID based on the member type
                    subject_member_id: member.is_invited_user ? null : memberId,
                    subject_invited_id: member.is_invited_user ? memberId : null
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create note');
            }
            
            const data = await response.json();
            
            // Navigate to the editor page where generation will happen automatically
            router.push(`/dashboard/notes/${data.id}`);
        } catch (error) {
            console.error('Error creating summary note:', error);
            toast({
                title: 'Error creating summary',
                description: 'Could not create the feedback summary. Please try again later.',
                variant: 'destructive',
            });
        } finally {
            setIsSummarizing(false);
        }
    };

    // Generate prep handler
    const handlePrep = async (memberId: string) => {
        if (!user || !memberId) return;

        try {
            setIsGeneratingPrep(true);
            
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // Get the member name
            const member = teamMembers.find(m => m.id === memberId);
            if (!member) throw new Error('Team member not found');
            
            // Create title
            const catTitle = `1:1 Preparation for ${member.full_name} (${new Date().toLocaleDateString()})`;
            
            // Create a new note with subject member ID
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
                    // Add the subject member or invited user ID based on the member type
                    subject_member_id: member.is_invited_user ? null : memberId,
                    subject_invited_id: member.is_invited_user ? memberId : null
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create prep notes');
            }
            
            const data = await response.json();
            
            // Navigate to the editor page where generation will happen automatically
            router.push(`/dashboard/notes/${data.id}`);
        } catch (error) {
            console.error('Error creating prep note:', error);
            toast({
                title: 'Error creating prep notes',
                description: 'Could not create the 1:1 preparation. Please try again later.',
                variant: 'destructive',
            });
        } finally {
            setIsGeneratingPrep(false);
        }
    };

    // Generate review handler
    const handleReview = async (memberId: string) => {
        if (!user || !memberId) return;

        try {
            setIsGeneratingReview(true);
            
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // Get the member name
            const member = teamMembers.find(m => m.id === memberId);
            if (!member) throw new Error('Team member not found');
            
            // Create title
            const catTitle = `Review Prep for ${member.full_name} (${new Date().toLocaleDateString()})`;
            
            // Create a new note with subject member ID
            const response = await fetch('/api/notes/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    title: catTitle,
                    content_type: 'review',
                    metadata: { timeframe: 'all' }, //need to update
                    // Add the subject member or invited user ID based on the member type
                    subject_member_id: member.is_invited_user ? null : memberId,
                    subject_invited_id: member.is_invited_user ? memberId : null
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create prep notes');
            }
            
            const data = await response.json();
            
            // Navigate to the editor page where generation will happen automatically
            router.push(`/dashboard/notes/${data.id}`);
        } catch (error) {
            console.error('Error creating prep note:', error);
            toast({
                title: 'Error creating prep notes',
                description: 'Could not create the review preparation. Please try again later.',
                variant: 'destructive',
            });
        } finally {
            setIsGeneratingPrep(false);
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

    // Get a preview of the content
    const getContentPreview = (content: string) => {
        if (!content) return '';
        const plainText = stripHtml(content);
        return plainText.length > 160 ? plainText.substring(0, 160) + '...' : plainText;
    };

    // Content preview component with gradient fade
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
            return '1:1 Prep';
        }
        if (note.content_type === 'review') {
            return 'Review Prep';
        }
        return 'Note';
    };

    // Find team member name by ID
    const getMemberName = (note: Note) => {
        const memberId = note.subject_member_id || note.subject_invited_id;
        if (!memberId) return 'Unknown';
        
        const member = teamMembers.find(m => m.id === memberId);
        return member ? member.full_name : 'Unknown';
    };

    // Handle clicking on a note
    const handleNoteClick = (note: Note) => {
        router.push(`/dashboard/notes/${note.id}`);
    };

    // Load data when the component mounts
    useEffect(() => {
    fetchTeamMembers();
    fetchManagerNotes();
}, [fetchTeamMembers, fetchManagerNotes]);

    return (
        <div className="container mx-auto px-4 py-6">
            <div className='flex items-center justify-between mb-8'>
                <h2 className='text-4xl font-light text-berkeleyblue mb-6'>Team Feedback Coach</h2>
                <div className="flex items-center gap-4">
                    {/* Team Member Filter in Header */}
                    {teamMembers.length > 0 && (
                        <div className="flex items-center">
                            <Select
                                value={selectedMember}
                                onValueChange={filterNotesByMember}
                            >
                                <SelectTrigger className="w-[240px]">
                                    <SelectValue placeholder="Filter by team member" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Team Members</SelectItem>
                                    {teamMembers.map(member => (
                                        <SelectItem key={member.id} value={member.id}>
                                            {member.full_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <Button
                        variant="outline"
                        className="flex items-center gap-2"
                        onClick={() => router.push('/dashboard/coach')}
                    >
                        <UserCircle className="h-5 w-5 text-cerulean-400" />
                        Personal View
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cerulean-500"></div>
                </div>
            ) : (
                <>
                    {teamMembers.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-md p-6 text-center">
                            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-medium text-gray-700 mb-2">No Team Members Found</h3>
                            <p className="text-gray-500">You don&apos;t have any team members assigned to you yet.</p>
                        </div>
                    ) : (
                        <>
                            {/* Recent Activity Section */}
                            {recentNotes.length > 0 && (
                                <div className="mb-10">
                                    <h2 className='text-2xl font-light text-berkeleyblue mb-4'>
                                        {selectedMember === 'all' 
                                            ? 'Recently Updated' 
                                            : `Recently Updated for ${teamMembers.find(m => m.id === selectedMember)?.full_name}`}
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        {recentNotes.map(note => (
                                            <div 
                                                key={note.id}
                                                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-100 overflow-hidden cursor-pointer h-[225px] flex flex-col"
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
                                                    <div className="mb-1 flex items-center">
                                                        <UserCircle className="h-4 w-4 text-gray-400 mr-1" />
                                                        <span className="text-xs text-gray-500">{getMemberName(note)}</span>
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

                            {/* Generate New Notes */}
                            {selectedMember !== 'all' && (
                                <div className="mb-4">
                                    <h2 className='text-2xl font-light text-berkeleyblue mb-4'>Generate New</h2>
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
                                                            <div className="text-sm text-gray-500 truncate">
                                                                Analyze feedback for {teamMembers.find(m => m.id === selectedMember)?.full_name}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Plus className="h-5 w-5 text-cerulean" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56">
                                                <DropdownMenuItem 
                                                    onClick={() => handleSummarizeFeedback(selectedMember, 'week')} 
                                                    className="cursor-pointer"
                                                    disabled={isSummarizing}
                                                >
                                                    {isSummarizing ? 'Checking feedback...' : 'Last Week\'s Feedback'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onClick={() => handleSummarizeFeedback(selectedMember, 'month')} 
                                                    className="cursor-pointer"
                                                    disabled={isSummarizing}
                                                >
                                                    {isSummarizing ? 'Checking feedback...' : 'Last Month\'s Feedback'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onClick={() => handleSummarizeFeedback(selectedMember, 'all')} 
                                                    className="cursor-pointer"
                                                    disabled={isSummarizing}
                                                >
                                                    {isSummarizing ? 'Checking feedback...' : 'All Feedback'}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <Button 
                                            variant="secondary" 
                                            className="w-full flex items-center justify-between px-4 py-12 text-left"
                                            onClick={() => handlePrep(selectedMember)}
                                            disabled={isGeneratingPrep}
                                        >
                                            <div className="flex items-center">
                                                <NotepadText className="h-7 w-7 text-cerulean-400 mr-4" />
                                                <div>
                                                    <div className="font-light text-lg text-cerulean">1:1 Preparation</div>
                                                    <div className="text-sm text-gray-500 truncate">
                                                        Prepare for 1:1 with {teamMembers.find(m => m.id === selectedMember)?.full_name}
                                                    </div>
                                                </div>
                                            </div>
                                            <Plus className="h-5 w-5 text-cerulean" />
                                        </Button>

                                        <Button 
                                            variant="secondary" 
                                            className="w-full flex items-center justify-between px-4 py-12 text-left"
                                            onClick={() => handleReview(selectedMember)}
                                            disabled={isGeneratingReview}
                                        >
                                            <div className="flex items-center">
                                                <NotebookPen className="h-7 w-7 text-cerulean-400 mr-4" />
                                                <div>
                                                    <div className="font-light text-lg text-cerulean">Review Preparation</div>
                                                    <div className="text-sm text-gray-500 truncate">
                                                        Prepare for {teamMembers.find(m => m.id === selectedMember)?.full_name}&apos;s performance review
                                                    </div>
                                                </div>
                                            </div>
                                            <Plus className="h-5 w-5 text-cerulean" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Notes List */}
                            <div className="mb-8">
                                {selectedMember === 'all' &&
                                    <h2 className='text-2xl font-light text-berkeleyblue mb-4'>All Team Notes</h2>
                                }
                                <div className='rounded-lg bg-white shadow-md border border-gray-100'>
                                    {filteredNotes.length > 0 ? (
                                        <>
                                            {filteredNotes.map((note, index) => (
                                                <div 
                                                    key={note.id}
                                                    className={`px-6 py-4 hover:bg-slate-50 cursor-pointer ${index !== 0 ? 'border-t border-gray-100' : ''}`}
                                                    onClick={() => handleNoteClick(note)}
                                                >
                                                    {selectedMember === 'all' && (
                                                        <div className="mt-1 mb-2 flex items-center">
                                                            <UserCircle className="h-4 w-4 text-gray-400 mr-1" />
                                                            <span className="text-xs text-gray-500">{getMemberName(note)}</span>
                                                        </div>
                                                    )}
                                                    <div className='flex items-center justify-between w-full'>
                                                        <div className='flex items-center'>
                                                            {note.content_type === 'summary' && (
                                                                <Sparkles className="h-5 w-5 text-cerulean-400 mr-2" />
                                                            )}
                                                            {note.content_type === 'prep' && (
                                                                <NotepadText className="h-5 w-5 text-cerulean-400 mr-2" />
                                                                
                                                            )}
                                                            {note.content_type === 'review' && (
                                                                <NotebookPen className="h-5 w-5 text-cerulean-400 mr-2" />
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
                                            <p className="text-gray-500">
                                                {selectedMember === 'all' 
                                                    ? "You haven't created any notes for your team yet." 
                                                    : `You haven't created any notes for ${teamMembers.find(m => m.id === selectedMember)?.full_name} yet.`}
                                            </p>
                                            {selectedMember !== 'all' && (
                                                <p className="text-sm text-gray-400 mt-2">
                                                    Use the options above to generate a new note.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

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