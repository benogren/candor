// src/app/feedback/choice/page.tsx
'use client';

import { Suspense } from 'react';
import ChoicePageContent from './ChoicePageContent';
import FeedbackHeader from '@/components/feedbackHeader';

export default function ChoicePage() {
  return (
    <>
      <FeedbackHeader />
      <Suspense fallback={<div className="flex justify-center min-h-screen">Loading...</div>}>
        <ChoicePageContent />
      </Suspense>
    </>
  );
}