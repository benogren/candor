'use client';

import { useAuth } from '@/lib/context/auth-context';
import Image from 'next/image';
import { radley } from '../fonts';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import supabase from '@/lib/supabase/client';
import { PlayCircleIcon, Loader2 } from 'lucide-react';
import Header from '@/components/marketing/Header';
import Footer from '@/components/marketing/Footer';
import { redirect, useRouter } from "next/navigation";

// Add public email domains array
const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com',
  'gmai.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'iclous.com',
  'protonmail.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com',
  'live.com',
  'msn.com',
  'me.com',
  'comcast.net',
  'verizon.net',
  'att.net',
  'inbox.com',
  'test.com',
  'testing.com',
  'example.com',
  'demo.com',
  'sample.com',
  'fake.com',
  'fakemail.com',
  'tempmail.com'
];

export default function DemoPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Redirect if user is already logged in
  if (user) {
    console.log('Demo Page: User is logged in, redirecting to dashboard');
    redirect('/dashboard');
  }

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    companySize: '1-50 employees'
  });
  
  // Submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailValidationState, setEmailValidationState] = useState<{
    isValidating: boolean;
    errorMessage: string | null;
  }>({ isValidating: false, errorMessage: null });

  // Handle form input changes
  interface FormData {
    name: string;
    email: string;
    company: string;
    companySize: string;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: FormData) => ({
      ...prev,
      [name]: value
    }));
    
    // Clear any previous error messages for email when it changes
    if (name === 'email') {
      setEmailValidationState({ isValidating: false, errorMessage: null });
    }
  };

  // Email validation functions
  const isPublicEmailDomain = (email: string): boolean => {
    if (!email || !email.includes('@')) return false;
    const domain = email.split('@')[1]?.toLowerCase();
    return PUBLIC_EMAIL_DOMAINS.includes(domain);
  };

  const validateEmailDomain = async (email: string): Promise<boolean> => {
    if (!email || !email.includes('@')) return false;
    
    const domain = email.split('@')[1];
    
    try {
      setEmailValidationState(prev => ({ ...prev, isValidating: true }));
      
      const response = await fetch('/api/validate-email-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to validate domain');
      }
      
      const result = await response.json();
      return result.valid && result.hasMx;
    } catch (error) {
      console.error('Error validating domain MX records:', error);
      return false;
    } finally {
      setEmailValidationState(prev => ({ ...prev, isValidating: false }));
    }
  };

  // Validate email when it loses focus
  const handleEmailBlur = async () => {
    const { email } = formData;
    
    if (!email) return;
    
    // First check if it's a public email domain
    if (isPublicEmailDomain(email)) {
      setEmailValidationState({
        isValidating: false,
        errorMessage: 'Please use your work email address instead of a personal email provider'
      });
      return;
    }
    
    // Then check if the domain has valid MX records
    if (email.includes('@')) {
      const isValidDomain = await validateEmailDomain(email);
      
      if (!isValidDomain) {
        setEmailValidationState({
          isValidating: false,
          errorMessage: 'Please provide a valid work email'
        });
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    // Check if email is valid before submitting
    if (isPublicEmailDomain(formData.email)) {
      setEmailValidationState({
        isValidating: false,
        errorMessage: 'Please use your work email address instead of a personal email provider'
      });
      return;
    }
    
    // Additional validation for domain MX records
    const isValidDomain = await validateEmailDomain(formData.email);
    if (!isValidDomain) {
      setEmailValidationState({
        isValidating: false,
        errorMessage: 'This domain does not have valid email servers'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Insert data into demo_leads table
      const { error } = await supabase
        .from('demo_leads')
        .insert([
          { 
            name: formData.name, 
            email: formData.email, 
            company: formData.company, 
            company_size: formData.companySize,
            created_at: new Date(),
            status: 'Demo Requested'
          }
        ]);
        
      if (error) throw error;
      
      // Set submission success
      router.push('/thank-you?source=demo');
      setSubmitted(true);

    } catch (err) {
      console.error('Error submitting demo request:', err);
      setError('There was an error submitting your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="container mx-auto px-16 py-16 flex flex-col items-center">
          {!submitted ? (
            <>
            <h1 className={`text-6xl font-light text-cerulean max-w-xl text-center ${radley.className}`}>
            Request a Demo
            </h1>
            <p className={`text-slate-500 text-base font-light max-w-xl mt-4 text-center`}>
            Schedule a personalized consultation with a real, live product expert to see if Candor is a fit for your business.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                <div>
                    <Link href="/demo">
                    <Image
                    src="https://cdn.loom.com/sessions/thumbnails/60982c715e26453eb38866457a48ab1a-ec353aa4ccd8f060-full-play.gif"
                    alt="Candor"
                    width={576}
                    height={324}
                    className="rounded-lg shadow-lg mb-4"
                    />
                    </Link>
                    <span className="text-slate-500 text-sm font-light">
                        Not ready to book a demo? <Link href="/demo" className="text-cerulean hover:underline">Watch a recorded demo</Link> of Candor to see how it works.
                    </span>
                </div>
            <div className="">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md">
                <div>
                  <label htmlFor="name" className="block text-slate-700 mb-1 font-medium">Name</label>
                  <input 
                    id="name"
                    name="name"
                    type="text" 
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full p-2 border border-slate-300 rounded" 
                    placeholder="Your name" 
                    required 
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-slate-700 mb-1 font-medium">Work Email</label>
                  <div className="relative">
                    <input 
                      id="email"
                      name="email"
                      type="email" 
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleEmailBlur}
                      className={`w-full p-2 border rounded ${
                        emailValidationState.errorMessage 
                          ? 'border-red-500' 
                          : 'border-slate-300'
                      }`}
                      placeholder="your@work-email.com" 
                      required 
                    />
                    {emailValidationState.isValidating && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>
                  {emailValidationState.errorMessage && (
                    <p className="text-red-500 text-sm mt-1">{emailValidationState.errorMessage}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="company" className="block text-slate-700 mb-1 font-medium">Company</label>
                  <input 
                    id="company"
                    name="company"
                    type="text" 
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full p-2 border border-slate-300 rounded" 
                    placeholder="Your company" 
                    required 
                  />
                </div>
                
                <div>
                  <label htmlFor="companySize" className="block text-slate-700 mb-1 font-medium">Company Size</label>
                  <select 
                    id="companySize"
                    name="companySize"
                    value={formData.companySize}
                    onChange={handleChange}
                    className="w-full p-2 border border-slate-300 rounded"
                    required
                  >
                    <option value="1-50 employees">1-50 employees</option>
                    <option value="51-200 employees">51-200 employees</option>
                    <option value="201-500 employees">201-500 employees</option>
                    <option value="501-1000 employees">501-1000 employees</option>
                    <option value="1000+ employees">1000+ employees</option>
                  </select>
                </div>
                
                <div className="pt-4">
                  <Button 
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || emailValidationState.isValidating || !!emailValidationState.errorMessage}
                  >
                    {isSubmitting ? 'Submitting...' : 'Book My Demo'}
                  </Button>
                  <p className="text-xs text-slate-500 mt-4 text-center">
                    By clicking the &quot;Book My Demo&quot; button, you are agreeing to Candor&apos;s <a href="/terms" className="text-cerulean hover:underline">Terms of Use</a> and <a href="/privacy" className="text-cerulean hover:underline">Privacy Policy</a>.
                  </p>
                </div>
              </form>
            </div>
            </div>
            </>
          ) : (
            <>
            <div className="container mx-auto px-16 py-16 flex flex-col items-center">
            <h1 className={`text-6xl font-light text-cerulean max-w-xl text-center ${radley.className}`}>
                Thank You!
            </h1>
            <p className={`text-slate-500 text-base font-light max-w-xl mt-4 text-center`}>
                We&apos;ve received your demo request and will be in touch shortly to schedule your personalized demo of Candor &mdash; within 24 hours.
                  In the meantime, please watch a recorded demo of Candor to see how it works.
                  </p>
                  <Link className='mt-8 border border-cerulean text-cerulean bg-background shadow-xs hover:bg-cerulean-100 h-10 rounded-md px-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal' href='/demo'>
                    View Recorded Demo
                    <PlayCircleIcon className='w-4 h-4 mr-2' />
                  </Link>
            </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}