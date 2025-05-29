'use client';

import { useState, useEffect } from 'react';
import { useAuth, useIsAdmin } from '@/lib/context/auth-context';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import FeedbackList from '@/components/FeedbackList';
import { LoadingSpinner } from '@/components/loading-spinner';
import { ProfileModal } from '@/components/ProfileModal';
import supabase from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { 
  ArrowRight, 
  BotMessageSquareIcon, 
  Building2, 
  Home, 
  NotebookPen, 
  NotepadText, 
  Sparkles, 
  ChevronDown,
  UserCircle
} from 'lucide-react';
import { radley } from '../fonts';
import { Badge } from '@/components/ui/badge';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Type for team member
interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  is_invited_user: boolean;
}

// Type for notes data
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

export default function DashboardPage() {
  const { user, memberStatus } = useAuth();
  const fullName = user?.user_metadata?.name || '';
  const firstName = fullName.split(' ')[0] || '';
  const router = useRouter();
  const { isAdmin } = useIsAdmin();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'personal' | 'team'>('personal');
  
  // Team-related state
  const [isManager, setIsManager] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  
  // Feedback cycle state
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

  // State for notes data
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [personalNotes, setPersonalNotes] = useState<Note[]>([]);
  const [teamNotes, setTeamNotes] = useState<Note[]>([]);

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

  // Initialize dashboard - fetch team members and determine manager status
  useEffect(() => {
    if (!user) return;
    
    const initializeDashboard = async () => {
      try {
        setLoading(true);
        
        // Fetch team members to determine if user is a manager
        const { data: directReports, error: reportsError } = await supabase
          .from('org_structure')
          .select('id, email, is_invited')
          .eq('manager_id', user.id);
          
        if (reportsError) throw reportsError;
        
        if (!directReports || directReports.length === 0) {
          setIsManager(false);
          setTeamMembers([]);
        } else {
          setIsManager(true);
          
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
              full_name: user.name || user.email.split('@')[0] || 'Unknown',
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
              full_name: user.name || user.email.split('@')[0] || 'Unknown',
              email: user.email,
              is_invited_user: true
            })) || [];
            
            members = [...members, ...invitedMembers];
          }
          
          // Sort alphabetically by name
          members.sort((a, b) => a.full_name.localeCompare(b.full_name));
          
          setTeamMembers(members);
        }
      } catch (error) {
        console.error('Error initializing dashboard:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your team members',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    initializeDashboard();
  }, [user]);

  // Fetch notes data after team data is loaded
  useEffect(() => {
    if (!user) return;
    
    const fetchNotesData = async () => {
      try {
        // Always fetch personal notes
        console.log('Fetching personal notes for user:', user.id);
        const { data: personalData, error: personalError } = await supabase
          .from('notes')
          .select('*')
          .eq('creator_id', user.id)
          .is('subject_member_id', null)   // Only get personal notes
          .is('subject_invited_id', null)  // Only get personal notes
          .order('updated_at', { ascending: false })
          .limit(10);  // Get more to see if there are any notes at all

        if (personalError) throw personalError;
        
        console.log('Personal notes fetched:', personalData);
        if (personalData) {
          setPersonalNotes(personalData);
        }
        
        // Fetch team notes if user is a manager
        if (isManager) {
          console.log('Fetching team notes for user:', user.id);
          // Fetch notes where the user is the creator and has a subject_member_id or subject_invited_id
          const { data, error } = await supabase
            .from('notes')
            .select('*')
            .eq('creator_id', user.id)
            .not('subject_member_id', 'is', null)
            .order('updated_at', { ascending: false });

          if (error) throw error;
          
          // Also fetch notes with subject_invited_id
          const { data: invitedData, error: invitedError } = await supabase
            .from('notes')
            .select('*')
            .eq('creator_id', user.id)
            .not('subject_invited_id', 'is', null)
            .order('updated_at', { ascending: false });

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
          
          console.log('Team notes fetched:', uniqueNotes);
          setTeamNotes(uniqueNotes);
        }
      } catch (error) {
        console.error('Error fetching notes:', error);
      }
    };
    
    fetchNotesData();
  }, [user, isManager]);

  // Update recent notes when tab or filter changes
  useEffect(() => {
    console.log('Updating recent notes. Active tab:', activeTab, 'Selected employee:', selectedEmployee);
    console.log('Personal notes:', personalNotes.length, 'Team notes:', teamNotes.length);
    
    if (activeTab === 'personal') {
      console.log('Setting recent notes to personal notes:', personalNotes.slice(0, 3));
      setRecentNotes(personalNotes.slice(0, 3));
    } else {
      // Team tab
      if (selectedEmployee === 'all') {
        // Show all team notes (limit to 3 most recent)
        console.log('Setting recent notes to all team notes:', teamNotes.slice(0, 3));
        setRecentNotes(teamNotes.slice(0, 3));
      } else {
        // Filter by selected employee
        const member = teamMembers.find(m => m.id === selectedEmployee);
        if (member) {
          const filtered = teamNotes.filter(note => {
            if (member.is_invited_user) {
              return note.subject_invited_id === selectedEmployee;
            } else {
              return note.subject_member_id === selectedEmployee;
            }
          });
          console.log('Setting recent notes to filtered notes for', member.full_name, ':', filtered.slice(0, 3));
          setRecentNotes(filtered.slice(0, 3));
        } else {
          console.log('No member found for selectedEmployee:', selectedEmployee);
          setRecentNotes([]);
        }
      }
    }
  }, [activeTab, selectedEmployee, personalNotes, teamNotes, teamMembers]);

  // Separate useEffect for feedback cycle status
  useEffect(() => {
    if (!user) return;
    
    const checkFeedbackStatus = async () => {
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
          
        if (cycleError) {
          console.log('No active feedback cycle found');
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

  // Get the selected employee name for display
  const getSelectedEmployeeName = () => {
    if (selectedEmployee === 'all') return 'All Team Members';
    const employee = teamMembers.find(member => member.id === selectedEmployee);
    return employee ? employee.full_name + (employee.is_invited_user ? ' (Invited)' : '') : 'All Team Members';
  };

  // Helper function to safely strip HTML for previews
  // const stripHtml = (html: string) => {
  //   if (!html) return '';
    
  //   try {
  //     // For browser environments
  //     if (typeof window !== 'undefined') {
  //       const doc = new DOMParser().parseFromString(html, 'text/html');
  //       return doc.body.textContent || '';
  //     } 
  //     // Fallback for SSR
  //     return html.replace(/<[^>]*>?/gm, ' ')
  //       .replace(/\s+/g, ' ')
  //       .trim();
  //   } catch {
  //     // Fallback if parsing fails
  //     return html.replace(/<[^>]*>?/gm, ' ')
  //         .replace(/\s+/g, ' ')
  //         .trim();
  //   }
  // };

  // Format relative time (like "1 day ago")
  const formatRelativeTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      console.log('Error formatting date:', error);
      return 'some time ago';
    }
  };

  // Get a preview of the content (first 160 characters)
  // const getContentPreview = (content: string) => {
  //   if (!content) return '';
  //   const plainText = stripHtml(content);
  //   return plainText.length > 160 ? plainText.substring(0, 160) + '...' : plainText;
  // };

  // // Get note type display label
  // const getNoteTypeLabel = (note: Note) => {
  //   if (note.content_type === 'summary') {
  //     return 'Feedback Summary';
  //   } 
  //   if (note.content_type === 'prep') {
  //     return '1:1 Prep Notes';
  //   }
  //   if (note.content_type === 'review') {
  //     return 'Self-Evaluation Prep';
  //   }
  //   return 'Note';
  // };

  // Find team member name by ID (for team notes)
  const getMemberName = (note: Note) => {
    const memberId = note.subject_member_id || note.subject_invited_id;
    if (!memberId) return null;
    
    const member = teamMembers.find(m => m.id === memberId);
    return member ? member.full_name : 'Unknown';
  };

  // Handle clicking on a note
  const handleNoteClick = (note: Note) => {
    router.push(`/dashboard/notes/${note.id}`);
  };

  // Handle tab changes
  const handleTabChange = (tab: 'personal' | 'team') => {
    setActiveTab(tab);
    // Reset employee filter when switching to personal tab
    if (tab === 'personal') {
      setSelectedEmployee('all');
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
      
      <div className="container mx-auto">
        <div className='bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center'>
              <div className='bg-cerulean rounded-md p-2 mr-4 items-center'>
                <Home className="h-12 w-12 text-cerulean-100" />
              </div>
              <div>
                <h2 className={`text-4xl font-light text-cerulean ${radley.className}`}>
                  Welcome Back, {firstName}!
                </h2>
                <div className='text-cerulean-300'>
                  Dashboard
                  {isAdmin && (
                    <span className='bg-nonphotoblue-100 text-nonphotoblue-700 text-xs py-1 px-2 rounded-md ml-2'>Admin</span>
                  )}
                  {isManager && (
                    <span className='bg-berkeleyblue-100 text-berkeleyblue text-xs py-1 px-2 rounded-md ml-2'>Manager</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {isAdmin && !activeCycle && (
          <div className='relative overflow-hidden bg-gradient-to-bl from-cerulean-500 via-berkleyblue-500 to-cerulean-700 p-8 rounded-md gap-4 shadow-md mb-4'>
            <Building2 className="h-[400px] w-[400px] text-cerulean-100/10 absolute -bottom-28 -right-6 -rotate-45" />
            <Badge className='bg-cerulean-400 text-cerulean-700 font-semibold mb-2 text-xs py-1 relative z-10'>
              Company Setup
            </Badge>

            <h2 className={`text-4xl font-light text-cerulean-100 max-w-xl mb-4 relative z-10 ${radley.className}`}>
              Hey {firstName}, finish setting up your company!
            </h2>
            <p className='text-cerulean-100 text-base font-light mb-4 max-w-xl relative z-10'>
              You&#39;re a company admin &mdash; manage your company settings, org chart, feedback cycles, and more in your Admin Dashboard.
            </p>
            <Button 
              size="lg"
              variant="outline"
              className="relative z-10"
            >
              <Link href="/dashboard/admin">
              Go to Admin Dashboard
              </Link>
                <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}
        
        {memberStatus === 'pending' && !isAdmin && (
          <div className='relative overflow-hidden bg-gradient-to-bl from-cerulean-500 via-berkleyblue-500 to-cerulean-700 p-8 rounded-md gap-4 shadow-md mb-4'>
            <InfoCircledIcon className="h-[400px] w-[400px] text-cerulean-100/10 absolute -bottom-28 -right-6 -rotate-45" />
            <Badge className='bg-cerulean-400 text-cerulean-700 font-semibold mb-2 text-xs py-1 relative z-10'>
              Account Pending
            </Badge>

            <h2 className={`text-4xl font-light text-cerulean-100 max-w-xl mb-4 relative z-10 ${radley.className}`}>
              Hey {firstName}, your account is pending!
            </h2>
            <p className='text-cerulean-100 text-base font-light mb-4 max-w-xl relative z-10'>
              Your account is waiting for admin approval. Some features may be limited until your account is approved
            </p>
          </div>
        )}

        {needsFeedback && activeTab === 'personal' && (
          <div className='relative overflow-hidden bg-gradient-to-bl from-cerulean-500 via-berkleyblue-500 to-cerulean-700 p-8 rounded-md gap-4 shadow-md mb-4'>
            <Image src="/candor-coach-hero.png" alt="Candor" width={500} height={333} priority className="h-[333px] w-[500px] absolute -bottom-10 -right-2 " />
            <Badge className='bg-cerulean-400 text-cerulean-700 font-semibold mb-2 text-xs py-1 relative z-10'>
              Give Feedback
            </Badge>

            <h2 className={`text-4xl font-light text-cerulean-100 max-w-xl mb-4 relative z-10 ${radley.className}`}>
              Hey {firstName}, {feedbackStarted ? " finish your feedback!": " your teammates are waiting on your feedback!"}
            </h2>
            <p className='text-cerulean-100 text-base font-light mb-4 max-w-xl relative z-10'>
              Feedback is a great way to acknowledge and help your teammates identify their strengths and areas for improvement.
            </p>
            <Button 
              size="lg"
              onClick={inProgressSession ? handleContinueFeedback : handleStartFeedback} 
              variant={inProgressSession ? "default" : "outline"}
              disabled={isButtonLoading}
              className="relative z-10"
            >
              {feedbackStarted
                ? (isButtonLoading ? "Loading..." : "Continue your Feedback")
                : (isButtonLoading ? "Loading..." : "Get Started")}
                <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className='flex items-center justify-between border-b border-gray-200'>
          <div className='flex items-center'>
            <button
              className={cn(
                'px-2 py-4 hover:cursor-pointer border-b-2 transition-colors',
                activeTab === 'personal' 
                  ? 'border-cerulean-500 text-cerulean' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
              onClick={() => handleTabChange('personal')}
            >
              My Feedback
            </button>
            {isManager && (
              <button
                className={cn(
                  'px-2 py-4 hover:cursor-pointer border-b-2 transition-colors mx-4',
                  activeTab === 'team' 
                    ? 'border-berkeleyblue text-berkeleyblue' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
                onClick={() => handleTabChange('team')}
              >
                My Team&apos;s Feedback
              </button>
            )}
          </div>
          
          {/* Employee dropdown - only show on team tab */}
          {activeTab === 'team' && (
            <div className="py-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="default">
                    {getSelectedEmployeeName()}
                    <ChevronDown className="h-5 w-5 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className='w-full'>
                  <DropdownMenuItem onClick={() => setSelectedEmployee('all')}>
                    All Team Members
                  </DropdownMenuItem>
                  {teamMembers.map(member => (
                    <DropdownMenuItem 
                      key={member.id} 
                      onClick={() => setSelectedEmployee(member.id)}
                    >
                      {member.full_name}
                      {member.is_invited_user && " (Invited)"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <div className='grid grid-cols-3 gap-4'>
          <div className='col-span-2 mt-10'>
            <h2 className='text-2xl font-light text-berkeleyblue mb-4'>
              {activeTab === 'personal' ? 'Your Recent Feedback' : 'Recent Team Feedback'}
            </h2>
            
            {activeTab === 'personal' ? (
              <FeedbackList userId={user?.id} />
            ) : (
              <FeedbackList 
                employeeId={selectedEmployee !== 'all' ? selectedEmployee : undefined} 
                managerId={user?.id} 
              />
            )}
          </div>
          
          <div className='mt-10'>

            <div className='bg-white rounded-lg shadow-md p-6 mb-8'>
              <h2 className='text-xl font-light text-berkeleyblue mb-4'>
                <BotMessageSquareIcon className="inline-block h-6 w-6 mr-2 text-cerulean-400" />
                Feedback Coach
              </h2>
              <Button 
                variant="secondary" 
                className="w-full flex items-center justify-between py-6 text-left mb-2"
                onClick={() => router.push('/dashboard/coach')}
              >
                <div className='flex items-center gap-2'>
                <Sparkles className="h-5 w-5 text-cerulean-400" />
                Generate Summary
                </div>
              </Button>
              <Button 
                variant="secondary" 
                className="w-full flex items-center justify-between py-6 text-left mb-2"
                onClick={() => router.push('/dashboard/coach')}
              >
                <div className='flex items-center gap-2'>
                <NotepadText className="h-5 w-5 text-cerulean-400" />
                1:1 Preparation
                </div>
              </Button>
              <Button 
                variant="secondary" 
                className="w-full flex items-center justify-between py-6 text-left"
                onClick={() => router.push('/dashboard/coach')}
              >
                <div className='flex items-center gap-2'>
                <NotebookPen className="h-5 w-5 text-cerulean-400" />
                Self-Evaluation Preparation
                </div>
              </Button>
            </div>

            {/* Recent Activity Section */}
            {recentNotes.length > 0 && (
              <div className='bg-white rounded-lg shadow-md p-6 mb-8'>
                <h2 className='text-xl font-light text-berkeleyblue mb-4'>
                  <BotMessageSquareIcon className="inline-block h-6 w-6 mr-2 text-cerulean-400" />
                  Recently Updated
                </h2>
                <div className="space-y-3">
                  {recentNotes.map(note => {
                    const memberName = getMemberName(note);
                    return (
                      <div 
                        key={note.id}
                        className="overflow-hidden cursor-pointer"
                        onClick={() => handleNoteClick(note)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center min-w-0 flex-1 mt-2">
                            {note.content_type === 'summary' && (
                              <Sparkles className="h-5 w-5 text-cerulean-400 mr-2 flex-shrink-0" />
                            )}
                            {note.content_type === 'prep' && (
                              <NotepadText className="h-5 w-5 text-cerulean-400 mr-2 flex-shrink-0" />
                            )}
                            {note.content_type === 'review' && (
                              <NotebookPen className="h-5 w-5 text-cerulean-400 mr-2 flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium text-gray-900 truncate text-sm">{note.title}</h4>
                            </div>
                          </div>
                          
                        </div>
                          <div className='flex items-center justify-between text-gray-500 text-xs mt-1'>
                            {memberName && activeTab === 'team' && (
                              <div className="flex items-center mt-1">
                                <UserCircle className="h-3 w-3 text-gray-400 mr-1" />
                                <span className="text-xs text-gray-500">{memberName}</span>
                              </div>
                            )}
                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                              {formatRelativeTime(note.updated_at)}
                            </span>
                          </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state for no recent notes */}
            {recentNotes.length === 0 && (
              <div className='bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100'>
                <h2 className='text-xl font-light text-berkeleyblue mb-4'>
                  <BotMessageSquareIcon className="inline-block h-6 w-6 mr-2 text-cerulean-400" />
                  Recently Updated
                </h2>
                <div className="text-center">
                  <p className="text-gray-500 text-sm">
                    {activeTab === 'personal' 
                      ? "You haven't created any notes yet." 
                      : selectedEmployee === 'all'
                        ? "No team notes created yet."
                        : `No notes created for ${getSelectedEmployeeName()} yet.`}
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4 w-full"
                    onClick={() => router.push('/dashboard/coach/manager')}
                  >
                    Create a Note
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}