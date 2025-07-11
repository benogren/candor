// src/app/api/voice-agent/relationship/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Define the type for the joined company member and company data
type CompanyMemberWithCompany = {
  company_id: string;
  companies?: {
    industry?: string | null;
  } | null;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');
    const recipientId = searchParams.get('recipientId');
    
    if (!providerId || !recipientId) {
      return NextResponse.json({ 
        error: 'Missing providerId or recipientId' 
      }, { status: 400 });
    }

    // Get auth header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Use the existing user-relationship endpoint logic
    const relationshipResponse = await fetch(
      `${request.nextUrl.origin}/api/user-relationship?user1=${providerId}&user2=${recipientId}`,
      {
        headers: {
          'Authorization': authHeader
        }
      }
    );

    if (!relationshipResponse.ok) {
      return NextResponse.json({ 
        error: 'Failed to get relationship data' 
      }, { status: relationshipResponse.status });
    }

    const relationshipData = await relationshipResponse.json();

    // Get additional context like job title and industry
    const { data: recipientProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('job_title')
      .eq('id', recipientId)
      .maybeSingle();

      if (profileError) {
        console.error('Error fetching recipient profile:', profileError);
        return NextResponse.json({ 
          error: 'Failed to get recipient profile',
          details: profileError.message
        }, { status: 500 });
      }

    // Get company industry
    const { data: companyDataRaw, error: companyError } = await supabase
      .from('company_members')
      .select(`
        company_id,
        companies!inner(industry)
      `)
      .eq('id', providerId)
      .single();

      if (companyError) {
        console.error('Error fetching company data:', companyError);
        return NextResponse.json({ 
          error: 'Failed to get company data',
          details: companyError.message
        }, { status: 500 });
      }

    const companyData = companyDataRaw as CompanyMemberWithCompany | null;
    const jobTitle = recipientProfile?.job_title || null;
    const industry = companyData?.companies?.industry || null;

    return NextResponse.json({
      relationship: relationshipData.relationship,
      jobTitle,
      industry,
      users: relationshipData.users
    });

  } catch (error) {
    console.error('Error getting relationship data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get relationship data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}