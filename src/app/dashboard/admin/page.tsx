'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import supabase from '@/lib/supabase/client'; 
import MemberManagementPanel from '@/components/MemberManagementPanel';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { CompanyModal } from '@/components/CompanyModal';
import { Button } from '@/components/ui/button';
import { Building2, ChevronDown, LucideMessageCircleQuestion, Medal, Network, Settings, Shell } from 'lucide-react';
import { radley } from '../../fonts';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';

export default function TeamManagementPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isIndustrySet, setIsIndustrySet] = useState(false);
  const router = useRouter();

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
      
      <div className='bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100'>
        <div className='flex items-center justify-between'>
            <div className='flex items-center'>
                <div className='bg-nonphotoblue-600 rounded-md p-2 mr-4 items-center'>
                    < Building2 className="h-12 w-12 text-nonphotoblue-100" />
                </div>
                <div>
                    <h2 className={`text-4xl font-light text-nonphotoblue-600 ${radley.className}`}>
                      Manage: <strong className='font-medium' id={companyId ?? undefined}>{companyName}</strong>
                    </h2>
                    <p className='text-slate-500'>
                      Admin Dashboard
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <Button
                      variant="secondary"
                      className="flex items-center gap-2"
                      onClick={() => setIsCompanyModalOpen(true)}
                  >
                      <Settings className="h-5 w-5 text-cerulean-400" />
                      Company Settings
                  </Button>
              </div>
          </div>
      </div>

    <div className="mb-10">
      {/* <h2 className='text-2xl font-light text-berkeleyblue mb-4'>Generate New</h2> */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

        <Button 
              variant="secondary" 
              className="w-full flex items-center justify-between px-4 py-12 text-left"
              onClick={() => router.push('/dashboard/admin/orgchart/')}
          >
              <div className="flex items-center">
                  <Network className="h-7 w-7 text-nonphotoblue-600 mr-4" />
                  <div>
                      <div className="font-light text-lg text-nonphotoblue-700">Org Chart</div>
                      <div className="text-sm text-gray-500 truncate">
                          Manage your org chart.
                      </div>
                  </div>
              </div>
          </Button>

          <Button 
              variant="secondary" 
              className="w-full flex items-center justify-between px-4 py-12 text-left"
              onClick={() => router.push('/dashboard/admin/feedback/cycles')}
          >
              <div className="flex items-center">
                  <Shell className="h-7 w-7 text-nonphotoblue-600 mr-4" />
                  <div>
                      <div className="font-light text-lg text-nonphotoblue-700">Feedback Cycles</div>
                      <div className="text-sm text-gray-500 truncate">
                          Manage your feedback cycles.
                      </div>
                  </div>
              </div>
          </Button>

          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button 
                      variant="secondary" 
                      className="w-full flex items-center justify-between px-4 py-12 text-left"
                      
                  >
                      <div className="flex items-center">
                          <LucideMessageCircleQuestion className="h-7 w-7 text-nonphotoblue-600 mr-4" />
                          <div>
                              <div className="font-light text-lg text-nonphotoblue-700">Questions &amp; Values</div>
                              <div className="text-sm text-gray-500 truncate">
                                  Manage your questions &amp; company values.
                              </div>
                          </div>
                      </div>
                      <ChevronDown className="h-5 w-5 text-cerulean" />
                  </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="">
                  <DropdownMenuItem 
                      className="cursor-pointer"
                      onClick={() => router.push('/dashboard/admin/feedback/questions')}
                  >
                    <LucideMessageCircleQuestion className="h-5 w-5 text-nonphotoblue-600" />
                    Manage Feedback Questions
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                      className="cursor-pointer"
                      onClick={() => router.push('/dashboard/admin/company-values')}
                  >
                    <Medal className="h-5 w-5 text-nonphotoblue-600" />
                    Manage Company Values
                  </DropdownMenuItem>
              </DropdownMenuContent>
          </DropdownMenu>
          
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