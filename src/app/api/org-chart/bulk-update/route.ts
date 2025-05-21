// app/api/org-chart/bulk-update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllUserRelationships } from '@/app/utils/userRelationships';

// Define proper types for the objects
interface ManagerAssignment {
  userId: string;
  managerId: string | null;
}

interface UserRelationshipInfo {
  registeredId?: string | null;
  pendingId?: string | null;
  invitedId?: string | null;
  email?: string;
}

interface ManagerRelationship {
  company_id: string;
  relationship_type: 'direct' | 'dotted';
  member_id?: string | null;
  invited_member_id?: string | null;
  manager_id?: string | null;
  invited_manager_id?: string | null;
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
    const { assignments } = await request.json() as { assignments: ManagerAssignment[] };
    
    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json({ error: 'Valid assignments array is required' }, { status: 400 });
    }
    
    // Get manager info if a manager ID is provided in any assignment
    const managerIds = new Set<string>();
    assignments.forEach(assignment => {
      if (assignment.managerId) managerIds.add(assignment.managerId);
    });
    
    // Fetch all manager emails in bulk
    const managerInfoMap = new Map<string, UserRelationshipInfo>();
    for (const managerId of managerIds) {
      // Get the manager's email
      const { data: managerProfileData } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', managerId)
        .maybeSingle();
        
      if (managerProfileData?.email) {
        const managerInfo = await getAllUserRelationships(managerProfileData.email);
        managerInfoMap.set(managerId, managerInfo);
      }
    }
    
    // Process each assignment
    for (const assignment of assignments) {
      const { userId, managerId } = assignment;
      
      if (!userId) {
        return NextResponse.json({ error: 'User ID is required for all assignments' }, { status: 400 });
      }
      
      // Get the user's email to determine their status
      let memberEmail = '';
      
      // Try to get email from user_profiles first
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle();
        
      if (profileData?.email) {
        memberEmail = profileData.email;
      } else {
        // Try pending_registrations next
        const { data: pendingData } = await supabase
          .from('pending_registrations')
          .select('email')
          .eq('user_id', userId)
          .maybeSingle();
          
        if (pendingData?.email) {
          memberEmail = pendingData.email;
        } else {
          // Finally try invited_users
          const { data: inviteData } = await supabase
            .from('invited_users')
            .select('email')
            .eq('id', userId)
            .maybeSingle();
            
          if (inviteData?.email) {
            memberEmail = inviteData.email;
          }
        }
      }
      
      if (!memberEmail) {
        console.warn(`Could not determine email for user ID: ${userId}, skipping assignment`);
        continue;
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
        console.warn(`User not found in any state for email: ${memberEmail}, skipping assignment`);
        continue;
      }
      
      // Delete any existing relationship
      if (isInvitedMember) {
        const { error: deleteError } = await supabase
          .from('manager_relationships')
          .delete()
          .eq('invited_member_id', memberIdToUse)
          .eq('company_id', companyId);
          
        if (deleteError) {
          console.error(`Error deleting existing invited member relationship for ${memberEmail}:`, deleteError);
          return NextResponse.json({ 
            error: `Failed to delete existing relationship for user ${memberEmail}` 
          }, { status: 500 });
        }
      } else {
        const { error: deleteError } = await supabase
          .from('manager_relationships')
          .delete()
          .eq('member_id', memberIdToUse)
          .eq('company_id', companyId);
          
        if (deleteError) {
          console.error(`Error deleting existing member relationship for ${memberEmail}:`, deleteError);
          return NextResponse.json({ 
            error: `Failed to delete existing relationship for user ${memberEmail}` 
          }, { status: 500 });
        }
      }
      
      // If a new manager is provided, create the relationship
      if (managerId) {
        const managerInfo = managerInfoMap.get(managerId);
        
        if (!managerInfo) {
          console.warn(`Manager info not found for ID: ${managerId}, skipping assignment`);
          continue;
        }
        
        const relationship: ManagerRelationship = {
          company_id: companyId,
          relationship_type: 'direct',
          member_id: null,
          invited_member_id: null,
          manager_id: null,
          invited_manager_id: null
        };
        
        if (isInvitedMember) {
          relationship.invited_member_id = memberIdToUse;
          relationship.member_id = null;
        } else {
          relationship.member_id = memberIdToUse;
          relationship.invited_member_id = null;
        }
        
        // Use the manager's registered ID if available
        if (managerInfo.registeredId) {
          relationship.manager_id = managerInfo.registeredId;
          relationship.invited_manager_id = null;
        } else if (managerInfo.pendingId) {
          relationship.manager_id = managerInfo.pendingId;
          relationship.invited_manager_id = null;
        } else if (managerInfo.invitedId) {
          relationship.invited_manager_id = managerInfo.invitedId;
          relationship.manager_id = null;
        }
        
        const { error: insertError } = await supabase
          .from('manager_relationships')
          .insert(relationship);
        
        if (insertError) {
          console.error(`Error creating manager relationship for ${memberEmail}:`, insertError);
          return NextResponse.json({ 
            error: `Failed to create manager relationship for user ${memberEmail}` 
          }, { status: 500 });
        }
      }
    }
    
    return NextResponse.json({ 
      success: true,
      updatedCount: assignments.length
    });
  } catch (error) {
    console.error('Error in bulk-update API:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    }, { status: 500 });
  }
}