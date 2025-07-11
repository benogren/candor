// src/app/api/voice-agent/elevenlabs/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
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

    // Get ElevenLabs configuration
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    // If we have a public agent ID, return it
    if (agentId) {
      return NextResponse.json({
        agentId,
        configured: true,
        type: 'public'
      });
    }

    // If no agent ID, client should use signed URL approach
    return NextResponse.json({
      configured: true,
      type: 'private',
      message: 'Use signed URL for private agent'
    });

  } catch (error) {
    console.error('Error getting agent config:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get agent configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
