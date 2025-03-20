'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ForgotPasswordContent from './forgot-password-content';

// Loading fallback for Suspense
function ForgotPasswordLoading() {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-cerulean mb-4" />
      <p className="text-slate-600">Loading...</p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<ForgotPasswordLoading />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}