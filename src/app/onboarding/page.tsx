// app/onboarding/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

const formSchema = z.object({
  companyName: z.string().min(2, { message: 'Company name must be at least 2 characters' }),
});

export default function OnboardingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true);
      
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not found');
      }

      // Extract email domain
      const emailDomain = user.email?.split('@')[1];

      if (!emailDomain) {
        throw new Error('Invalid email');
      }

      // Create new company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: values.companyName,
          domains: [emailDomain],
        })
        .select('id')
        .single();

      if (companyError || !company) {
        throw companyError || new Error('Failed to create company');
      }

      // Add user as admin to the new company
      const { error: memberError } = await supabase
        .from('company_members')
        .insert({
          id: user.id,
          company_id: company.id,
          role: 'admin',
        });

      if (memberError) {
        throw memberError;
      }

      toast({
        title: 'Company created!',
        description: 'You are now an admin of ' + values.companyName,
      });

      router.push('/dashboard');
      router.refresh();
    } catch (error: unknown) {
      console.error('Onboarding error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Please try again later';
      toast({
        title: 'Error creating company',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create Your Company</CardTitle>
          <CardDescription>
            Set up your company to get started with Candor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Creating Company...' : 'Create Company'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}