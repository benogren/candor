// app/api/org-chart/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OrgChartData, OrgChartNode, User } from '@/app/types/orgChart.types';

// Define types for user profiles
interface UserProfile {
  id: string;
  name?: string;
  email: string;
  avatar_url?: string;
  job_title?: string;
}

interface InvitedUserProfile {
  id: string;
  name?: string;
  email: string;
  job_title?: string;
}

interface OrgStructureMember {
  id: string;
  email: string;
  role: string;
  is_invited: boolean;
  is_pending: boolean;
  manager_id?: string | null;
  company_id: string;
}

// Type for profile lookup objects
interface ProfileMap {
  [key: string]: UserProfile | InvitedUserProfile;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    console.log(`User authenticated as: ${user.email}`);
    
    // Get the company ID for the current user
    const { data: userData, error: companyError } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('id', user.id)
      .single();
    
    if (companyError || !userData?.company_id) {
      return NextResponse.json({ error: 'User not associated with a company' }, { status: 400 });
    }
    
    const companyId = userData.company_id;
    
    // Fetch organization structure using the org_structure view
    const { data: orgStructure, error: orgError } = await supabase
      .from('org_structure')
      .select('*')
      .eq('company_id', companyId);
    
    if (orgError) {
      return NextResponse.json({ error: 'Failed to fetch organization structure' }, { status: 500 });
    }
    
    console.log(`Found ${orgStructure?.length || 0} users in organization structure`);
    
    // Fetch user profiles for all registered users
    const registeredUserIds = orgStructure
      .filter(member => !member.is_invited && !member.is_pending)
      .map(member => member.id);
    
    // Fetch invited user IDs
    const invitedUserIds = orgStructure
      .filter(member => member.is_invited)
      .map(member => member.id);
    
    let userProfiles: ProfileMap = {};
    let invitedUserProfiles: ProfileMap = {};
    
    // Fetch registered user profiles
    if (registeredUserIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, name, email, avatar_url, job_title')
        .in('id', registeredUserIds);
      
      if (!profileError && profiles) {
        userProfiles = profiles.reduce<ProfileMap>((acc, profile: UserProfile) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }
    }
    
    // Fetch invited user profiles
    if (invitedUserIds.length > 0) {
      const { data: invitedProfiles, error: invitedProfileError } = await supabase
        .from('invited_users')
        .select('id, name, email, job_title')
        .in('id', invitedUserIds);
      
      if (!invitedProfileError && invitedProfiles) {
        invitedUserProfiles = invitedProfiles.reduce<ProfileMap>((acc, profile: InvitedUserProfile) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }
    }
    
    // Transform members into User objects with enhanced profile information
    const users: User[] = orgStructure.map((member: OrgStructureMember) => {
      // Make sure managerId is never undefined
      const managerId: string | null = member.manager_id || null;
      
      // For registered users, get profile info
      if (!member.is_invited && !member.is_pending && userProfiles[member.id]) {
        const profile = userProfiles[member.id] as UserProfile;
        return {
          id: member.id,
          email: profile.email || member.email,
          name: profile.name || member.email.split('@')[0],
          role: member.role,
          isInvited: member.is_invited,
          isPending: member.is_pending || false,
          managerId: managerId,
          avatarUrl: profile.avatar_url,
          jobTitle: profile.job_title
        };
      }
      
      // For invited users, get profile info from invited_users table
      if (member.is_invited && invitedUserProfiles[member.id]) {
        const profile = invitedUserProfiles[member.id] as InvitedUserProfile;
        return {
          id: member.id,
          email: profile.email || member.email,
          name: profile.name || member.email.split('@')[0],
          role: member.role,
          isInvited: true,
          isPending: false,
          managerId: managerId,
          jobTitle: profile.job_title
        };
      }
      
      // Fallback for any other users
      return {
        id: member.id,
        email: member.email,
        name: member.email.split('@')[0],
        role: member.role,
        isInvited: member.is_invited,
        isPending: member.is_pending || false,
        managerId: managerId
      };
    });
    
    // Build the manager-to-direct-reports map
    const managerMap = new Map<string, string[]>();
    orgStructure.forEach((member: OrgStructureMember) => {
      if (!member.manager_id) return;
      
      if (!managerMap.has(member.manager_id)) {
        managerMap.set(member.manager_id, []);
      }
      managerMap.get(member.manager_id)?.push(member.id);
    });
    
    // Find users with no managers (top-level)
    const topLevelUserIds = new Set<string>();
    users.forEach(user => {
      if (!user.managerId) {
        topLevelUserIds.add(user.id);
      }
    });
    
    // Build the hierarchical organization chart
    // Modify the code that builds the hierarchical organization chart
const hierarchical: OrgChartNode[] = [];
const processedUsers = new Set<string>();

// First, identify which top-level users are actually managers (have direct reports)
const managersWithReports = new Set<string>();
for (const userId of topLevelUserIds) {
  // Check if this user has any direct reports
  const directReportIds = managerMap.get(userId) || [];
  if (directReportIds.length > 0) {
    managersWithReports.add(userId);
  }
}

// Helper function to recursively build the org chart (unchanged)
const buildOrgChart = (userId: string): OrgChartNode | null => {
  const user = users.find(u => u.id === userId);
  if (!user || processedUsers.has(userId)) return null;
  
  processedUsers.add(userId);
  
  const directReports: OrgChartNode[] = [];
  const directReportIds = managerMap.get(userId) || [];
  
  for (const reportId of directReportIds) {
    const reportNode = buildOrgChart(reportId);
    if (reportNode) {
      directReports.push(reportNode);
    }
  }
  
  return {
    user,
    directReports
  };
};

// Build the chart starting ONLY from top-level users that have direct reports
for (const userId of managersWithReports) {
  const node = buildOrgChart(userId);
  if (node) {
    hierarchical.push(node);
  }
}

// Identify unassigned users (not in the hierarchy OR top-level without reports)
const unassigned = users.filter(user => 
  !processedUsers.has(user.id) || 
  (topLevelUserIds.has(user.id) && !managersWithReports.has(user.id))
);
    
    const orgChartData: OrgChartData = {
      hierarchical,
      unassigned
    };
    
    return NextResponse.json(orgChartData);
  } catch (error) {
    console.error('Error retrieving organization chart:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve organization chart' },
      { status: 500 }
    );
  }
}