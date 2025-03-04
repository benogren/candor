// app/api/org-chart/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { OrgChartData, User, OrgChartNode } from '@/app/types/orgChart.types';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get cookie store
    const cookieStore = await cookies();
    
    // Create Supabase client with proper cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            // This won't actually set cookies in an API route, but the interface requires it
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            // This won't actually remove cookies in an API route, but the interface requires it
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );
    
    // Get session with auto-refresh
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Session error:", sessionError);
      return NextResponse.json({ error: 'Session error', details: sessionError }, { status: 401 });
    }
    
    if (!session) {
      console.log("No session found in API route");
      // Debug: Check which cookies are available
      const allCookies = cookieStore.getAll();
      console.log("Available cookies:", allCookies.map(c => c.name));
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    console.log("Session found for user:", session.user.email);
    
    // Get the user's role - following your existing auth context pattern
    let { data: memberData, error: memberError } = await supabase
      .from('company_members')
      .select('role, status')
      .eq('id', session.user.id)  // Using ID just like your auth context does
      .single();
    
    if (memberError) {
      console.error("Member data error:", memberError);
      
      // Try fetching by email as a fallback
      const { data: memberByEmail, error: emailError } = await supabase
        .from('company_members')
        .select('id, role, status')
        .eq('email', session.user.email)
        .single();
        
      if (emailError || !memberByEmail) {
        console.log("Also tried by email, still no match");
        return NextResponse.json({ 
          error: 'User not found in company_members table',
          userId: session.user.id,
          userEmail: session.user.email
        }, { status: 403 });
      }
      
      console.log("Found user by email instead of ID");
      memberData = memberByEmail;
    }
    
    if (!memberData) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 403 });
    }
    
    // Check permissions using the same logic as your useIsAdmin hook
    const isAdmin = memberData.role === 'admin' || memberData.role === 'owner';
    
    if (!isAdmin) {
      console.log("User does not have admin permissions. Role:", memberData.role);
      return NextResponse.json({ 
        error: 'Insufficient permissions', 
        role: memberData.role 
      }, { status: 403 });
    }
    
    console.log("User authenticated as:", memberData.role);

    // Fetch all users from the company_members table
    const users = await prisma.company_members.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_invited: true,
        manager_id: true,
      },
    });

    // Transform database results into User objects
    const transformedUsers: User[] = users.map((user) => ({
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      role: user.role || '',
      isInvited: user.is_invited,
      managerId: user.manager_id,
    }));

    // Build the org chart hierarchy
    const { hierarchical, unassigned } = buildOrgChart(transformedUsers);

    return NextResponse.json({
      hierarchical,
      unassigned,
    });
  } catch (error) {
    console.error('Error in org chart API:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch organization chart',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Helper function to build the organization chart hierarchy
function buildOrgChart(users: User[]): OrgChartData {
  // Users with no manager (top level)
  const rootUsers = users.filter((user) => !user.managerId);
  
  // Users with a manager
  const managedUsers = users.filter((user) => user.managerId);
  
  // Build the hierarchy
  const hierarchical: OrgChartNode[] = rootUsers.map((user) => {
    return {
      user,
      directReports: getDirectReports(user.id, managedUsers),
    };
  });
  
  // Find any users who don't fit in the hierarchy (circular references, etc.)
  const hierarchyUserIds = new Set<string>();
  
  // Collect all user IDs in the hierarchy
  const collectUserIds = (node: OrgChartNode) => {
    hierarchyUserIds.add(node.user.id);
    node.directReports.forEach(collectUserIds);
  };
  
  hierarchical.forEach(collectUserIds);
  
  // Users not in the hierarchy
  const unassigned = users.filter((user) => !hierarchyUserIds.has(user.id));
  
  return { hierarchical, unassigned };
}

// Recursive function to get direct reports for a user
function getDirectReports(managerId: string, users: User[]): OrgChartNode[] {
  const directReports = users.filter((user) => user.managerId === managerId);
  
  return directReports.map((user) => {
    return {
      user,
      directReports: getDirectReports(user.id, users),
    };
  });
}