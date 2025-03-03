'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import supabase from '@/lib/supabase/client'; 
import MemberManagementPanel from '@/components/MemberManagementPanel';
import InviteUsersModal from '@/components/InviteUsersModal';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

export default function TeamManagementPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        if (data) {
          setCompanyId(data.company_id);
        }
      } catch (error) {
        console.error('Error fetching company ID:', error);
      }
    };

    fetchCompanyId();
  }, [user]);

  const handleRefreshMembers = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h1 className="text-3xl font-bold">Team Management</h1>
        <Button 
          onClick={() => setIsInviteModalOpen(true)} 
          className="mt-4 sm:mt-0"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Users
        </Button>
      </div>

      <MemberManagementPanel key={refreshKey} />

      {companyId && (
        <InviteUsersModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          companyId={companyId}
          onSuccess={handleRefreshMembers}
        />
      )}
    </div>
  );
}