'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';
import supabase from '@/lib/supabase/client';
import { DashSidebar } from '@/components/dashboard/sidebar';
import { LoadingSpinner } from '@/components/loading-spinner';
import { SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardLayoutProps {
  children: ReactNode;
}

// Define a more specific type for company properties
interface Company {
  id: string;
  name: string;
  domains?: string[];
  [key: string]: string | string[] | number | boolean | null | undefined;
}

// Create a separate component for the main content to access sidebar state
function MainContent({ children, company }: { children: ReactNode; company: Company }) {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  
  return (
    <div className={`flex-1 transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
      <div className="flex items-center p-4">
        <Button variant="ghost" size="icon" asChild>
          <SidebarTrigger>
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
        </Button>
        {/* <h1 className="ml-4 text-xl font-base text-slate-500">{company.name}</h1> */}
      </div>
      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-6 overflow-y-scroll">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading: authLoading } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const router = useRouter();
  const [redirectedToLogin, setRedirectedToLogin] = useState(false);

  // Load company data
  useEffect(() => {
    async function loadCompanyData() {
      if (!user?.id) return;
      
      try {
        console.log("Loading company data for user:", user.id);
        
        const { data: userData, error: userError } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('id', user.id)
          .single();
          
        if (userError) {
          console.error('Error finding user company association:', userError);
          setLoadingCompany(false);
          return;
        }
        
        if (!userData?.company_id) {
          console.error('No company ID found for user');
          setLoadingCompany(false);
          return;
        }
        
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', userData.company_id)
          .single();
          
        if (companyError) {
          console.error('Error loading company by ID:', companyError);
          setLoadingCompany(false);
          return;
        }
        
        setCompany(companyData as Company);
      } catch (error) {
        console.error('Error in loadCompanyData:', error);
      } finally {
        setLoadingCompany(false);
      }
    }

    if (user?.id) {
      loadCompanyData();
    } else if (!authLoading && !redirectedToLogin) {
      setRedirectedToLogin(true);
      
      if (typeof window !== 'undefined') {
        const isAuthPage = window.location.pathname.includes('/auth/');
        if (!isAuthPage) {
          console.log('No user found, redirecting to login from layout');
          setTimeout(() => router.push('/auth/login'), 50);
        }
      }
    } else if (!authLoading && !user?.id) {
      setLoadingCompany(false);
    }
  }, [user?.id, authLoading, router, redirectedToLogin]);

  // Loading states
  if (authLoading || (user && loadingCompany)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!company) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
        <p className="ml-2">Company data not found. Please contact support.</p>
      </div>
    );
  }

  // When we have both user and company, render the full layout
  return (
    <SidebarProvider>
      <div className="flex h-screen bg-white overflow-scroll">
        <DashSidebar user={user} company={company} />
        <MainContent company={company}>
          {children}
        </MainContent>
      </div>
    </SidebarProvider>
  );
}