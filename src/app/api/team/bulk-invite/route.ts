// app/api/team/bulk-invite/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Define proper types for the user object
interface UserToInvite {
  email: string;
  name?: string;
  role?: 'admin' | 'member';
}

// Define proper types for the request body
interface BulkInviteRequestBody {
  users: UserToInvite[];
  companyId: string;
  adminId: string;
}

// Define proper types for the results
interface SuccessResult {
  id: string;
  email: string;
  name: string;
}

interface ErrorResult {
  user: UserToInvite;
  message: string;
}

interface BulkInviteResults {
  success: SuccessResult[];
  errors: ErrorResult[];
}

export async function POST(request: NextRequest) {
  console.log('Bulk Invite API route called');
  
  try {
    // Check if environment variables are set
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables:', {
        url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      });
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
    
    // Parse the request body
    let body: BulkInviteRequestBody;
    try {
      body = await request.json();
      console.log('Request body overview:', { 
        userCount: body.users?.length, 
        companyId: body.companyId,
        adminId: body.adminId
      });
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body: Could not parse JSON' },
        { status: 400 }
      );
    }
    
    const { users, companyId, adminId } = body;
    
    if (!Array.isArray(users) || !companyId || !adminId) {
      console.error('Missing required fields or invalid format:', {
        usersIsArray: Array.isArray(users),
        companyId,
        adminId
      });
      return NextResponse.json(
        { error: 'Missing required fields or invalid format' },
        { status: 400 }
      );
    }
    
    // Check admin status
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
    
    const results: BulkInviteResults = {
      success: [],
      errors: []
    };
    
    // Process each user in the array
    console.log(`Processing ${users.length} users`);
    for (const user of users) {
      try {
        const { email, name, role = 'member' } = user;
        
        if (!email) {
          console.log('Skipping user with no email:', user);
          results.errors.push({ user, message: 'Email is required' });
          continue;
        }
        
        // Generate a UUID
        const userId = crypto.randomUUID();
        console.log(`Processing user: ${email}, ID: ${userId}`);
        
        // Insert profile
        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            id: userId,
            email: email,
            name: name || email.split('@')[0], // Default name if not provided
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
        if (profileError) {
          console.error(`Profile creation failed for ${email}:`, profileError);
          results.errors.push({ 
            user, 
            message: `Profile creation failed: ${profileError.message}` 
          });
          continue;
        }
        
        // Insert company member
        const { error: memberError } = await supabaseAdmin
          .from('company_members')
          .insert({
            id: userId,
            company_id: companyId,
            role: role,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
        if (memberError) {
          console.error(`Company member creation failed for ${email}:`, memberError);
          results.errors.push({ 
            user, 
            message: `Company member creation failed: ${memberError.message}` 
          });
          continue;
        }
        
        // Success
        console.log(`Successfully invited user: ${email}`);
        results.success.push({
          id: userId,
          email: email,
          name: name || email.split('@')[0]
        });
      } catch (userError) {
        console.error('Error processing user:', user, userError);
        results.errors.push({ 
          user, 
          message: userError instanceof Error ? userError.message : 'Unknown error' 
        });
      }
    }
    
    console.log('Bulk invite completed with results:', {
      successCount: results.success.length,
      errorCount: results.errors.length
    });
    
    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Critical error in bulk invite API route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}