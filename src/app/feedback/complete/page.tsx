// src/app/feedback/complete/page.tsx
'use client';

import Link from 'next/link';
import FeedbackHeader from '@/components/feedbackHeader';

export default function FeedbackCompletePage() {
  return (
    <>
    <FeedbackHeader />
        <div className="container mx-auto py-8 px-4 max-w-xl">
        <h1 className='text-4xl font-light text-berkeleyblue pb-2'>Thank you for submitting your feedback!</h1>
        <p className='text-slate-500 text-base font-light pb-4'>Thank you for providing feedback, your insights help your team grow and improve. You&#39;ll receive another opportunity to provide feedback in the next cycle.</p>
        <Link className='bg-cerulean text-primary-foreground hover:bg-cerulean-600 rounded-md text-sm font-normal h-9 px-4 py-2' href='/dashboard'>Return to dashboard</Link>
        </div>
    </>
  );
}