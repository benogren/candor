// src/app/dashboard/manager/feedback/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { LoadingSpinner } from '@/components/loading-spinner';
import FeedbackList from '@/components/FeedbackList';
import supabase from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { redirect } from "next/navigation";
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Users, UserCircle } from 'lucide-react';
import { radley } from '../../../fonts';
import Link from 'next/link';

// Type for team member (matching the coach page)
interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  is_invited_user: boolean;
}

export default function ManagerFeedbackPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedEmployee] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  
  // Fetch team members (direct reports) - using the same logic as coach page
  const fetchTeamMembers = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Get direct reports from org_structure view
      const { data: directReports, error: reportsError } = await supabase
        .from('org_structure')
        .select('id, email, is_invited')
        .eq('manager_id', user.id);
        
      if (reportsError) throw reportsError;
      
      if (!directReports || directReports.length === 0) {
        setIsManager(false);
        setTeamMembers([]);
        setLoading(false);
        return;
      }
      
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
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your team members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  // Load team members when component mounts
  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);
  
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
    <div className="container mx-auto px-4">
      {!isManager ? (
        redirect('/dashboard')
      ) : (
        <>
          <div className='bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center'>
                <div className='bg-berkeleyblue rounded-md p-2 mr-4 items-center'>
                  <Users className="h-12 w-12 text-berkeleyblue-100" />
                </div>
                <div>
                  <h2 className={`text-4xl font-light text-berkeleyblue ${radley.className}`}>My Team</h2>
                  <p className='text-berkeleyblue-300'>
                    Feedback for: All Team Members
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="default">
                      All Team Members
                      <ChevronDown className="h-5 w-5 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className='w-full'>
                    {teamMembers.map(member => (
                      <DropdownMenuItem className='w-full' key={member.id}>
                        <Link 
                          key={member.id} 
                          href={`/dashboard/manager/feedback/${member.id}`}
                          className="w-full"
                        >
                          {member.full_name}
                          {member.is_invited_user && " (Invited)"}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="secondary"
                  className="flex items-center gap-2"
                  onClick={() => router.push('/dashboard/')}
                >
                  <UserCircle className="h-5 w-5 text-cerulean-400" />
                  Personal View
                </Button>
              </div>
            </div>
          </div>

          <div>
            <FeedbackList 
              employeeId={selectedEmployee !== 'all' ? selectedEmployee : undefined} 
              managerId={user?.id} 
            />
          </div>
        </>
      )}
    </div>
  );
}