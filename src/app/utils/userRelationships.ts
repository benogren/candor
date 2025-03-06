// src/utils/userRelationships.ts
import supabase from '@/lib/supabase/client';

export const getAllUserRelationships = async (email: string) => {
  const result = {
    invitedId: null as string | null,
    pendingId: null as string | null,
    registeredId: null as string | null,
    managerId: null as string | null,
    invitedManagerId: null as string | null
  };
  
  // Check for invited user
  const { data: invitedData } = await supabase
    .from('invited_users')
    .select('id')
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle();
    
  if (invitedData) result.invitedId = invitedData.id;
  
  // Check for pending registration
  const { data: pendingData } = await supabase
    .from('pending_registrations')
    .select('user_id')
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle();
    
  if (pendingData) result.pendingId = pendingData.user_id;
  
  // Check for registered user
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
    
  if (profileData) result.registeredId = profileData.id;
  
  // Get manager relationship from any of these IDs
  if (result.invitedId) {
    const { data: invitedRel } = await supabase
      .from('manager_relationships')
      .select('manager_id, invited_manager_id')
      .eq('invited_member_id', result.invitedId)
      .maybeSingle();
      
    if (invitedRel) {
      result.managerId = invitedRel.manager_id;
      result.invitedManagerId = invitedRel.invited_manager_id;
    }
  }
  
  if (result.pendingId || result.registeredId) {
    const memberId = result.pendingId || result.registeredId;
    const { data: memberRel } = await supabase
      .from('manager_relationships')
      .select('manager_id, invited_manager_id')
      .eq('member_id', memberId)
      .maybeSingle();
      
    if (memberRel) {
      result.managerId = memberRel.manager_id;
      result.invitedManagerId = memberRel.invited_manager_id;
    }
  }
  
  return result;
};