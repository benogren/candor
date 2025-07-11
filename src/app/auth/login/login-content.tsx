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
  
  // Handle URL messages when searchParams change
  useEffect(() => {
    const message = searchParams.get('message');
    const error = searchParams.get('error');
    
    if (message) {
      toast({
        title: 'Notice',
        description: message,
      });
    }
    
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    }
  }, [searchParams]); // Include searchParams in dependency array

  // Handle redirect when user is already authenticated
  useEffect(() => {
    if (isInitialized && user) {
      const redirectParam = searchParams.get('redirect');
      
      if (redirectParam) {
        const decodedPath = decodeURIComponent(redirectParam);
        console.log(`User already authenticated, redirecting to: ${decodedPath}`);
        router.replace(decodedPath);
      } else {
        console.log('User already authenticated, redirecting to dashboard');
        router.replace('/dashboard');
      }
    }
  }, [isInitialized, user, router, searchParams]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true);
      
      console.log('Attempting login...');
      const { error } = await login(values.email, values.password);
      
      if (error) {
        console.error('Login error:', error.message);
        toast({
          title: 'Error signing in',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }
  
      // Login successful
      console.log('Login successful');
      toast({
        title: 'Signed in successfully',
        description: 'Welcome back to Candor!',
      });
      
      // Handle redirect immediately - no setTimeout
      const redirectParam = searchParams.get('redirect');
      if (redirectParam) {
        const decodedPath = decodeURIComponent(redirectParam);
        console.log(`Redirecting to custom path: ${decodedPath}`);
        router.replace(decodedPath);
      } else {
        console.log('No redirect parameter, going to dashboard');
        router.replace('/dashboard');
      }
      
    } catch (error: unknown) {
      console.error('Unexpected login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      toast({
        title: 'Something went wrong',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
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

  // Show loading if already authenticated (will redirect via useEffect)
  if (user) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-slate-50">
        <LoadingSpinner />
        <p className="mt-4 text-gray-500">Already signed in. Redirecting...</p>
      </div>
    );
  }

  // Get current URL params for display
  const currentMessage = searchParams.get('message');
  const currentError = searchParams.get('error');
  const redirectParam = searchParams.get('redirect');

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
          {currentMessage && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <AlertDescription className="text-green-700">
                {currentMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Show error message if present */}
          {currentError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {currentError}
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