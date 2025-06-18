// /api/seed/company-members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
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

    // Get user's company
    const { data: member } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!member || member.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Define types for activeMembers and user_profiles
    type UserProfile = { name: string; email: string };
    type ActiveMember = {
      id: string;
      role: string;
      status: string;
      user_profiles: UserProfile[] | UserProfile | null;
    };

    // Get both active members and invited users
    const { data: activeMembers, error: activeMembersError } = await supabase
      .from('company_members')
      .select(`
        id,
        role,
        status,
        user_profiles(name, email)
      `)
      .eq('company_id', member.company_id) as unknown as { data: ActiveMember[]; error: any };

    const { data: invitedUsers, error: invitedUsersError } = await supabase
      .from('invited_users')
      .select('id, name, email, role, status')
      .eq('company_id', member.company_id)
      .eq('status', 'pending');

    if (activeMembersError || invitedUsersError) {
      console.error('Error fetching members:', activeMembersError || invitedUsersError);
      return NextResponse.json({ error: 'Failed to fetch company members' }, { status: 500 });
    }

    // Combine and format members
    const allMembers = [
      // Active members - access user_profiles as array since it's a foreign key relationship
      ...(activeMembers?.map(member => ({
        id: member.id,
        name: Array.isArray(member.user_profiles) ? member.user_profiles[0]?.name : member.user_profiles?.name,
        email: Array.isArray(member.user_profiles) ? member.user_profiles[0]?.email : member.user_profiles?.email,
        role: member.role,
        status: member.status
      })).filter(member => member.name && member.email) || []),
      // Invited users
      ...(invitedUsers?.map(user => ({
        id: user.id,
        name: user.name || user.email.split('@')[0],
        email: user.email,
        role: user.role,
        status: 'invited'
      })) || [])
    ];

    return NextResponse.json({ members: allMembers });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}