'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/auth-context';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle } from 'lucide-react';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const { user, login, isInitialized } = useAuth();
  
  // Store the message/error in state to persist even if URL changes
  const [urlMessage, setUrlMessage] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  
  // Get the redirect parameter if present
  const redirectParam = searchParams.get('redirect');
  
  // Track if we've processed the params
  const [messageProcessed, setMessageProcessed] = useState(false);
  // Using useRef instead of useState for redirectAttempts since we don't need it for rendering
  const redirectAttemptsRef = React.useRef(0);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Store redirect in sessionStorage when it's in the URL
  useEffect(() => {
    if (redirectParam) {
      try {
        sessionStorage.setItem('redirectPath', redirectParam);
        console.log('Stored redirect path:', redirectParam);
      } catch (e) {
        console.warn('Could not store redirect path in sessionStorage:', e);
      }
    }
  }, [redirectParam]);

  // Handle URL message parameters
  useEffect(() => {
    // Don't process if we've already done so
    if (messageProcessed) return;
    
    const message = searchParams.get('message');
    const error = searchParams.get('error');
    
    // Store in state instead of just showing toast
    if (message) {
      console.log('Processing URL message parameter:', message);
      setUrlMessage(message);
      setMessageProcessed(true);
      
      toast({
        title: 'Notice',
        description: message,
      });
      
      // Don't modify history/URL in development mode - it triggers rebuilds
      /*
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('message');
      window.history.replaceState({}, '', newUrl.toString());
      */
    }
    
    if (error) {
      console.log('Processing URL error parameter:', error);
      setUrlError(error);
      setMessageProcessed(true);
      
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
      
      // Don't modify history/URL in development mode
      /*
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      window.history.replaceState({}, '', newUrl.toString());
      */
    }
  }, [searchParams, messageProcessed]);

  // Handle redirection in useEffect when user is already logged in
  useEffect(() => {
    // Add explicit console logs to debug the flow
    console.log("Auth state check:", {
      isInitialized,
      user: user ? "exists" : "none",
      messageProcessed,
      emailMessage: searchParams.get('message')?.includes('confirm your account') || false
    });
    
    // Check if the message is about email verification
    const emailVerificationRequired = searchParams.get('message')?.includes('confirm your account') || false;
    
    // Don't redirect if:
    // 1. Auth state isn't initialized yet
    // 2. No user is logged in
    // 3. We're currently processing a message
    // 4. There's an email verification message (new condition)
    if (!isInitialized || !user || messageProcessed || emailVerificationRequired) {
      return;
    }
    
    // Get the stored redirect path, defaulting to dashboard
    let redirectPath = '/dashboard';
    try {
      const storedPath = sessionStorage.getItem('redirectPath');
      if (storedPath) {
        redirectPath = storedPath;
        sessionStorage.removeItem('redirectPath');
        console.log('Redirecting to stored path:', redirectPath);
      } else {
        console.log('No stored path, redirecting to dashboard');
      }
    } catch (e) {
      console.warn('Could not access sessionStorage:', e);
    }
    
    // Prevent infinite redirect loops
    redirectAttemptsRef.current += 1;
    if (redirectAttemptsRef.current > 3) {
      console.warn('Too many redirect attempts, forcing to dashboard');
      redirectPath = '/dashboard';
    }
    
    // Add a delay to ensure all processing is complete
    const redirectTimeout = setTimeout(() => {
      console.log('Executing redirect to:', redirectPath);
      router.push(redirectPath);
    }, 500);
    
    return () => clearTimeout(redirectTimeout);
  }, [user, isInitialized, messageProcessed, router, searchParams]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true);
      
      const { error } = await login(values.email, values.password);
      
      if (error) {
        toast({
          title: 'Error signing in',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Signed in successfully',
        description: 'Welcome back to Candor!',
      });
      
      // UseEffect will handle redirect when user state updates
      
    } catch (error: unknown) {
      console.error('Login error:', error);
      
      toast({
        title: 'Something went wrong',
        description: error instanceof Error ? error.message : 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Check if the message is about email verification
  const emailVerificationRequired = searchParams.get('message')?.includes('confirm your account') || false;

  // Show loading if already authenticated but waiting for redirect
  // Don't show loading screen if there's an email verification message
  if (isInitialized && user && !emailVerificationRequired) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-slate-50">
        <LoadingSpinner />
        <p className="mt-4 text-gray-500">Redirecting to your dashboard...</p>
      </div>
    );
  }

  // Show loading if auth state is still initializing
  if (!isInitialized) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-slate-50">
        <LoadingSpinner />
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    );
  }

  // Use the state variables instead of reading directly from URL
  // Fall back to URL parameters if state is not set (first render)
  const displayMessage = urlMessage || searchParams.get('message');
  const displayError = urlError || searchParams.get('error');

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in to Candor</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
            {redirectParam && (
              <p className="mt-2 text-sm text-slate-500">
                You&#39;ll be redirected after signing in
              </p>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Show success message if present */}
          {displayMessage && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                {displayMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Show error message if present */}
          {displayError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {displayError}
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Please enter your password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Forgot password link */}
              <div className="flex justify-end mt-1">
                <Link 
                  href="/auth/forgot-password" 
                  className="text-sm text-cerulean hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button 
                type="submit" 
                className="w-full mt-4"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-slate-500 font-light">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-cerulean hover:underline">
              Register
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}