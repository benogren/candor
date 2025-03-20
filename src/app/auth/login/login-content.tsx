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
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });
  
  // Store the message/error in state to persist even if URL changes
  const [urlMessage, setUrlMessage] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  
  // Get the redirect parameter directly - store in a ref for durability
  const redirectParamRef = React.useRef<string | null>(searchParams.get('redirect'));
  const redirectParam = searchParams.get('redirect');
  
  // Track if we've processed the params
  const [messageProcessed, setMessageProcessed] = useState(false);
  const [messageShownToUser, setMessageShownToUser] = useState(false);
  
  // Log the current URL and redirect parameter when the component mounts
  useEffect(() => {
    if (redirectParam) {
      redirectParamRef.current = redirectParam;
      console.log('Detected redirect parameter:', {
        raw: redirectParam,
        decoded: decodeURIComponent(redirectParam)
      });
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
        setTimeout(() => {
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
    
  }, [searchParams, messageProcessed]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true);
      setUrlError(null); // Clear any previous errors
      
      // Reset message states
      setMessageProcessed(false);
      setMessageShownToUser(false);
      
      // Capture the redirect parameter before login
      const redirectPathToUse = redirectParamRef.current;
      console.log('Captured redirect before login:', redirectPathToUse);
      
      const { error } = await login(values.email, values.password);
      
      if (error) {
        console.error('Login error:', error.message);
        
        // Set the error in state so it displays in the UI
        setUrlError(error.message);
        
        // Also show a toast for immediate feedback
        toast({
          title: 'Error signing in',
          description: error.message,
          variant: 'destructive',
        });
        
        return; // Stop execution here
      }
  
      // If we get here, login was successful
      toast({
        title: 'Signed in successfully',
        description: 'Welcome back to Candor!',
      });
      
      // Set a short delay to ensure the login completes
      setTimeout(() => {
        // Use the captured redirect parameter if available
        if (redirectPathToUse) {
          const decodedPath = decodeURIComponent(redirectPathToUse);
          console.log(`Redirecting to custom path: ${decodedPath}`);
          router.push(decodedPath);
        } else {
          console.log('No redirect parameter, going to dashboard');
          router.push('/dashboard');
        }
      }, 1500);
      
    } catch (error: unknown) {
      console.error('Unexpected login error:', error);
      
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      // Set the error in state so it displays in the UI
      setUrlError(errorMessage);
      
      toast({
        title: 'Something went wrong',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Block automatic redirects for clarity - we'll handle redirects only in the form submission
  const message = searchParams.get('message');
  const blockingMessage = shouldBlockRedirect(message);

  // Show loading if already authenticated but waiting for redirect
  // Only show when there's no message being displayed
  if (isInitialized && user && !messageShownToUser && !blockingMessage) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-slate-50">
        <LoadingSpinner />
        <p className="mt-4 text-gray-500">Already signed in. Redirecting...</p>
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