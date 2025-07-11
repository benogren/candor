// src/app/api/voice-agent/elevenlabs/signed-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get ElevenLabs credentials
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    if (!apiKey || !agentId) {
      return NextResponse.json({
        error: 'ElevenLabs configuration missing',
        details: 'ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID must be set for private agents'
      }, { status: 500 });
    }

    // Parse request body for context (optional)
    // const { context } = await request.json();

    // Get signed URL from ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      {
        headers: {
          'xi-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs signed URL error:', response.status, errorText);
      return NextResponse.json({
        error: `Failed to get signed URL: ${response.status}`,
        details: errorText
      }, { status: response.status });
    }

    const data = await response.json();

    return NextResponse.json({
      signedUrl: data.signed_url,
      success: true
    });

  } catch (error) {
    console.error('Error getting signed URL:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate signed URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}