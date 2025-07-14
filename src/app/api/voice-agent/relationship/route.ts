// app/api/voice-agent/relationship/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Define relationship types
type RelationshipType = 
  | 'manager-report'      // provider is recipient's manager
  | 'report-manager'      // recipient is provider's manager
  | 'skip-level-manager'  // provider is recipient's higher-level manager
  | 'skip-level-report'   // recipient is provider's higher-level manager
  | 'peer'                // users share the same manager
  | 'peer-with-boss'      // recipient is a peer of provider's boss
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
  jobTitle: string | null;
  industry: string | null;
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

// Define the type for the joined company member and company data
type CompanyMemberWithCompany = {
  company_id: string;
  companies?: {
    industry?: string | null;
  } | null;
};

export async function GET(request: NextRequest) {
  try {
    // Get query parameters (using providerId and recipientId)
    const providerId = request.nextUrl.searchParams.get('providerId');
    const recipientId = request.nextUrl.searchParams.get('recipientId');

    // Validate parameters
    if (!providerId || !recipientId) {
      return NextResponse.json(
        { error: 'Both providerId and recipientId parameters are required' },
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
    const providerData = orgStructure.find(member => member.id === providerId);
    const recipientData = orgStructure.find(member => member.id === recipientId);

    if (!providerData || !recipientData) {
      return NextResponse.json(
        { error: 'One or both users not found in organization' },
        { status: 404 }
      );
    }

    // Fetch profiles for both users (if they're regular users)
    const registeredUserIds = [providerId, recipientId].filter(id => {
      const userData = orgStructure.find(m => m.id === id);
      return userData && !userData.is_invited && !userData.is_pending;
    });

    // Fetch invited user IDs
    const invitedUserIds = [providerId, recipientId].filter(id => {
      const userData = orgStructure.find(m => m.id === id);
      return userData?.is_invited;
    });

    // Collect all manager IDs to fetch their profiles too
    const managerIds = new Set<string>();
    orgStructure.forEach(member => {
      if (member.manager_id && (member.id === providerId || member.id === recipientId)) {
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
      
      return {
        id: userData.id,
        name: profile?.name || userData.name || userData.email.split('@')[0],
        email: profile?.email || userData.email,
        role: userData.role
      };
    };

    const provider = enhanceUserData(providerData);
    const recipient = enhanceUserData(recipientData);

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
    const providerManagerChain = buildManagerChain(providerId);
    const recipientManagerChain = buildManagerChain(recipientId);

    // Determine relationship
    let relationship: UserRelationship;

    // Check if provider is recipient's direct manager
    if (recipientData.manager_id === providerId) {
      relationship = {
        type: 'manager-report',
        description: `${provider.name} is ${recipient.name}'s manager`,
        distance: 1
      };
    }
    // Check if recipient is provider's direct manager
    else if (providerData.manager_id === recipientId) {
      relationship = {
        type: 'report-manager',
        description: `${provider.name} reports to ${recipient.name}`,
        distance: 1
      };
    }
    // Check for skip-level relationships
    else {
      // Check if provider is in recipient's manager chain
      const providerInRecipientChain = recipientManagerChain.find(m => m.id === providerId);
      if (providerInRecipientChain) {
        relationship = {
          type: 'skip-level-manager',
          description: `${provider.name} is ${recipient.name}'s higher-level manager`,
          distance: providerInRecipientChain.distance
        };
      }
      // Check if recipient is in provider's manager chain
      else {
        const recipientInProviderChain = providerManagerChain.find(m => m.id === recipientId);
        if (recipientInProviderChain) {
          relationship = {
            type: 'skip-level-report',
            description: `${provider.name} is under ${recipient.name} in the org chart`,
            distance: recipientInProviderChain.distance
          };
        }
        // Check if they share the same manager (peers)
        else if (
          providerData.manager_id && 
          recipientData.manager_id && 
          providerData.manager_id === recipientData.manager_id
        ) {
          // Get manager name
          const managerId = providerData.manager_id;
          const managerData = orgStructure.find(m => m.id === managerId);
          const managerProfile = profileMap.get(managerId);
          const managerName = managerProfile?.name || 
                             managerData?.name || 
                             (managerData?.email ? managerData.email.split('@')[0] : 'same manager');
          
          relationship = {
            type: 'peer',
            description: `${provider.name} and ${recipient.name} both report to ${managerName}`,
            distance: 0
          };
        }
        // Check if recipient is a peer of provider's boss
        else if (providerData.manager_id) {
          // Get provider's manager
          const providerManagerId = providerData.manager_id;
          const providerManagerData = orgStructure.find(m => m.id === providerManagerId);
          
          // Check if provider's manager and recipient share the same manager (making them peers)
          if (providerManagerData?.manager_id && 
              recipientData.manager_id && 
              providerManagerData.manager_id === recipientData.manager_id) {
            
            // Get names for better description
            const providerManagerProfile = profileMap.get(providerManagerId);
            const providerManagerName = providerManagerProfile?.name || 
                                      providerManagerData?.name || 
                                      (providerManagerData?.email ? providerManagerData.email.split('@')[0] : 'your manager');
            
            // Note: Both users have the same higher-level manager but we don't need to name them in the description
            
            relationship = {
              type: 'peer-with-boss',
              description: `${recipient.name} is peers with ${provider.name}'s manager (${providerManagerName})`,
              distance: 2
            };
          } else {
            // No relationship found
            relationship = {
              type: 'unrelated',
              description: `${provider.name} and ${recipient.name} have no direct reporting relationship`,
              distance: -1
            };
          }
        } 
        // No relationship found
        else {
          relationship = {
            type: 'unrelated',
            description: `${provider.name} and ${recipient.name} have no direct reporting relationship`,
            distance: -1
          };
        }
      }
    }

    // Get additional context like job title and industry
    const recipientProfile = profileMap.get(recipientId) as UserProfile | undefined;
    const jobTitle = recipientProfile?.job_title || null;

    // Get company industry
    const { data: companyDataRaw, error: companyError2 } = await supabase
      .from('company_members')
      .select(`
        company_id,
        companies!inner(industry)
      `)
      .eq('id', providerId)
      .single();

    if (companyError2) {
      console.error('Error fetching company data:', companyError2);
      return NextResponse.json({ 
        error: 'Failed to get company data',
        details: companyError2.message
      }, { status: 500 });
    }

    const companyData = companyDataRaw as CompanyMemberWithCompany | null;
    const industry = companyData?.companies?.industry || null;

    // Prepare response
    const response: RelationshipResponse = {
      relationship,
      jobTitle,
      industry,
      users: {
        user1: provider,
        user2: recipient
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