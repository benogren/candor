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

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

// Function to determine if a message should block redirection
function shouldBlockRedirect(message: string | null): boolean {
  if (!message) return false;
  
  // Messages that should block redirection
  const blockingMessages = [
    'confirm your account',
    'email verification',
    'verify your email'
  ];
  
  return blockingMessages.some(phrase => message.toLowerCase().includes(phrase));
}

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
  const [messageShownToUser, setMessageShownToUser] = useState(false);
  
  // Using useRef instead of useState for redirectAttempts since we don't need it for rendering
  const redirectAttemptsRef = React.useRef(0);
  // Timer to track how long a message has been shown
  const messageTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  
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
      setMessageShownToUser(true);
      
      toast({
        title: 'Notice',
        description: message,
      });
      
      // For non-blocking messages (like password reset success),
      // set a timer to allow redirect after showing the message
      if (!shouldBlockRedirect(message)) {
        messageTimerRef.current = setTimeout(() => {
          console.log('Message has been shown, allowing redirect');
          setMessageShownToUser(false);
        }, 2500); // Show message for 2.5 seconds before allowing redirect
      }
    }
    
    if (error) {
      console.log('Processing URL error parameter:', error);
      setUrlError(error);
      setMessageProcessed(true);
      setMessageShownToUser(true);
      
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    }
    
    return () => {
      // Clean up timer if component unmounts
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
    };
  }, [searchParams, messageProcessed]);

  // Handle redirection in useEffect when user is already logged in
  useEffect(() => {
    const message = searchParams.get('message');
    
    // Add explicit console logs to debug the flow
    console.log("Auth state check:", {
      isInitialized,
      user: user ? "exists" : "none",
      messageProcessed,
      messageShownToUser,
      message
    });
    
    // Don't redirect if:
    // 1. Auth state isn't initialized yet
    // 2. No user is logged in
    // 3. We're currently showing a message to the user
    // 4. There's a blocking message (like email verification)
    if (!isInitialized || !user || messageShownToUser || shouldBlockRedirect(message)) {
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
  }, [user, isInitialized, messageShownToUser, messageProcessed, router, searchParams]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true);
      
      // Reset message states
      setMessageProcessed(false);
      setMessageShownToUser(false);
      
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
      
      // Clear URL parameters
      if (window.history.replaceState) {
        const newUrl = window.location.pathname;
        window.history.replaceState(null, '', newUrl);
      }
      
      // Get redirect path
      let redirectPath = '/dashboard';
      try {
        const storedPath = sessionStorage.getItem('redirectPath');
        if (storedPath) {
          redirectPath = storedPath;
          sessionStorage.removeItem('redirectPath');
        }
      } catch (e) {
        console.warn('Could not access sessionStorage:', e);
      }
      
      // Manual redirect after successful login
      setTimeout(() => {
        console.log('Manual redirect to:', redirectPath);
        router.push(redirectPath);
      }, 1000);
      
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

  const message = searchParams.get('message');
  const blockingMessage = shouldBlockRedirect(message);

  // Show loading if already authenticated but waiting for redirect
  // Don't show loading screen if there's a blocking message or we're showing a message to the user
  if (isInitialized && user && !blockingMessage && !messageShownToUser) {
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
              <AlertDescription className="text-green-700">
                {displayMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Show error message if present */}
          {displayError && (
            <Alert variant="destructive" className="mb-4">
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