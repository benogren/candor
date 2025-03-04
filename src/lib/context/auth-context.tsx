// lib/context/auth-context.tsx
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

// Add the user_role type to match your database enum
type UserRole = 'member' | 'admin' | 'owner'; // Add any other roles you have

interface AuthContextType {
  user: User | null;
  memberStatus: 'pending' | 'active' | 'deactivated' | null;
  role: UserRole | null;  // Use role instead of isAdmin boolean
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberStatus, setMemberStatus] = useState<'pending' | 'active' | 'deactivated' | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);  // Add role state
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Update refreshStatus to also refresh role
  async function refreshStatus() {
    if (!user?.id) {
      console.log('No user ID available to refresh status');
      return;
    }

    try {
      const { data: memberData, error: memberError } = await supabase
        .from('company_members')
        .select('status, role')  // Get role from the existing field
        .eq('id', user.id)
        .single();

      if (memberError) {
        console.error('Error fetching member status:', memberError);
        return;
      }

      if (memberData) {
        setMemberStatus(memberData.status as 'pending' | 'active' | 'deactivated');
        setRole(memberData.role as UserRole);  // Set role
        
        if (memberData.status === 'deactivated') {
          router.push('/deactivated');
        }
      }
    } catch (error) {
      console.error('Error in refreshStatus:', error);
    }
  }

  // Update loadUser and auth state change handlers to get role
  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        const { data } = await supabase.auth.getSession(); 

        if (data.session?.user) {
          setUser(data.session.user);

          const { data: memberData, error: memberError } = await supabase
            .from('company_members')
            .select('status, role')  // Get role
            .eq('id', data.session.user.id)
            .single();

          if (!memberError && memberData) {
            setMemberStatus(memberData.status as 'pending' | 'active' | 'deactivated');
            setRole(memberData.role as UserRole);  // Set role
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
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setMemberStatus(null);
        setRole(null);  // Reset role on sign out
        setTimeout(() => router.push('/auth/login'), 100);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setUser(session.user);
          
          // Fetch the member status and role
          supabase
            .from('company_members')
            .select('status, role')  // Get role
            .eq('id', session.user.id)
            .single()
            .then(({ data, error }) => {
              if (!error && data) {
                setMemberStatus(data.status as 'pending' | 'active' | 'deactivated');
                setRole(data.role as UserRole);  // Set role
              }
            });
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [router]);

  // Update login to also set role
  async function login(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        setUser(data.user);

        const { data: memberData, error: memberError } = await supabase
          .from('company_members')
          .select('status, role')  // Get role
          .eq('id', data.user?.id)
          .single();

        if (!memberError && memberData) {
          setMemberStatus(memberData.status as 'pending' | 'active' | 'deactivated');
          setRole(memberData.role as UserRole);  // Set role

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
    setRole(null);  // Reset role on logout
    window.location.href = '/';
  }

  return (
    <AuthContext.Provider value={{ user, memberStatus, role, loading, login, logout, refreshStatus }}>
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

// Create convenient hooks for role checks
export function useIsAdmin() {
  const { role, loading } = useAuth();
  return {
    isAdmin: role === 'admin' || role === 'owner',  // Consider owner as admin too
    loading
  };
}

export function useIsOwner() {
  const { role, loading } = useAuth();
  return {
    isOwner: role === 'owner',
    loading
  };
}