// app/api/org-chart/bulk-update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { ManagerAssignment } from '@/app/types/orgChart.types';

export async function PATCH(request: NextRequest) {
  // Create Supabase client
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
  
  // Get the session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check if the user is an admin or owner
  const { data: userData, error: userError } = await supabase
    .from('company_members')
    .select('role')
    .eq('id', session.user.id)
    .single();
  
  if (userError || !userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { assignments } = body as { assignments: ManagerAssignment[] };

    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json({ error: 'Valid assignments array is required' }, { status: 400 });
    }

    // Update all users' managers in a transaction
    await prisma.$transaction(
      assignments.map((assignment) =>
        prisma.company_members.update({
          where: { id: assignment.userId },
          data: { manager_id: assignment.managerId || null },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error bulk updating managers:', error);
    return NextResponse.json({ error: 'Failed to bulk update managers' }, { status: 500 });
  }
}