// utils/auth.ts
import type { NextApiRequest } from 'next';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { CookieOptions } from '@supabase/ssr';

/**
 * Check if the current user is an admin - for API routes
 */
export async function isAdmin(request: NextApiRequest): Promise<boolean> {
  try {
    const requestCookies = request.cookies;
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return requestCookies[name];
          },
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          set(_name: string, _value: string, _options: CookieOptions) {
            // Note: This won't actually set the cookie in a middleware context
            // But it's required for the interface
          },
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          remove(_name: string, _options: CookieOptions) {
            // Note: This won't actually remove the cookie in a middleware context
            // But it's required for the interface
          },
        },
      }
    );
    
    // Get user from session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || !session.user) {
      return false;
    }
    
    // Check if user is admin in database
    const { data, error } = await supabase
      .from('company_members')
      .select('role')
      .eq('id', session.user.id)
      .single();
    
    if (error || !data) {
      return false;
    }
    
    return data.role === 'admin' || data.role === 'owner';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if the current user is an admin - for server components
 */
export async function isAdminServer(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );
    
    // Get user from session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || !session.user) {
      return false;
    }
    
    // Check if user is admin in database
    const { data, error } = await supabase
      .from('company_members')
      .select('role')
      .eq('id', session.user.id)
      .single();
    
    if (error || !data) {
      return false;
    }
    
    return data.role === 'admin' || data.role === 'owner';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}