// src/app/feedback/questions/page.tsx
'use client';

import { Suspense } from 'react';
import QuestionsContent from './QuestionsContent';

export default function QuestionsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cerulean"></div>
        <span className="ml-2">Loading...</span>
      </div>
    }>
      <QuestionsContent />
    </Suspense>
  );
}