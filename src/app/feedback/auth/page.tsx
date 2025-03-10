// src/app/feedback/auth/page.tsx
'use client';

import { Suspense } from 'react';
import FeedbackAuthPageContent from './FeedbackAuthPageContent';

export default function FeedbackAuthPage() {
  return (
    <Suspense fallback={<div className="flex justify-center min-h-screen">Loading...</div>}>
      <FeedbackAuthPageContent />
    </Suspense>
  );
}