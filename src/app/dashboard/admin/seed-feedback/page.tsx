// app/dashboard/admin/seed-feedback/page.tsx
'use client';

import { useAuth } from '@/lib/context/auth-context';
import FeedbackSeederPage from '@/components/FeedbackSeederPage';

export default function AdminSeedFeedbackPage() {
  const { user } = useAuth();

  // Only allow in staging/development environments
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Not Available in Production</h1>
          <p className="text-gray-600">This tool is only available in staging environments.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <FeedbackSeederPage />;
}