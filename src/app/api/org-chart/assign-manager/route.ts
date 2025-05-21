// app/api/org-chart/assign-manager/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllUserRelationships } from '@/app/utils/userRelationships';

// Define proper type for the relationship object
interface ManagerRelationship {
  company_id: string;
  relationship_type: 'direct' | 'dotted';
  member_id: string | null;
  invited_member_id: string | null;
  manager_id: string | null;
  invited_manager_id: string | null;
}

export async function PATCH(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing or invalid token' }, { status: 401 });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // console.log('User:', user);
    
    // Get company ID for the current user
    const { data: userData, error: companyError } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('id', user.id)
      .single();
    
    if (companyError || !userData?.company_id) {
      return NextResponse.json({ 
        error: 'Failed to determine company ID for current user' 
      }, { status: 400 });
    }
    
    // Check if user is an admin
    if (userData.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Only company admins can update organizational structure' 
      }, { status: 403 });
    }
    
    const companyId = userData.company_id;
    
    // Parse request body
    const { empId, managerId } = await request.json();
    
    if (!empId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // console.log('******Assigning manager:', managerId, 'to employee:', empId);
    
    // const { data, error } = await supabase.rpc('debug_manager_assignment', { 
    //   manager_id_param: managerId, 
    //   member_id_param: empId
    // });
    // if (error) {
    //   console.log('****Error in debug_manager_assignment:', error);
    // } else {
    //   console.log("****Debut data:", data);
    // }
    
    
    // Get the user's email to determine their status across the system
    let memberEmail = '';
    
    console.log('Looking up user with ID:', empId);

    // Try to get email from user_profiles first
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', empId)
      .maybeSingle();
      
      console.log('profileData:', profileData);
      
    if (profileData?.email) {
      memberEmail = profileData.email;

      console.log('Found user email in user_profiles:', memberEmail);
    } else {

      console.log('User email not found in user_profiles, trying pending_registrations');
      // Try pending_registrations next
      const { data: pendingData } = await supabase
        .from('pending_registrations')
        .select('email')
        .eq('user_id', empId)
        .maybeSingle();
        
      if (pendingData?.email) {
        memberEmail = pendingData.email;

        console.log('Found user email in pending_registrations:', memberEmail);
      } else {
        console.log('User email not found in pending_registrations, trying invited_users');
        // Finally try invited_users
        const { data: inviteData } = await supabase
          .from('invited_users')
          .select('email')
          .eq('id', empId)
          .maybeSingle();
          
        if (inviteData?.email) {
          memberEmail = inviteData.email;

          console.log('Found user email in invited_users:', memberEmail);
        }
      }
    }
    
    if (!memberEmail) {
      return NextResponse.json({ error: 'Could not determine user email' }, { status: 400 });
    }
    
    // Get comprehensive user info
    const memberInfo = await getAllUserRelationships(memberEmail);
    
    // Determine the appropriate ID to use for the member
    let memberIdToUse = '';
    let isInvitedMember = false;
    
    if (memberInfo.registeredId) {
      memberIdToUse = memberInfo.registeredId;
    } else if (memberInfo.pendingId) {
      memberIdToUse = memberInfo.pendingId;
    } else if (memberInfo.invitedId) {
      memberIdToUse = memberInfo.invitedId;
      isInvitedMember = true;
    } else {
      return NextResponse.json({ error: 'User not found in any state' }, { status: 404 });
    }
    
    // Get manager info if a manager ID is provided
    let managerInfo = null;
    let managerEmail = '';

    if (managerId) {
      // First try to get manager email from user_profiles
      const { data: managerProfileData } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', managerId)
        .maybeSingle();
        
      if (managerProfileData?.email) {
        managerEmail = managerProfileData.email;
      } else {
        // If not found, check if it's an invited user
        const { data: managerInviteData } = await supabase
          .from('invited_users')
          .select('email')
          .eq('id', managerId)
          .maybeSingle();
          
        if (managerInviteData?.email) {
          managerEmail = managerInviteData.email;
        } else {
          // Last try with pending_registrations
          const { data: managerPendingData } = await supabase
            .from('pending_registrations')
            .select('email')
            .eq('user_id', managerId)
            .maybeSingle();
            
          if (managerPendingData?.email) {
            managerEmail = managerPendingData.email;
          } else {
            return NextResponse.json({ error: 'Manager not found in any state' }, { status: 404 });
          }
        }
      }
      
      // Now get comprehensive info using the email
      managerInfo = await getAllUserRelationships(managerEmail);
    }
    
    // Delete any existing relationship
    if (isInvitedMember) {
      const { error: deleteError } = await supabase
        .from('manager_relationships')
        .delete()
        .eq('invited_member_id', memberIdToUse)
        .eq('company_id', companyId);
        
      if (deleteError) {
        console.error('Error deleting existing invited member relationship:', deleteError);
        return NextResponse.json({ 
          error: 'Failed to delete existing relationship' 
        }, { status: 500 });
      }
    } else {
      const { error: deleteError } = await supabase
        .from('manager_relationships')
        .delete()
        .eq('member_id', memberIdToUse)
        .eq('company_id', companyId);
        
      if (deleteError) {
        console.error('Error deleting existing member relationship:', deleteError);
        return NextResponse.json({ 
          error: 'Failed to delete existing relationship' 
        }, { status: 500 });
      }
    }
    
    // If a new manager is provided, create the relationship
    if (managerId) {
      const relationship: ManagerRelationship = {
        company_id: companyId,
        relationship_type: 'direct',
        member_id: null,
        invited_member_id: null,
        manager_id: null,
        invited_manager_id: null
      };
      
      // Set the member field based on their state
      if (isInvitedMember) {
        relationship.invited_member_id = memberIdToUse;
        relationship.member_id = null;
      } else {
        relationship.member_id = memberIdToUse;
        relationship.invited_member_id = null;
      }
      
      // Set the manager field based on their state
      if (managerInfo?.registeredId) {
        relationship.manager_id = managerInfo.registeredId;
        relationship.invited_manager_id = null;
      } else if (managerInfo?.invitedId) {
        relationship.invited_manager_id = managerInfo.invitedId;
        relationship.manager_id = null;
      } else if (managerInfo?.pendingId) {
        relationship.manager_id = managerInfo.pendingId;
        relationship.invited_manager_id = null;
      }
      
      console.log('Creating relationship:', relationship);
      
      const { error: insertError } = await supabase
        .from('manager_relationships')
        .insert(relationship);
      
      if (insertError) {
        console.error('Error creating manager relationship:', insertError);
        // Log the specific error code and message
        console.error('Error code:', insertError.code);
        console.error('Error message:', insertError.message);
        console.error('Error details:', insertError.details);
        return NextResponse.json({ 
          error: 'Failed to create manager relationship' 
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in assign-manager API:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    }, { status: 500 });
  }
}