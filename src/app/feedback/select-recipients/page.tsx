// src/app/feedback/select-recipients/page.tsx
'use client';

import { Suspense } from 'react';
import SelectRecipientsPageContent from './SelectRecipientsPageContent';

export default function SelectRecipientsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center min-h-screen">Loading...</div>}>
      <SelectRecipientsPageContent />
    </Suspense>
  );
}