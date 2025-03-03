// app/api/team/invite/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('Invite API route called');
  
  try {
    // Check if environment variables are set
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: Missing environment variables' },
        { status: 500 }
      );
    }
    
    // Create the admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Parse the request body
    let body;
    try {
      body = await request.json();
      console.log('Request body:', body);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body: Could not parse JSON' },
        { status: 400 }
      );
    }
    
    const { email, name, role, companyId, adminId } = body;
    
    if (!email || !name || !role || !companyId || !adminId) {
      console.error('Missing required fields:', { email, name, role, companyId, adminId });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Test DB connection
    try {
      const { data: testData, error: testError } = await supabaseAdmin.from('companies').select('count').limit(1);
      if (testError) {
        console.error('Database connection test failed:', testError);
        return NextResponse.json(
          { error: `Database connection failed: ${testError.message}` },
          { status: 500 }
        );
      }
      console.log('Database connection test succeeded:', testData);
    } catch (dbError) {
      console.error('Database connection test threw exception:', dbError);
      return NextResponse.json(
        { error: 'Failed to connect to database' },
        { status: 500 }
      );
    }
    
    // Check if the user is an admin for this company using the admin client
    console.log('Checking admin status for:', { adminId, companyId });
    const { data: adminCheck, error: adminCheckError } = await supabaseAdmin
      .from('company_members')
      .select('id')
      .eq('id', adminId)
      .eq('company_id', companyId)
      .eq('role', 'admin')
      .single();
      
    if (adminCheckError) {
      console.error('Admin check error:', adminCheckError);
      return NextResponse.json(
        { error: `Admin check failed: ${adminCheckError.message}` },
        { status: 403 }
      );
    }
    
    if (!adminCheck) {
      console.error('User is not an admin:', { adminId, companyId });
      return NextResponse.json(
        { error: 'You must be an admin to invite users' },
        { status: 403 }
      );
    }
    
    // Check if email is already invited
    const { data: existingInvite, error: inviteCheckError } = await supabaseAdmin
      .from('invited_users')
      .select('id')
      .eq('email', email)
      .eq('company_id', companyId)
      .maybeSingle();
      
    if (inviteCheckError) {
      console.error('Error checking for existing invite:', inviteCheckError);
    }
    
    if (existingInvite) {
      console.log('User already invited:', email);
      return NextResponse.json({
        success: true,
        message: 'User already invited',
        data: {
          email,
          name,
          id: existingInvite.id
        }
      });
    }
    
    // Generate a UUID for the new user
    const newUserId = crypto.randomUUID();
    console.log('Generated new user ID:', newUserId);
    
    // Generate invite code
    const { data: inviteCodeData } = await supabaseAdmin.rpc('generate_invite_code');
    const inviteCode = inviteCodeData || Math.random().toString(36).substring(2, 10);
    
    // Insert into invited_users table
    console.log('Creating invite for:', { email, name, id: newUserId });
    const { data: inviteData, error: inviteError } = await supabaseAdmin
      .from('invited_users')
      .insert({
        id: newUserId,
        email,
        name,
        role,
        company_id: companyId,
        invite_code: inviteCode,
        created_by: adminId,
        created_at: new Date().toISOString()
      })
      .select();
      
    if (inviteError) {
      console.error('Invite creation error:', inviteError);
      return NextResponse.json(
        { error: `Failed to create invitation: ${inviteError.message}` },
        { status: 500 }
      );
    }
    
    console.log('Invitation created successfully:', inviteData);
    
    // TODO: Send email invitation (omitted for now)
    
    return NextResponse.json({
      success: true,
      data: {
        id: newUserId,
        email,
        name,
        inviteCode
      }
    });
  } catch (error) {
    console.error('Critical error in invite API route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}