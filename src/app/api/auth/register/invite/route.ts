// app/api/auth/register/invite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inviteCode = searchParams.get('code');
  let email = searchParams.get('email');

  if (!inviteCode || !email) {
    return NextResponse.json({ error: 'Invalid invitation link.' }, { status: 400 });
  }

  email = email.replace(/ /g, '+');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { 
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  
  try {
    // Updated query to include job_title in the invitation data
    const { data, error } = await supabase
      .from('invited_users')
      .select('id, email, name, company_id, invite_code, status, used_at, created_at, job_title, companies:company_id(name)')
      .eq('email', email)
      .eq('invite_code', inviteCode)
      .is('used_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Invalid or expired invitation.' }, { status: 400 });
    }

    return NextResponse.json({ invite: data });
  } catch (err) {
    console.error('Error validating invite:', err);
    return NextResponse.json({ error: 'Server error while validating invite.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { 
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  
  // Parse request data with improved error handling
  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
  }
  
  // Extract fields with validation
  const { inviteId, password, email, name, companyId, role } = requestBody;
  
  // Validate required fields
  const missingFields = [];
  if (!inviteId) missingFields.push('inviteId');
  if (!password) missingFields.push('password');
  if (!email) missingFields.push('email');
  if (!companyId) missingFields.push('companyId');
  
  if (missingFields.length > 0) {
    return NextResponse.json({ 
      error: `Missing required fields: ${missingFields.join(', ')}` 
    }, { status: 400 });
  }

  try {
    // First, get the complete invitation data with job_title
    const { data: inviteData, error: inviteQueryError } = await supabaseAdmin
      .from('invited_users')
      .select('name, job_title, company_id, role')
      .eq('id', inviteId)
      .single();
      
    if (inviteQueryError) {
      console.error('Error fetching invite data:', inviteQueryError);
      // Continue with the registration process even if we can't fetch invite data
    }
    
    // 1. Create a pre-verified user with admin API
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Skip email verification
      user_metadata: { 
        name: name || inviteData?.name,
        job_title: inviteData?.job_title
      }
    });

    if (userError) {
      console.error('Error creating user:', userError);
      return NextResponse.json({ 
        error: `Failed to create user account: ${userError.message}` 
      }, { status: 500 });
    }

    if (!userData.user) {
      return NextResponse.json({ 
        error: 'Failed to create user account: No user returned' 
      }, { status: 500 });
    }

    const userId = userData.user.id;

    // 2. Create company_members record directly
    const { error: memberError } = await supabaseAdmin
      .from('company_members')
      .insert({
        id: userId,
        company_id: companyId,
        role: role || inviteData?.role || 'member',
        status: 'active', // Directly active since we're pre-verifying
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (memberError) {
      console.error('Error creating company member:', memberError);
      // Attempt to clean up the user we just created
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ 
        error: `Failed to create company member: ${memberError.message}` 
      }, { status: 500 });
    }

    // 3. Create or update user profile with job title
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: userId,
        email: email,
        name: name || inviteData?.name,
        job_title: inviteData?.job_title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      // Continue even if profile creation fails
    }

    // 4. Mark invitation as used
    const { error: inviteError } = await supabaseAdmin
      .from('invited_users')
      .update({
        used_at: new Date().toISOString(),
        status: 'accepted',
      })
      .eq('id', inviteId);

    if (inviteError) {
      console.error('Error updating invite status:', inviteError);
      // We continue even if this fails since the user is created
    }

    // 5. Transfer manager relationships
    try {
      // Use our custom function to transfer relationships from invited user to real user
      const { error: relationshipError } = await supabaseAdmin.rpc(
        'transfer_manager_relationships',
        { 
          invited_user_id: inviteId, 
          auth_user_id: userId 
        }
      );

      if (relationshipError) {
        console.error('Error transferring manager relationships:', relationshipError);
        // Log but don't fail the whole process
      }
    } catch (relationshipError) {
      console.error('Exception transferring relationships:', relationshipError);
      // Log but continue
    }

    // We're now directly creating the user profile in step 3, so this function 
    // call is redundant but kept for backward compatibility if it exists
    // 6. Transfer profile info (if you're using this approach)
    try {
      const { error: profileTransferError } = await supabaseAdmin.rpc(
        'transfer_user_profile_info',
        { 
          invited_user_id: inviteId, 
          auth_user_id: userId 
        }
      );
    
      if (profileTransferError) {
        console.error('Error transferring profile info:', profileTransferError);
        // Non-critical since we've already created the profile
      }
    } catch (profileTransferError) {
      console.error('Exception transferring profile info:', profileTransferError);
      // Continue with registration process
    }

    return NextResponse.json({ 
      success: true,
      userId: userId
    });
  } catch (err) {
    console.error('Server error during registration:', err);
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Unknown server error' 
    }, { status: 500 });
  }
}