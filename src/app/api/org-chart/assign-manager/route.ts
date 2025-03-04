// app/api/org-chart/assign-manager/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

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
    const { userId, managerId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Update the user's manager in the database
    await prisma.company_members.update({
      where: { id: userId },
      data: { manager_id: managerId || null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error assigning manager:', error);
    return NextResponse.json({ error: 'Failed to assign manager' }, { status: 500 });
  }
}