'use client';

import { useState, useEffect } from 'react';
import supabase from '@/lib/supabase/client';
import { useAuth } from '@/lib/context/auth-context';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
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
import { AlertCircle, CheckCircle, RefreshCw, XCircle } from 'lucide-react';

interface Member {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  status: 'pending' | 'active' | 'deactivated';
  created_at: string;
}

export default function MemberManagementPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const { refreshStatus } = useAuth();

  useEffect(() => {
    fetchMembers().catch(err => {
      console.error("Error in useEffect fetch:", err);
    });
  }, []);

  async function fetchMembers() {
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
      
      const companyId = memberResponse.data.company_id;
      
      // Step 3: Get company members
      const membersResponse = await supabase
        .from('company_members')
        .select(`
          id,
          role,
          status,
          created_at
        `)
        .eq('company_id', companyId);
      
      if (membersResponse.error) {
        throw new Error(`Failed to fetch members: ${membersResponse.error.message}`);
      }
      
      if (!membersResponse.data || membersResponse.data.length === 0) {
        setMembers([]);
        return;
      }
      
      // Try to get profiles for each member
      const memberProfiles: Member[] = [];
      
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
            role: member.role,
            status: member.status || 'pending',
            created_at: member.created_at
          });
        } catch (profileError) {
          console.warn(`Couldn't fetch profile for user ${member.id}:`, profileError);
          
          memberProfiles.push({
            id: member.id,
            email: 'Profile fetch error',
            name: 'Unknown User',
            role: member.role,
            status: member.status || 'pending',
            created_at: member.created_at
          });
        }
      }
      
      setMembers(memberProfiles);
      
    } catch (error) {
      console.error('Error in fetchMembers:', error);
      
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
        title: 'Failed to load members',
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
            ? { ...member, status: 'active' } 
            : member
        )
      );
      
      // Then refresh the list
      await fetchMembers();
      
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
            ? { ...member, status: 'deactivated' } 
            : member
        )
      );
      
      // Then refresh the list
      await fetchMembers();
      
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

  function getStatusBadge(status: string) {
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Manage your team members and their access to Candor.
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchMembers()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
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
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map(member => (
                <TableRow key={member.id} className={member.status === 'deactivated' ? 'opacity-70' : ''}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell className="capitalize">{member.role}</TableCell>
                  <TableCell>
                    {getStatusBadge(member.status)}
                  </TableCell>
                  <TableCell>{new Date(member.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {member.status === 'pending' ? (
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
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-gray-500">
                    No team members found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}