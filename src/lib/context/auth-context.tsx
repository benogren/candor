'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import supabase from '@/lib/supabase/client';

// Define proper types for error
interface AuthError {
  message: string;
  status?: number;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  memberStatus: 'pending' | 'active' | 'deactivated' | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // console.log('AuthProvider rendering');
  
  const [user, setUser] = useState<User | null>(null);
  const [memberStatus, setMemberStatus] = useState<'pending' | 'active' | 'deactivated' | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Implement a proper refreshStatus function
  async function refreshStatus() {
    // console.log('Refreshing member status');
    if (!user?.id) {
      console.log('No user ID available to refresh status');
      return;
    }

    try {
      const { data: memberData, error: memberError } = await supabase
        .from('company_members')
        .select('status')
        .eq('id', user.id)
        .single();

      if (memberError) {
        console.error('Error fetching member status:', memberError);
        return;
      }

      if (memberData) {
        // console.log('Updated member status:', memberData.status);
        setMemberStatus(memberData.status as 'pending' | 'active' | 'deactivated');
        
        if (memberData.status === 'deactivated') {
          router.push('/deactivated');
        }
      }
    } catch (error) {
      console.error('Error in refreshStatus:', error);
    }
  }

  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        const { data } = await supabase.auth.getSession(); 

        // console.log('Got session:', data);

        if (data.session?.user) {
          // Use the User type directly from Supabase
          setUser(data.session.user);

          const { data: memberData, error: memberError } = await supabase
            .from('company_members')
            .select('status')
            .eq('id', data.session.user.id)
            .single();

          if (!memberError && memberData) {
            // console.log('Got member data:', memberData);
            setMemberStatus(memberData.status as 'pending' | 'active' | 'deactivated');
          }
        } else {
          console.warn('No session found, will redirect to login if needed...');
        }
      } catch (error) {
        console.error('Auth error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      // console.log('Auth event:', event, 'Session:', session);

      if (event === 'SIGNED_OUT') {
        // console.warn('User signed out! Redirecting...');
        setUser(null);
        setMemberStatus(null);
        setTimeout(() => router.push('/auth/login'), 100);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // console.log('User signed in or token refreshed');
        // Refresh member status when user signs in or token is refreshed
        if (session?.user) {
          // Set user directly using Supabase User type
          setUser(session.user);
          
          // We'll fetch the member status right away
          supabase
            .from('company_members')
            .select('status')
            .eq('id', session.user.id)
            .single()
            .then(({ data, error }) => {
              if (!error && data) {
                setMemberStatus(data.status as 'pending' | 'active' | 'deactivated');
              }
            });
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [router]);

  // Only redirect to login if not loading and no user
  useEffect(() => {
    if (loading) return;
    if (typeof window === 'undefined') return;

    if (!user) {
      // console.log('Redirecting to login from auth context...');
      
      // Store the current path to return to after login
      if (pathname && !pathname.includes('/auth/')) {
        try {
          sessionStorage.setItem('redirectPath', pathname);
        } catch (e) {
          console.warn('Failed to set redirect path', e);
        }
      }
      
      // Check if we're not already on a login/register page to avoid redirect loops
      const isAuthPage = pathname?.includes('/auth/');
      
      if (!isAuthPage) {
        // Check if we've redirected multiple times in a short period
        const now = Date.now();
        const lastRedirect = parseInt(sessionStorage.getItem('lastRedirectTime') || '0', 10);
        const redirectCount = parseInt(sessionStorage.getItem('redirectCount') || '0', 10);
        
        if (now - lastRedirect < 2000 && redirectCount > 2) {
          console.warn('Too many redirects detected, staying on current page');
          sessionStorage.setItem('redirectCount', '0');
          return;
        }
        
        // Update redirect tracking
        sessionStorage.setItem('lastRedirectTime', now.toString());
        sessionStorage.setItem('redirectCount', (redirectCount + 1).toString());
        
        setTimeout(() => router.push('/auth/login'), 100);
      }
    } else {
      // Reset redirect count when user is available
      sessionStorage.setItem('redirectCount', '0');
    }
  }, [user, loading, router, pathname]);

  async function login(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        // Set user directly without type casting
        setUser(data.user);

        const { data: memberData, error: memberError } = await supabase
          .from('company_members')
          .select('status')
          .eq('id', data.user?.id)
          .single();

        if (!memberError && memberData) {
          setMemberStatus(memberData.status as 'pending' | 'active' | 'deactivated');

          if (memberData.status === 'deactivated') {
            router.push('/deactivated');
          }
        }
      }

      return { error: error as AuthError | null };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        error: { 
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        } 
      };
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setMemberStatus(null);
    window.location.href = '/';
  }

  return (
    <AuthContext.Provider value={{ user, memberStatus, loading, login, logout, refreshStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}