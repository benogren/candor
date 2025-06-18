// app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';
import { LoadingSpinner } from '@/components/loading-spinner';

export default function RootPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuth();

  useEffect(() => {
    if (isInitialized) {
      if (user) {
        console.log('User authenticated, redirecting to dashboard');
        router.replace('/dashboard');
      } else {
        console.log('User not authenticated, redirecting to login');
        router.replace('/auth/login');
      }
    }
  }, [isInitialized, user, router]);

  // Show loading while checking auth or redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center">
        <LoadingSpinner />
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    </div>
  );
}