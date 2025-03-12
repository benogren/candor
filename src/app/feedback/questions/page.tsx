// src/app/feedback/questions/page.tsx
'use client';

import { Suspense } from 'react';
import QuestionsContent from './QuestionsContent';
import { Loader2 } from 'lucide-react';

export default function QuestionsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-cerulean" />
      </div>
    }>
      <QuestionsContent />
    </Suspense>
  );
}