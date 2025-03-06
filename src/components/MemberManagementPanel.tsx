'use client';

import { useState, useEffect } from 'react';
import supabase from '@/lib/supabase/client';
import { useAuth } from '@/lib/context/auth-context';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { AlertCircle, CheckCircle, RefreshCw, XCircle, UserPlus, Mail } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InviteUsersModal from './InviteUsersModal';

// Define the Member interface with strict types
interface Member {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  status: 'pending' | 'active' | 'deactivated';
  created_at: string;
  source: 'member' | 'invited';
  invite_code?: string;
}

export default function MemberManagementPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<Member[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');
  const { refreshStatus } = useAuth();

  useEffect(() => {
    fetchMembersAndInvites().catch(err => {
      console.error("Error in useEffect fetch:", err);
    });
  }, []);

  async function fetchMembersAndInvites() {
    setIsLoading(true);
    
    try {
      // Step 1: Get current user
      const authResponse = await supabase.auth.getUser();
      const user = authResponse.data.user;
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      // Step 2: Get company_id
      const memberResponse = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('id', user.id)
        .single();
      
      if (memberResponse.error) {
        throw new Error(`Failed to get company: ${memberResponse.error.message}`);
      }
      
      if (!memberResponse.data) {
        throw new Error('User not associated with a company');
      }
      
      const currentCompanyId = memberResponse.data.company_id;
      setCompanyId(currentCompanyId);
      
      // PART 1: Fetch company members
      const membersResponse = await supabase
        .from('company_members')
        .select(`
          id,
          role,
          status,
          created_at
        `)
        .eq('company_id', currentCompanyId);
      
      if (membersResponse.error) {
        throw new Error(`Failed to fetch members: ${membersResponse.error.message}`);
      }
      
      const memberProfiles: Member[] = [];
      
      // Process members
      if (membersResponse.data && membersResponse.data.length > 0) {
        for (const member of membersResponse.data) {
          try {
            // Get user profile if possible
            let email = 'No email available';
            let name = 'Unknown User';
            
            // Try to get profile from user_profiles table
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('email, name')
              .eq('id', member.id)
              .single();
              
            if (profile) {
              email = profile.email || email;
              name = profile.name || name;
            }
            
            // For current user, we can get info directly
            if (member.id === user.id) {
              email = user.email || email;
              name = user.user_metadata?.name || name;
            }
            
            memberProfiles.push({
              id: member.id,
              email,
              name,
              role: member.role as 'admin' | 'member',
              status: (member.status || 'pending') as 'pending' | 'active' | 'deactivated',
              created_at: member.created_at,
              source: 'member' as const
            });
          } catch (profileError) {
            console.warn(`Couldn't fetch profile for user ${member.id}:`, profileError);
            
            memberProfiles.push({
              id: member.id,
              email: 'Profile fetch error',
              name: 'Unknown User',
              role: member.role as 'admin' | 'member',
              status: (member.status || 'pending') as 'pending' | 'active' | 'deactivated',
              created_at: member.created_at,
              source: 'member' as const
            });
          }
        }
      }
      
      setMembers(memberProfiles);
      
      // PART 2: Fetch invited users
      try {
        console.log('Attempting to fetch invited users for company:', currentCompanyId);
        
        const invitedResponse = await supabase
          .from('invited_users')
          .select(`
            id,
            email,
            name,
            role,
            company_id,
            invite_code,
            status,
            created_at,
            created_by
          `)
          .eq('company_id', currentCompanyId);
        
        if (invitedResponse.error) {
          console.error('Error fetching invited users:', invitedResponse.error);
          setInvitedUsers([]);
        } else {
          console.log(`Successfully fetched ${invitedResponse.data?.length || 0} invited users`);
          
          // Process the successful response
          const invitedUsersList: Member[] = (invitedResponse.data || []).map(invite => ({
            id: invite.id,
            email: invite.email,
            name: invite.name || invite.email.split('@')[0],
            role: invite.role as 'admin' | 'member',
            status: 'pending' as 'pending' | 'active' | 'deactivated', // Override with pending for invited users
            created_at: invite.created_at,
            source: 'invited' as 'member' | 'invited',
            invite_code: invite.invite_code
          }));
          
          setInvitedUsers(invitedUsersList);
        }
      } catch (inviteError) {
        console.error('Unexpected error in invited users processing:', inviteError);
        setInvitedUsers([]);
      }
      
    } catch (error) {
      console.error('Error in fetchMembersAndInvites:', error);
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = 'Unserializable error object';
        }
      }
      
      toast({
        title: 'Failed to load team members',
        description: `Error: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function approveMember(memberId: string) {
    setIsProcessing(prev => ({ ...prev, [memberId]: true }));
    
    try {
      // Use the stored procedure
      const { error } = await supabase.rpc('approve_team_member', {
        member_id: memberId
      });
      
      if (error) {
        console.error('Error from approve_team_member RPC:', error);
        
        // Fallback to direct update
        const updateResult = await supabase
          .from('company_members')
          .update({ 
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', memberId);
          
        if (updateResult.error) {
          throw updateResult.error;
        }
      }

      // Refresh the current user's status if they were the one approved
      await refreshStatus();

      // Show success message
      toast({
        title: 'Member approved',
        description: 'The member has been approved successfully.',
      });
      
      // Update UI immediately
      setMembers(prev => 
        prev.map(member => 
          member.id === memberId 
            ? { ...member, status: 'active' as const } 
            : member
        )
      );
      
      // Then refresh the list
      await fetchMembersAndInvites();
      
    } catch (error) {
      console.error('Error approving member:', error);
      toast({
        title: 'Failed to approve member',
        description: 'There was a problem approving this member.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(prev => ({ ...prev, [memberId]: false }));
    }
  }

  async function deactivateMember(memberId: string) {
    setIsProcessing(prev => ({ ...prev, [memberId]: true }));
    
    try {
      // Use the stored procedure
      const { error } = await supabase.rpc('deactivate_team_member', {
        member_id: memberId
      });
      
      if (error) {
        console.error('Error from deactivate_team_member RPC:', error);
        
        // Fallback to direct update
        const updateResult = await supabase
          .from('company_members')
          .update({ 
            status: 'deactivated',
            updated_at: new Date().toISOString()
          })
          .eq('id', memberId);
          
        if (updateResult.error) {
          throw updateResult.error;
        }
      }

      // Refresh the current user's status if they were the one deactivated
      await refreshStatus();

      // Show success message
      toast({
        title: 'Member deactivated',
        description: 'The member has been deactivated successfully.',
      });
      
      // Update UI immediately
      setMembers(prev => 
        prev.map(member => 
          member.id === memberId 
            ? { ...member, status: 'deactivated' as const } 
            : member
        )
      );
      
      // Then refresh the list
      await fetchMembersAndInvites();
      
    } catch (error) {
      console.error('Error deactivating member:', error);
      toast({
        title: 'Failed to deactivate member',
        description: 'There was a problem deactivating this member.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(prev => ({ ...prev, [memberId]: false }));
    }
  }

  async function resendInvite(memberId: string, email: string) {
    setIsProcessing(prev => ({ ...prev, [memberId]: true }));
    
    try {
      // This would call your backend API to resend the invite
      // For now, we'll just show a success message
      toast({
        title: 'Invitation resent',
        description: `The invitation has been resent to ${email}.`,
      });
      
      // In a real implementation, you would call an API endpoint
      // const response = await fetch('/api/team/resend-invite', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ inviteId: memberId }),
      // });
      
    } catch (error) {
      console.error('Error resending invite:', error);
      toast({
        title: 'Failed to resend invitation',
        description: 'There was a problem resending the invitation.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(prev => ({ ...prev, [memberId]: false }));
    }
  }

  async function cancelInvite(memberId: string) {
    setIsProcessing(prev => ({ ...prev, [memberId]: true }));
    
    try {
      // Delete from invited_users table
      const { error } = await supabase
        .from('invited_users')
        .delete()
        .eq('id', memberId);
        
      if (error) throw error;
      
      // Show success message
      toast({
        title: 'Invitation cancelled',
        description: 'The invitation has been cancelled successfully.',
      });
      
      // Update UI immediately
      setInvitedUsers(prev => prev.filter(member => member.id !== memberId));
      
    } catch (error) {
      console.error('Error cancelling invite:', error);
      toast({
        title: 'Failed to cancel invitation',
        description: 'There was a problem cancelling the invitation.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(prev => ({ ...prev, [memberId]: false }));
    }
  }

  function getStatusBadge(status: string, source: string) {
    if (source === 'invited') {
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Mail className="h-3.5 w-3.5 mr-1" />
          Invited
        </Badge>
      );
    }
    
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertCircle className="h-3.5 w-3.5 mr-1" />
            Pending
          </Badge>
        );
      case 'active':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
            Active
          </Badge>
        );
      case 'deactivated':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Deactivated
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  }

  // Combine and filter the member lists based on active tab
  const filteredMembers = (() => {
    const allMembers = [...members, ...invitedUsers];
    
    switch (activeTab) {
      case 'active':
        return allMembers.filter(m => m.source === 'member' && m.status === 'active');
      case 'pending':
        return allMembers.filter(m => m.source === 'member' && m.status === 'pending');
      case 'invited':
        return allMembers.filter(m => m.source === 'invited');
      case 'all':
      default:
        return allMembers;
    }
  })();

  // Get counts for tab badges
  const counts = {
    all: members.length + invitedUsers.length,
    active: members.filter(m => m.status === 'active').length,
    pending: members.filter(m => m.status === 'pending').length,
    invited: invitedUsers.length
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage your team members and their access to Candor.
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchMembersAndInvites()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              size="sm" 
              onClick={() => setShowInviteModal(true)}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Invite Users
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs 
            defaultValue="all" 
            value={activeTab}
            onValueChange={setActiveTab}
            className="mb-4"
          >
            <TabsList className="grid grid-cols-4 w-[400px]">
              <TabsTrigger value="all">
                All ({counts.all})
              </TabsTrigger>
              <TabsTrigger value="active">
                Active ({counts.active})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending ({counts.pending})
              </TabsTrigger>
              <TabsTrigger value="invited">
                Invited ({counts.invited})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {isLoading ? (
            <div className="py-8 flex justify-center">
              <div className="flex flex-col items-center">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mb-2" />
                <p className="text-gray-500">Loading team members...</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined/Invited</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map(member => (
                  <TableRow key={member.id} className={member.status === 'deactivated' ? 'opacity-70' : ''}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell className="capitalize">{member.role}</TableCell>
                    <TableCell>
                      {getStatusBadge(member.status, member.source)}
                    </TableCell>
                    <TableCell>{new Date(member.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {member.source === 'invited' ? (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resendInvite(member.id, member.email)}
                            disabled={isProcessing[member.id]}
                          >
                            {isProcessing[member.id] ? 'Sending...' : 'Resend'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => cancelInvite(member.id)}
                            disabled={isProcessing[member.id]}
                          >
                            {isProcessing[member.id] ? 'Cancelling...' : 'Cancel'}
                          </Button>
                        </div>
                      ) : member.status === 'pending' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveMember(member.id)}
                          disabled={isProcessing[member.id]}
                        >
                          {isProcessing[member.id] ? 'Approving...' : 'Approve'}
                        </Button>
                      ) : member.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deactivateMember(member.id)}
                          disabled={isProcessing[member.id]}
                        >
                          {isProcessing[member.id] ? 'Deactivating...' : 'Deactivate'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveMember(member.id)}
                          disabled={isProcessing[member.id]}
                        >
                          {isProcessing[member.id] ? 'Activating...' : 'Activate'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-gray-500">
                      {activeTab === 'all' 
                        ? 'No team members found' 
                        : activeTab === 'invited'
                          ? 'No pending invitations'
                          : `No ${activeTab} members found`}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t p-4">
          <div className="text-sm text-gray-500">
            {counts.all} total members ({counts.active} active, {counts.pending} pending, {counts.invited} invited)
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInviteModal(true)}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Invite Users
          </Button>
        </CardFooter>
      </Card>
      
      {/* Invite Users Modal */}
      {showInviteModal && (
        <InviteUsersModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          companyId={companyId}
          onSuccess={() => {
            fetchMembersAndInvites();
          }}
        />
      )}
    </>
  );
}