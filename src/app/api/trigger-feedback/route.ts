// app/api/admin/trigger-feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const bearerToken = authHeader.substring(7);

    console.log('*****Token:', bearerToken);

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
    if (userError || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
      
      console.log(`User authenticated as: ${user.id}`);

  try {
    
    // Get user's role
    const { data: userData, error: roleError } = await supabase
      .from('company_members')
      .select('role')
      .eq('id', user.id)
      .single();

    //   console.log('*****User Data:', userData);
      
    if (roleError || !userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }
    
    // Parse request body
    const body = await request.json();
    const { cycleId, forceFriday = true, forceMonday = false } = body;
    
    if (!cycleId) {
      return NextResponse.json({ error: 'Cycle ID is required' }, { status: 400 });
    }
    
    // Call the Supabase Edge Function
    // Server-side we can use service key which bypasses CORS
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/schedule-feedback-emails`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        forceFriday,
        forceMonday,
        targetCycleId: cycleId
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Edge function error:', errorText);
      return NextResponse.json(
        { error: `Failed to trigger feedback emails: ${errorText}` },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in trigger-feedback API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}