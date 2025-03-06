// auth/register/invite/RegisterInviteContent.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Define invite details type
interface Company {
  name: string;
}

interface InviteDetails {
  id: string;
  email: string;
  name?: string;
  company_id: string;
  invite_code: string;
  status: string;
  used_at: string | null;
  created_at: string;
  companies?: Company;
}

const registerSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
});

export default function RegisterInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const inviteCode = searchParams.get('code');
  let email = searchParams.get('email');

  if (email) {
    email = email.replace(/ /g, '+'); // Fix `+` conversion issue
  }

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      password: '',
    },
  });

  useEffect(() => {
    async function fetchInvite() {
      if (!inviteCode || !email) {
        setError('Invalid invitation link.');
        setIsValidating(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/register/invite?code=${inviteCode}&email=${encodeURIComponent(email)}`);
        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Invalid or expired invitation.');
          setIsValidating(false);
          return;
        }

        setInviteDetails(result.invite);
        form.setValue('name', result.invite.name || '');
        setIsValidating(false);
      } catch (err) {
        console.error('Error fetching invite:', err);
        setError('An error occurred while validating your invitation.');
        setIsValidating(false);
      }
    }

    fetchInvite();
  }, [inviteCode, email, form]);

  async function onSubmit(values: z.infer<typeof registerSchema>) {
    if (!inviteDetails) {
      toast({
        title: 'Invalid invitation',
        description: 'Your invitation details could not be found.',
        variant: 'destructive',
      });
      return;
    }
  
    setIsLoading(true);
  
    try {
      // Send all required data directly to our API endpoint
      // Note: We're no longer using supabase.auth.signUp() directly
      const response = await fetch('/api/auth/register/invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inviteId: inviteDetails.id, 
          password: values.password, // Important: Include password
          email: inviteDetails.email, 
          name: values.name, 
          companyId: inviteDetails.company_id, 
          role: inviteDetails.company_id ? 'member' : 'admin' 
        }),
      });
  
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unknown error processing your registration.');
  
      toast({
        title: 'Account created!',
        description: 'You can now sign in with your new account.',
      });
  
      // Redirect to login without waiting for email confirmation
      setTimeout(() => {
        router.push('/auth/login?message=Your account has been created successfully. You can now sign in.');
      }, 2000);
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: 'Error creating account',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isValidating) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Validating Invitation</CardTitle>
            <CardDescription>Please wait while we validate your invitation...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Complete Your Registration</CardTitle>
          <CardDescription>
            You&#39;ve been invited to join <strong>{inviteDetails?.companies?.name || 'your organization'}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 bg-green-50 border-green-200">
            <AlertTitle className="text-green-800">Invitation Verified</AlertTitle>
            <AlertDescription className="text-green-700">
              Your invitation for {inviteDetails?.email} is valid.
            </AlertDescription>
          </Alert>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Please enter your full name" {...field} />
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
                      <Input type="password" placeholder="Please enter a password..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-slate-600">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}