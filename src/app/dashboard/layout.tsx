'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';
import supabase from '@/lib/supabase/client';
import Header from '@/components/dashboard/header';
// import Sidebar from '@/components/dashboard/sidebar';
import { LoadingSpinner } from '@/components/loading-spinner';

interface DashboardLayoutProps {
  children: ReactNode;
}

// Define a more specific type for company properties
interface Company {
  id: string;
  name: string;
  domains?: string[];
  // Define a proper index signature that allows for common property types
  // while avoiding the 'any' type
  [key: string]: string | string[] | number | boolean | null | undefined;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading: authLoading } = useAuth();
  // const { isAdmin } = useIsAdmin();
  const [company, setCompany] = useState<Company | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const router = useRouter();
  
  // Track whether we've shown the login page to prevent loops
  const [redirectedToLogin, setRedirectedToLogin] = useState(false);

  // Load company data separately from auth check
  useEffect(() => {
    async function loadCompanyData() {
      if (!user?.id) return;
      
      try {
        console.log("Loading company data for user:", user.id);
        
        // First, try to get the company associated with this user
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
        
        // Now get the specific company by ID
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
        
        // Type assertion to ensure companyData matches our Company interface
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
      // Only redirect if we're not already loading auth and haven't redirected yet
      setRedirectedToLogin(true);
      
      // Check if we're not already on a login page to avoid redirect loops
      if (typeof window !== 'undefined') {
        const isAuthPage = window.location.pathname.includes('/auth/');
        if (!isAuthPage) {
          console.log('No user found, redirecting to login from layout');
          // Use a short delay to ensure state updates properly
          setTimeout(() => router.push('/auth/login'), 50);
        }
      }
    } else if (!authLoading && !user?.id) {
      setLoadingCompany(false);
    }
  }, [user?.id, authLoading, router, redirectedToLogin]);

  // Show loading state while authentication is being checked
  if (authLoading || (user && loadingCompany)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // If we're not loading but don't have a user, the auth context will handle redirect
  if (!user) {
    return null; // Return null to avoid rendering anything while redirect happens
  }

  // If we have user but no company data yet, show a loading state
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
    <>
      <Header user={user} company={company}>
        <div className="">
          {/* <Sidebar role={isAdmin ? 'admin' : 'member'} /> */}
          <main className="container mx-auto">
            {children}
          </main>
        </div>
      </Header>
    </>
  );
}