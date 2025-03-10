'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function FeedbackAuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No authentication token provided');
      return;
    }

    const authenticateUser = async () => {
      try {
        const response = await fetch(`/api/feedback/auth?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Authentication failed');
        }

        setStatus('success');

        setTimeout(() => {
          router.push(data.redirectTo || '/feedback');
        }, 1500);
      } catch (error) {
        console.error('Authentication error:', error);
        setStatus('error');
        setError(error instanceof Error ? error.message : 'Authentication failed');
      }
    };

    authenticateUser();
  }, [token, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authenticating</CardTitle>
          <CardDescription>
            {status === 'loading' && 'Verifying your authentication token...'}
            {status === 'success' && 'Authentication successful!'}
            {status === 'error' && 'Authentication failed'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-cerulean" />
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-4">
              <p className="text-green-600 mb-4">You are now authenticated.</p>
              <p className="text-slate-600">Redirecting you to the feedback page...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-4">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={() => router.push('/auth/login')} className="mt-2">
                Go to login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}