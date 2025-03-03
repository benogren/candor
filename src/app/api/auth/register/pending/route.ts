// app/api/auth/register/pending/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Create admin client to bypass RLS
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
    
    // Parse request body
    const body = await request.json();
    const { userId, email, name, companyId, role } = body;
    
    if (!userId || !email || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Store pending registration using admin client to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('pending_registrations')
      .insert({
        user_id: userId,
        email,
        name,
        company_id: companyId,
        role: role || 'member',
        created_at: new Date().toISOString()
      })
      .select();
      
    if (error) {
      console.error('Error storing pending registration:', error);
      return NextResponse.json(
        { error: `Failed to store registration: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in register-pending API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}