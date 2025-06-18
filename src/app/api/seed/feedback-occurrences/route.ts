// /api/seed/feedback-occurrences/route.ts
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

    // Get user's company and check if they're an admin
    const { data: member } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!member || member.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // First get feedback cycles for this company
    const { data: cycles, error: cyclesError } = await supabase
      .from('feedback_cycles')
      .select('id')
      .eq('company_id', member.company_id);

    if (cyclesError) {
      console.error('Error fetching cycles:', cyclesError);
      return NextResponse.json({ error: 'Failed to fetch cycles' }, { status: 500 });
    }

    if (!cycles || cycles.length === 0) {
      return NextResponse.json({ occurrences: [] });
    }

    const cycleIds = cycles.map(c => c.id);

    // Now get occurrences for these cycles
    const { data: occurrences, error } = await supabase
      .from('feedback_cycle_occurrences')
      .select(`
        id,
        occurrence_number,
        start_date,
        end_date,
        status,
        emails_sent_count,
        responses_count,
        cycle_id
      `)
      .in('cycle_id', cycleIds)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching occurrences:', error);
      return NextResponse.json({ error: 'Failed to fetch occurrences' }, { status: 500 });
    }

    return NextResponse.json({ occurrences });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}