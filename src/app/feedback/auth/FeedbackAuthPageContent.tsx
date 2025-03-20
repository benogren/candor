'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import supabase from '@/lib/supabase/client';

export default function FeedbackAuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No authentication token provided');
      setIsCheckingAuth(false);
      return;
    }

    // First check if the user is authenticated
    const checkAuthentication = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('No active session, redirecting to login');
          // User is not authenticated, redirect to login with return path
          const currentPath = `/feedback/auth?token=${encodeURIComponent(token)}`;
          const loginPath = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
          router.push(loginPath);
          return;
        }
        
        // User is authenticated, continue with token verification
        setIsCheckingAuth(false);
        await verifyFeedbackToken(session.access_token);
      } catch (error) {
        console.error('Session check error:', error);
        setStatus('error');
        setError('Failed to check authentication status');
        setIsCheckingAuth(false);
      }
    };

    const verifyFeedbackToken = async (bearerToken: string) => {
      try {
        const response = await fetch(`/api/feedback/auth?token=${token}`, {
          headers: {
            'Authorization': `Bearer ${bearerToken}`
          }
        });
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

    checkAuthentication();
  }, [token, router]);

  // Show different loading state when checking auth vs verifying token
  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Checking Authentication</CardTitle>
            <CardDescription>
              Verifying your login status...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-cerulean" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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