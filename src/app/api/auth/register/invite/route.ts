import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inviteCode = searchParams.get('code');
  let email = searchParams.get('email');

  if (!inviteCode || !email) {
    return NextResponse.json({ error: 'Invalid invitation link.' }, { status: 400 });
  }

  // Fix email formatting (replace spaces back to `+`)
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
    const { data, error } = await supabase
      .from('invited_users')
      .select('id, email, name, company_id, invite_code, status, used_at, created_at, companies:company_id(name)')
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
    // const { inviteId } = await request.json();
    const { inviteId, userId, email, name, companyId, role } = await request.json();
  
    if (!inviteId) {
      return NextResponse.json({ error: 'Missing invite ID.' }, { status: 400 });
    }
  
    try {
      //update invite status  
      const { error: invite_error } = await supabase
        .from('invited_users')
        .update({
          used_at: new Date().toISOString(),
          status: 'registered',
        })
        .eq('id', inviteId);
  
      if (invite_error) {
        console.error('Error updating invite:', invite_error);
        return NextResponse.json({ error: 'Failed to update invite status.' }, { status: 500 });
      }

      //add pending registration
      const { error: pending_error } = await supabase
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

      if (pending_error) {
        console.error('Error add pending registration:', pending_error);
        return NextResponse.json({ error: 'Failed to add pending registration.' }, { status: 500 });
      }
  
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error('Server error:', err);
      return NextResponse.json({ error: 'Server error while updating invite.' }, { status: 500 });
    }
  }