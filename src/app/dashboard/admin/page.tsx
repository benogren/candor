'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import supabase from '@/lib/supabase/client'; 
import MemberManagementPanel from '@/components/MemberManagementPanel';

export default function TeamManagementPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
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

          const { data: FetchCompanyName, error } = await supabase
          .from('companies')
          .select()
          .eq('id', data.company_id)
          .single();

          setCompanyName(FetchCompanyName.name);
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
        <h2 className='text-4xl font-light text-berkeleyblue'>
          Manage: <strong className='font-medium' id={companyId ?? undefined}>{companyName}</strong>
        </h2>
      </div>

      <MemberManagementPanel key={refreshKey} />

    </div>
  );
}