'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import supabase from '@/lib/supabase/client'; 
import MemberManagementPanel from '@/components/MemberManagementPanel';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { CompanyModal } from '@/components/CompanyModal';
import { Button } from '@/components/ui/button';
import { LucideMessageCircleQuestion, Network, Shell } from 'lucide-react';

export default function TeamManagementPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isIndustrySet, setIsIndustrySet] = useState(false);

  const [companyData, setCompanyData] = useState<{
    id: string;
    name: string;
    industry?: string;
    domains?: string[];
  } | null>(null);

  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);

  const handleCompanyUpdate = () => {
    // Refresh company data after update
    if (user && companyData) {
      // First get the company_id for the user
      supabase
        .from('company_members')
        .select('company_id')
        .eq('id', user.id)
        .single()
        .then(({ data: memberData, error: memberError }) => {
          if (!memberError && memberData) {
            // Then get the updated company details
            supabase
              .from('companies')
              .select('id, name, industry, domains')
              .eq('id', memberData.company_id)
              .single()
              .then(({ data: companyDetails, error: companyError }) => {
                if (!companyError && companyDetails) {
                  setCompanyData({
                    id: companyDetails.id,
                    name: companyDetails.name,
                    industry: companyDetails.industry || undefined,
                    domains: companyDetails.domains
                  });
                }
              });
          }
        });
    }
  };

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
          setCompanyData({
            id: FetchCompanyName.id,
            name: FetchCompanyName.name,
            industry: FetchCompanyName.industry || undefined,
            domains: FetchCompanyName.domains
          });
          if (FetchCompanyName.industry) {
            setIsIndustrySet(true);
          }
          if (error) throw error;
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
  console.log('check refresh:', handleRefreshMembers);

  return (
    <>
    {!isIndustrySet && companyData && (
      <div className='container mx-auto py-8 px-4'>
        <div className="mb-6 p-4 bg-pantonered-200 border border-pantonered-500 rounded-md text-sm text-center">
        <p className="text-pantonered-700">
        <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />
          Please set your company&#39;s industry, this will help us provide better 360&deg; feedback questions. 
          <Button 
                variant="link" 
                size="sm" 
                className='underline'
                onClick={() => setIsCompanyModalOpen(true)}
              >
                Set my Industry
              </Button>
        </p>
        </div>
      </div>
    )}
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className='text-4xl font-light text-berkeleyblue'>
          Manage: <strong className='font-medium' id={companyId ?? undefined}>{companyName}</strong>
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className='bg-white p-8 rounded-lg shadow-md'>
          <div className='flex flex-row items-center justify-between pb-2'>
            <h4 className='text-lg font-light text-berkeleyblue'>Your Org Chart</h4>
            <Network className="h-6 w-6 text-cerulean-300" />
          </div>
          <p className='text-slate-500 text-base font-light text-sm pb-8'>
            Easily keep your company&#39;s structure up to date! Upload your org chart as a CSV file and manage manager relationships to ensure everyone is in the right place.
          </p>
          <Link className='bg-cerulean text-primary-foreground hover:bg-cerulean-600 rounded-md text-sm font-normal h-9 px-4 py-2' href='/dashboard/admin/orgchart'>Manage Org Chart</Link>
        </div>

        <div className='bg-white p-8 rounded-lg shadow-md'>
          <div className='flex flex-row items-center justify-between pb-2'>
            <h4 className='text-lg font-light text-berkeleyblue'>Feedback Cycles</h4>
            <Shell className="h-6 w-6 text-cerulean-300" />
          </div>
          <p className='text-slate-500 text-base font-light text-sm pb-8'>
            Set up a seamless 360&deg; feedback process! Choose how often and on which day of the week your employees will be invited to provide valuable feedback on their peers.
          </p>
          <Link className='bg-cerulean text-primary-foreground hover:bg-cerulean-600 rounded-md text-sm font-normal h-9 px-4 py-2' href='/dashboard/admin/feedback/cycles'>Manage Feedback Cycles</Link>
        </div>

        <div className='bg-white p-8 rounded-lg shadow-md'>
          <div className='flex flex-row items-center justify-between pb-2'>
            <h4 className='text-lg font-light text-berkeleyblue'>Questions &amp; Values</h4>
            <LucideMessageCircleQuestion className="h-6 w-6 text-cerulean-300" />
          </div>
          <p className='text-slate-500 text-base font-light text-sm pb-8'>
            Customize your company&#39;s feedback experience! Create and manage questions to get meaningful insights. Define company values so employees can recognize peers who bring them to life.
          </p>
          <Link className='bg-cerulean text-primary-foreground hover:bg-cerulean-600 rounded-md text-sm font-normal h-9 px-4 py-2 mr-2' href='/dashboard/admin/feedback/questions'>Manage Questions</Link>
          <Link className='bg-cerulean text-primary-foreground hover:bg-cerulean-600 rounded-md text-sm font-normal h-9 px-4 py-2' href='/dashboard/admin/company-values'>Manage Values</Link>
        </div>
      </div>

      <MemberManagementPanel key={refreshKey} />

    </div>
    {/* Company Modal */}
    {companyData && (
      <CompanyModal
        isOpen={isCompanyModalOpen}
        onClose={() => {
          setIsCompanyModalOpen(false);
          handleCompanyUpdate();
        }}
        defaultValues={companyData}
      />
    )}

    </>
  );
}