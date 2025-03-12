// app/api/colleagues/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Get the search query
    const searchQuery = request.nextUrl.searchParams.get('q');
    if (!searchQuery || searchQuery.length < 1) {
      return NextResponse.json({ results: [] });
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
    const normalizedQuery = searchQuery.toLowerCase().trim();
    
    // First get all members for this company (without email since it doesn't exist)
    const { data: members, error: membersError } = await supabase
      .from('company_members')
      .select('id, role, status')  // Removed 'email' from here
      .eq('company_id', companyId)
      .not('status', 'eq', 'deactivated');
    
    if (membersError) {
      console.error('Error fetching members:', membersError);
      return NextResponse.json({ error: 'Failed to fetch colleagues' }, { status: 500 });
    }
    
    // Get all member IDs to fetch their profiles
    const memberIds = members?.map(m => m.id) || [];
    
    // Fetch profiles for these members
    const { data: profiles, error: profilesError } = memberIds.length > 0 ? 
      await supabase
        .from('user_profiles')
        .select('id, name, email, avatar_url, job_title')
        .in('id', memberIds) : 
      { data: [], error: null };
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }
    
    // Create a map of profiles by ID for easy lookup
    const profileMap = new Map();
    if (profiles) {
      profiles.forEach(profile => {
        profileMap.set(profile.id, profile);
      });
    }
    
    // Fetch invited users
    const { data: invitedUsers, error: invitedError } = await supabase
      .from('invited_users')
      .select('id, name, email, role')
      .eq('company_id', companyId)
      .is('used_at', null);
    
    if (invitedError) {
      console.error('Error fetching invited users:', invitedError);
    }
    
    // Combined results array
    const results = [];
    
    // Process regular members
    if (members) {
      for (const member of members) {
        const profile = profileMap.get(member.id);
        
        // Skip members with no profile or email (since we need email for display and filtering)
        if (!profile || !profile.email) continue;
        
        const name = profile.name || profile.email.split('@')[0];
        const email = profile.email;
        
        // Check if this member matches the search query
        if (name.toLowerCase().includes(normalizedQuery) || 
            email.toLowerCase().includes(normalizedQuery)) {
          results.push({
            id: member.id,
            name: name,
            email: email,
            avatarUrl: profile.avatar_url || null,
            jobTitle: profile.job_title || null,
            role: member.role,
            companyid: companyId,
            status: member.status || 'member'
          });
        }
      }
    }
    
    // Process invited users
    if (invitedUsers) {
      for (const invitee of invitedUsers) {
        // Skip invited users with no email
        if (!invitee.email) continue;
        
        const name = invitee.name || invitee.email.split('@')[0];
        
        // Check if this invitee matches the search query
        if (name.toLowerCase().includes(normalizedQuery) || 
            invitee.email.toLowerCase().includes(normalizedQuery)) {
          results.push({
            id: invitee.id,
            name: name,
            email: invitee.email,
            role: invitee.role || 'member',
            isInvited: true,
            companyid: companyId,
            status: 'invited'
          });
        }
      }
    }
    
    // Add more detailed logging to help diagnose any issues
    console.log(`Search query "${searchQuery}" matched ${results.length} colleagues`);
    
    // Sort alphabetically by name
    results.sort((a, b) => a.name.localeCompare(b.name));
    
    // Limit to top results
    const limitedResults = results.slice(0, 10);
    
    return NextResponse.json({ results: limitedResults });
  } catch (error) {
    console.error('Error searching colleagues:', error);
    return NextResponse.json(
      { error: 'Failed to search colleagues', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}