'use client';

import { useState, useEffect, Suspense } from 'react';
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

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const { user, login } = useAuth();
  // We don't need to read this value, but we need the setter function
  const [, setRedirectAttempts] = useState(0);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Handle URL message parameters
  useEffect(() => {
    const message = searchParams.get('message');
    const error = searchParams.get('error');
    
    if (message) {
      toast({
        title: 'Notice',
        description: message,
      });
      
      // Remove the message from the URL to prevent showing it again on refresh
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('message');
      window.history.replaceState({}, '', newUrl.toString());
    }
    
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
      
      // Remove the error from the URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [searchParams]);

  // Handle redirection in useEffect when user is already logged in
  useEffect(() => {
    if (!user) return;
    
    // Get the stored redirect path, defaulting to dashboard
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
    
    // Prevent infinite redirect loops
    setRedirectAttempts(prev => {
      const newCount = prev + 1;
      if (newCount > 3) {
        console.warn('Too many redirect attempts, forcing to dashboard');
        redirectPath = '/dashboard';
      }
      return newCount;
    });
    
    // Add a small delay to ensure context is fully updated
    const redirectTimeout = setTimeout(() => {
      router.push(redirectPath);
    }, 100);
    
    return () => clearTimeout(redirectTimeout);
  }, [user, router]);

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

  // Show loading if already authenticated but waiting for redirect
  if (user) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-slate-50">
        <LoadingSpinner />
        <p className="mt-4 text-gray-500">Redirecting to your dashboard...</p>
      </div>
    );
  }

  // Get message/error from URL params to display inline as well
  const urlMessage = searchParams.get('message');
  const urlError = searchParams.get('error');

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in to Candor</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Show success message if present */}
          {urlMessage && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                {urlMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Show error message if present */}
          {urlError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {urlError}
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
              <Button 
                type="submit" 
                className="w-full"
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

// Loading state for Suspense fallback
function LoginLoadingFallback() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50">
      <LoadingSpinner />
      <p className="ml-2">Loading...</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <LoginContent />
    </Suspense>
  );
}