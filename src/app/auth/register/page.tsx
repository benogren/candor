// auth/register/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import supabase from '@/lib/supabase/client';

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

// Define form schema with conditional companyName field
const baseSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
});

const formSchema = baseSchema.extend({
  companyName: z.string().min(2, { message: 'Company name must be at least 2 characters' }).optional(),
});

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'userInfo' | 'companyInfo'>('userInfo');
  const [existingCompanyId, setExistingCompanyId] = useState<string | null>(null);
  const [existingCompanyName, setExistingCompanyName] = useState<string | null>(null);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      companyName: '',
    },
  });

  // Check if the domain exists when email changes
  const email = form.watch('email');
  
  useEffect(() => {
    const checkDomain = async () => {
      if (!email || !email.includes('@')) return;
      
      const domain = email.split('@')[1];
      if (!domain) return;
      
      try {
        const { data: companies, error } = await supabase
          .from('companies')
          .select('id, name')
          .contains('domains', [domain])
          .limit(1);
        
        if (error) throw error;
        
        if (companies && companies.length > 0) {
          setExistingCompanyId(companies[0].id);
          setExistingCompanyName(companies[0].name);
        } else {
          setExistingCompanyId(null);
          setExistingCompanyName(null);
        }
      } catch (error) {
        console.error('Error checking domain:', error);
      }
    };
    
    checkDomain();
  }, [email]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true);
      console.log('Starting registration process...');
      
      const domain = values.email.split('@')[1];
      console.log('Domain:', domain);
      
      let companyId: string;
      
      // If we already found an existing company ID, use it
      if (existingCompanyId) {
        console.log('Using existing company ID:', existingCompanyId);
        companyId = existingCompanyId;
      } else {
        // If no existing company with this domain, create a new one
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .insert({
            name: values.companyName,
            domains: [domain],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();
        
        if (companyError) {
          console.error('Company creation error:', companyError);
          throw companyError;
        }
        
        if (!company) {
          throw new Error('Failed to create company');
        }
        
        console.log('Company created successfully:', company);
        companyId = company.id;
      }
      
      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            name: values.name,
            pending_company_id: companyId,
            pending_company_role: existingCompanyId ? 'member' : 'admin'
          },
        }
      });
      
      if (signUpError) {
        console.error('User signup error:', signUpError);
        throw signUpError;
      }
      
      if (!authData.user) {
        console.error('No user returned from signup');
        throw new Error('Failed to create user');
      }
      
      console.log('User created successfully:', authData.user.id);
      
      // Instead of creating the company_members record directly,
      // save this info in the user metadata to be processed
      // when the user confirms their email
      
      // Store the registration info - this will be used later
      try {
        // Use API route to bypass RLS on pending_registrations
        const response = await fetch('/api/auth/register/pending', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: authData.user.id,
            email: values.email,
            name: values.name,
            companyId,
            role: existingCompanyId ? 'member' : 'admin'
          }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          console.warn('Error storing pending registration:', result.error);
          // Non-critical error, we can continue
        }
      } catch (pendingErr) {
        console.warn('Failed to store pending registration:', pendingErr);
        // Continue execution, as this is just a backup
      }
      
      toast({
        title: 'Account created!',
        description: 'Please check your email to confirm your account.',
      });
      
      // Redirect to confirmation page or login page
      setTimeout(() => {
        router.push('/auth/login?message=Please check your email to confirm your account');
        router.refresh();
      }, 2000);
      
    } catch (error: unknown) {
      console.error('Registration error:', error);
      
      let errorMessage = 'Please try again later';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = 'Unknown error occurred';
        }
      }
      
      toast({
        title: 'Error creating account',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // This function handles the continue button click with proper async/await
  const handleContinueClick = async () => {
    try {
      const isValid = await form.trigger(['name', 'email', 'password']);
      
      if (isValid) {
        // If joining an existing company, skip company info step and submit the form
        if (existingCompanyId) {
          // Call onSubmit directly with the current form values
          await onSubmit(form.getValues());
        } else {
          setStep('companyInfo');
        }
      }
    } catch (error) {
      console.error('Error in continue button handler:', error);
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create a Candor Account</CardTitle>
          <CardDescription>
            {step === 'userInfo' 
              ? 'Start by entering your information' 
              : 'Now tell us about your company'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {step === 'userInfo' ? (
                <>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  {existingCompanyId && (
                    <div className="rounded-md bg-blue-50 p-4 mt-2">
                      <div className="flex">
                        <div className="ml-3">
                          <p className="text-sm font-medium text-blue-800">
                            You&#39;ll be joining {existingCompanyName || 'your company'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="********" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="button" 
                    className="w-full"
                    onClick={handleContinueClick}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {existingCompanyId ? 'Creating Account...' : 'Processing...'}
                      </>
                    ) : (
                      existingCompanyId ? 'Create Account' : 'Continue'
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Inc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setStep('userInfo')}
                    >
                      Back
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </div>
                </>
              )}
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