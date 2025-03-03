import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

// Ensure Supabase is initialized with session persistence
const supabase = createSupabaseClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,  // Ensures session persistence across refreshes
      autoRefreshToken: true, // Automatically refreshes tokens
      detectSessionInUrl: true,
    },
  }
);

// Export only the singleton instance to avoid multiple instances
export default supabase;