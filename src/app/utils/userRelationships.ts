// app/utils/userRelationships.ts
import { createClient } from '@supabase/supabase-js';

interface UserRelationship {
  registeredId: string | null;
  pendingId: string | null;
  invitedId: string | null;
}

/**
 * Get all possible user relationships for an email address
 * Checks registered users, pending registrations, and invited users
 */
export async function getAllUserRelationships(email: string): Promise<UserRelationship> {
  const result: UserRelationship = {
    registeredId: null,
    pendingId: null,
    invitedId: null
  };
  
  if (!email) return result;
  
  // Normalize the email to lowercase for consistent comparison
  const normalizedEmail = email.toLowerCase();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    // 1. Check in user_profiles for registered users
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    
    if (userProfile?.id) {
      result.registeredId = userProfile.id;
      return result; // Return early if we found registered user
    }
    
    // 2. Check pending_registrations
    const { data: pendingReg } = await supabase
      .from('pending_registrations')
      .select('user_id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    
    if (pendingReg?.user_id) {
      result.pendingId = pendingReg.user_id;
      return result; // Return early if we found pending registration
    }
    
    // 3. Check invited_users - Query directly by email for reliability
    const { data: invitedUser } = await supabase
      .from('invited_users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();
    
    if (invitedUser?.id) {
      // console.log(`Found invited user: ${normalizedEmail} with ID ${invitedUser.id}`);
      result.invitedId = invitedUser.id;
    }
    
    return result;
  } catch (error) {
    console.error(`Error checking relationships for ${email}:`, error);
    return result;
  }
}