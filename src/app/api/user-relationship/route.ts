// app/api/user-relationship/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Define relationship types
type RelationshipType = 
  | 'manager-report'      // user1 is user2's manager
  | 'report-manager'      // user2 is user1's manager
  | 'skip-level-manager'  // user1 is user2's higher-level manager
  | 'skip-level-report'   // user2 is user1's higher-level manager
  | 'peer'                // users share the same manager
  | 'peer-with-boss'      // user2 is a peer of user1's boss
  | 'unrelated';          // no hierarchical relationship

interface OrgStructureMember {
  id: string;
  email: string;
  name?: string;
  role: string;
  is_invited: boolean;
  is_pending: boolean;
  manager_id?: string | null;
  company_id: string;
  relationship_type: string;
}

interface UserProfile {
  id: string;
  name?: string;
  email: string;
  avatar_url?: string;
  job_title?: string;
}

interface UserRelationship {
  type: RelationshipType;
  description: string;
  distance: number;
}

interface RelationshipResponse {
  relationship: UserRelationship;
  users: {
    user1: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
    user2: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  };
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const user1Id = request.nextUrl.searchParams.get('user1');
    const user2Id = request.nextUrl.searchParams.get('user2');

    // Validate parameters
    if (!user1Id || !user2Id) {
      return NextResponse.json(
        { error: 'Both user1 and user2 parameters are required' },
        { status: 400 }
      );
    }

    // Get auth header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Get the company ID for the current user
    const { data: userData, error: companyError } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('id', user.id)
      .single();
    
    if (companyError || !userData?.company_id) {
      return NextResponse.json({ error: 'User not associated with a company' }, { status: 400 });
    }
    
    const companyId = userData.company_id;
    
    // Fetch organization structure for the company
    const { data: orgStructure, error: orgError } = await supabase
      .from('org_structure')
      .select('*')
      .eq('company_id', companyId);
    
    if (orgError || !orgStructure) {
      return NextResponse.json(
        { error: 'Failed to fetch organization structure' },
        { status: 500 }
      );
    }

    // Check if both users exist in the org structure
    const user1Data = orgStructure.find(member => member.id === user1Id);
    const user2Data = orgStructure.find(member => member.id === user2Id);

    if (!user1Data || !user2Data) {
      return NextResponse.json(
        { error: 'One or both users not found in organization' },
        { status: 404 }
      );
    }

    // Fetch profiles for both users (if they're regular users)
    const registeredUserIds = [user1Id, user2Id].filter(id => {
      const userData = orgStructure.find(m => m.id === id);
      return userData && !userData.is_invited && !userData.is_pending;
    });

    // Fetch invited user IDs
    const invitedUserIds = [user1Id, user2Id].filter(id => {
      const userData = orgStructure.find(m => m.id === id);
      return userData?.is_invited;
    });

    // Collect all manager IDs to fetch their profiles too
    const managerIds = new Set<string>();
    orgStructure.forEach(member => {
      if (member.manager_id && (member.id === user1Id || member.id === user2Id)) {
        managerIds.add(member.manager_id);
        
        // Also add the manager's manager for "peer-with-boss" detection
        const managerData = orgStructure.find(m => m.id === member.manager_id);
        if (managerData?.manager_id) {
          managerIds.add(managerData.manager_id);
        }
      }
    });

    // Maps to store user profiles
    const profileMap = new Map<string, UserProfile | { name?: string, email: string }>();

    // Fetch registered user profiles (including managers)
    const allRegisteredUserIds = [...registeredUserIds, ...Array.from(managerIds)].filter(
      (id, index, self) => self.indexOf(id) === index && id !== null
    );
    
    if (allRegisteredUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name, email, avatar_url, job_title')
        .in('id', allRegisteredUserIds);
      
      if (profiles) {
        profiles.forEach(profile => {
          profileMap.set(profile.id, profile);
        });
      }
    }

    // Fetch invited user profiles
    if (invitedUserIds.length > 0) {
      const { data: invitedProfiles } = await supabase
        .from('invited_users')
        .select('id, name, email, job_title')
        .in('id', invitedUserIds);
      
      if (invitedProfiles) {
        invitedProfiles.forEach(profile => {
          profileMap.set(profile.id, profile);
        });
      }
    }

    // Enhance user data with profile information
    const enhanceUserData = (userData: OrgStructureMember) => {
      const profile = profileMap.get(userData.id);
      
      // For debugging
    //   console.log(`Enhancing data for ${userData.id}:`, {
    //     "found profile": !!profile,
    //     "profile data": profile,
    //     "org data": userData
    //   });
      
      return {
        id: userData.id,
        name: profile?.name || userData.name || userData.email.split('@')[0],
        email: profile?.email || userData.email,
        role: userData.role
      };
    };

    const user1 = enhanceUserData(user1Data);
    const user2 = enhanceUserData(user2Data);

    // Build a map from user to their manager chain
    type ManagerChain = { id: string; distance: number; }[];
    const buildManagerChain = (userId: string): ManagerChain => {
      const chain: ManagerChain = [];
      let currentId = userId;
      let distance = 0;
      
      // Prevent infinite loops with a reasonable limit
      const maxIterations = 10;
      let iterations = 0;
      
      while (iterations < maxIterations) {
        const userData = orgStructure.find(m => m.id === currentId);
        if (!userData || !userData.manager_id) break;
        
        distance++;
        chain.push({ id: userData.manager_id, distance });
        currentId = userData.manager_id;
        iterations++;
      }
      
      return chain;
    };

    // Get manager chains for both users
    const user1ManagerChain = buildManagerChain(user1Id);
    const user2ManagerChain = buildManagerChain(user2Id);

    // Determine relationship
    let relationship: UserRelationship;

    // Check if user1 is user2's direct manager
    if (user2Data.manager_id === user1Id) {
      relationship = {
        type: 'manager-report',
        description: `${user1.name} is ${user2.name}'s manager`,
        distance: 1
      };
    }
    // Check if user2 is user1's direct manager
    else if (user1Data.manager_id === user2Id) {
      relationship = {
        type: 'report-manager',
        description: `${user1.name} reports to ${user2.name}`,
        distance: 1
      };
    }
    // Check for skip-level relationships
    else {
      // Check if user1 is in user2's manager chain
      const user1InUser2Chain = user2ManagerChain.find(m => m.id === user1Id);
      if (user1InUser2Chain) {
        relationship = {
          type: 'skip-level-manager',
          description: `${user1.name} is ${user2.name}'s higher-level manager`,
          distance: user1InUser2Chain.distance
        };
      }
      // Check if user2 is in user1's manager chain
      else {
        const user2InUser1Chain = user1ManagerChain.find(m => m.id === user2Id);
        if (user2InUser1Chain) {
          relationship = {
            type: 'skip-level-report',
            description: `${user1.name} is under ${user2.name} in the org chart`,
            distance: user2InUser1Chain.distance
          };
        }
        // Check if they share the same manager (peers)
        else if (
          user1Data.manager_id && 
          user2Data.manager_id && 
          user1Data.manager_id === user2Data.manager_id
        ) {
          // Get manager name
          const managerId = user1Data.manager_id;
          const managerData = orgStructure.find(m => m.id === managerId);
          const managerProfile = profileMap.get(managerId);
          const managerName = managerProfile?.name || 
                             managerData?.name || 
                             (managerData?.email ? managerData.email.split('@')[0] : 'same manager');
          
          relationship = {
            type: 'peer',
            description: `${user1.name} and ${user2.name} both report to ${managerName}`,
            distance: 0
          };
        }
        // Check if user2 is a peer of user1's boss
        else if (user1Data.manager_id) {
          // Get user1's manager
          const user1ManagerId = user1Data.manager_id;
          const user1ManagerData = orgStructure.find(m => m.id === user1ManagerId);
          
          // Check if user1's manager and user2 share the same manager (making them peers)
          if (user1ManagerData?.manager_id && 
              user2Data.manager_id && 
              user1ManagerData.manager_id === user2Data.manager_id) {
            
            // Get names for better description
            const user1ManagerProfile = profileMap.get(user1ManagerId);
            const user1ManagerName = user1ManagerProfile?.name || 
                                    user1ManagerData?.name || 
                                    (user1ManagerData?.email ? user1ManagerData.email.split('@')[0] : 'your manager');
            
            const sharedManagerId = user1ManagerData.manager_id;
            const sharedManagerData = orgStructure.find(m => m.id === sharedManagerId);
            const sharedManagerProfile = profileMap.get(sharedManagerId);
            const sharedManagerName = sharedManagerProfile?.name || 
                                     sharedManagerData?.name || 
                                     (sharedManagerData?.email ? sharedManagerData.email.split('@')[0] : 'same higher-level manager');

                                     console.log(sharedManagerName);
            
            // console.log(`Detected peer-with-boss relationship:
            //   - User1 (${user1.name}) has manager: ${user1ManagerName}
            //   - User2 (${user2.name}) and User1's manager both report to: ${sharedManagerName}`);
            
            relationship = {
              type: 'peer-with-boss',
              description: `${user2.name} is peers with ${user1.name}'s manager (${user1ManagerName})`,
              distance: 2
            };
          } else {
            // Additional check: verify that they are in the same organization structure
            // console.log(`No peer-with-boss relationship detected:
            //   - User1 (${user1.name}) manager ID: ${user1Data.manager_id}
            //   - User1's manager's manager ID: ${user1ManagerData?.manager_id || 'none'}
            //   - User2 (${user2.name}) manager ID: ${user2Data.manager_id || 'none'}`);
            
            // No relationship found
            relationship = {
              type: 'unrelated',
              description: `${user1.name} and ${user2.name} have no direct reporting relationship`,
              distance: -1
            };
          }
        } 
        // No relationship found
        else {
          relationship = {
            type: 'unrelated',
            description: `${user1.name} and ${user2.name} have no direct reporting relationship`,
            distance: -1
          };
        }
      }
    }

    // Prepare response
    const response: RelationshipResponse = {
      relationship,
      users: {
        user1,
        user2
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error determining user relationship:', error);
    return NextResponse.json(
      { 
        error: 'Failed to determine user relationship',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}