// src/app/feedback/voice-agent/page.tsx
'use client';

import { Suspense } from 'react';
import VoiceAgentContent from './VoiceAgentContent';
import { Loader2 } from 'lucide-react';

export default function VoiceAgentPage() {
  return (
    <>
      <Suspense fallback={
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-cerulean" />
        </div>
      }>
        <VoiceAgentContent />
      </Suspense>
    </>
  );
}