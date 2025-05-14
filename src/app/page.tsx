// app/page.tsx
'use client';
import { useAuth } from '@/lib/context/auth-context';
import { redirect, useRouter } from "next/navigation";
import Image from 'next/image';
import { radley } from './fonts';
import React, { useState } from 'react';
import { Binoculars, CalendarSync, ChartScatter, CircleCheck, Clock, Clock8, HeartHandshake, Loader2, Sparkles, TriangleAlert, Zap } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from '@/components/marketing/Header';
import Footer from '@/components/marketing/Footer';
import Script from 'next/script';
import { Button } from '@/components/ui/button';
import supabase from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';

// Public email domains to validate against
const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 
  'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com', 
  'gmx.com', 'live.com', 'msn.com', 'me.com', 'comcast.net', 'verizon.net', 
  'att.net', 'inbox.com', 'test.com', 'testing.com', 'example.com', 
  'demo.com', 'sample.com', 'fake.com', 'fakemail.com', 'tempmail.com'
];

export default function Home() {
  const { user } = useAuth();
  const router = useRouter(); 
  const [billingCycle, setBillingCycle] = useState('monthly');
  
  // Form state
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailValidationState, setEmailValidationState] = useState<{
    isValidating: boolean;
    errorMessage: string | null;
  }>({ isValidating: false, errorMessage: null });

  if (user) {
    console.log('Landing Page: User is logged in, redirecting to dashboard');
    redirect('/dashboard');
  }

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

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setEmailValidationState({ isValidating: false, errorMessage: null });
  };

  const handleEmailBlur = async () => {
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

  const handleDemoRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    // Check if email is valid before submitting
    if (isPublicEmailDomain(email)) {
      setEmailValidationState({
        isValidating: false,
        errorMessage: 'Please use your work email address instead of a personal email provider'
      });
      return;
    }
    
    // Additional validation for domain MX records
    const isValidDomain = await validateEmailDomain(email);
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
      const { error: dbError } = await supabase
        .from('demo_leads')
        .insert([{
          name: 'unknown',
          company: 'unknown',
          company_size: 'unknown',
          notes: '', 
          email: email, 
          created_at: new Date(),
          status: 'Demo Requested From Landing'
        }]);
        
      if (dbError) throw dbError;
      
      // Set submission success
      router.push('/thank-you?source=landing');
      setSubmitted(true);
      setEmail('');
    } catch (err) {
      console.error('Error submitting demo request:', err);
      setError('There was an error submitting your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="">
      {/* Meta Pixel Code */}
      <Script id="facebook-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '1020654256702161');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img 
          height="1" 
          width="1" 
          style={{ display: 'none' }}
          src="https://www.facebook.com/tr?id=1020654256702161&ev=PageView&noscript=1"
          alt=""
        />
      </noscript>

      {/* LinkedIn Insight Tag */}
      <Script id="linkedin-insight" strategy="afterInteractive">
        {`
          _linkedin_partner_id = "7235884";
          window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
          window._linkedin_data_partner_ids.push(_linkedin_partner_id);
          
          (function(l) {
            if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
            window.lintrk.q=[]}
            var s = document.getElementsByTagName("script")[0];
            var b = document.createElement("script");
            b.type = "text/javascript";b.async = true;
            b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
            s.parentNode.insertBefore(b, s);
          })(window.lintrk);
        `}
      </Script>
      
      {/* LinkedIn noscript fallback */}
      <div dangerouslySetInnerHTML={{ 
        __html: `
          <noscript>
            <img height="1" width="1" style="display:none;" alt="" src="https://px.ads.linkedin.com/collect/?pid=7235884&fmt=gif" />
          </noscript>
        `
      }} />
      
      <Header />

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center bg-slate-50" id="demo">
        <div className="container mx-auto px-8 py-16 sm:px-8 py-8 sm:py-16">
          <div className="flex flex-col md:flex-row items-center">
            <div className="w-full md:w-1/2 mb-8 md:mb-0 text-center md:text-left">
              <h1 className={`text-3xl sm:text-5xl md:text-6xl font-light text-cerulean ${radley.className}`}>
                Continuous Feedback, <i>Zero Effort</i>.
              </h1>
              <p className={`text-slate-500 text-sm sm:text-base font-light mt-4 mx-auto md:mx-0`}>
              Our AI-powered platform automatically collects meaningful 360&deg; feedback in the background, saving managers 210+ hours a year while eliminating bias from performance reviews.
              </p>
              
                <form
                  onSubmit={handleDemoRequest}
                  className="flex flex-col sm:flex-row gap-2 w-full"
                >
                  <div className="relative flex-grow">
                    {submitted ? (
                      <div className='mt-4 bg-white rounded-md border border-slate-200 mr-4 p-4'>
                        <p className={`text-slate-500 text-sm font-light`}>
                          <strong className='font-bold text-cerulean'>Thank You!</strong> We&apos;ve received your demo request and will be in touch shortly to schedule your personalized demo of Candor &mdash; within 24 hours.
                        </p>
                      </div>
                    ) : (
                      <>
                      <div className="flex flex-col sm:flex-row gap-4 mt-4">
                        <Input
                          type="email"
                          name="email"
                          placeholder="Enter your work email"
                          className={`border ${emailValidationState.errorMessage ? 'border-red-500' : 'border-slate-300'} rounded-md px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-cerulean focus:border-transparent h-12 bg-white`}
                          required
                          value={email}
                          onChange={handleEmailChange}
                          onBlur={handleEmailBlur}  
                        />
                        <Button
                          type="submit"
                          className="bg-cerulean text-white rounded-md px-4 py-2 hover:bg-cerulean-600 transition-colors h-12 mr-4" 
                          disabled={isSubmitting || emailValidationState.isValidating || !!emailValidationState.errorMessage}
                        >
                          {isSubmitting ? 'Submitting...' : 'Request a Demo'}
                        </Button>
                      </div>
                      </>
                    )}
                    {emailValidationState.isValidating && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    )}
                    {emailValidationState.errorMessage && (
                      <p className="text-red-500 text-xs mt-1">{emailValidationState.errorMessage}</p>
                    )}
                    {error && (
                      <p className="text-red-500 text-xs mt-1">{error}</p>
                    )}
                  </div>
                </form>
              
            </div>
            <div className="w-full md:w-1/2 mt-4 md:mt-0">
                <video
                  src="https://candor360bucket.s3.us-east-2.amazonaws.com/candor-hero-video.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ width: '100%', height: 'auto' }}
                >
                  <Image
                    src="/candor-hero-novideo.png"
                    alt="Candor Landing Page"
                    width={640}
                    height={375}
                    className="w-full object-cover rounded-lg"
                    priority={true}
                  />
                </video>
            </div>
          </div>
        </div>
      </main>


      <div className='bg-cerulean py-10 sm:py-16'>
        <div className="container mx-auto px-4 flex flex-col items-center">
          <h2 className={`text-3xl sm:text-4xl font-light text-white max-w-4xl text-center ${radley.className}`}>
            Performance Reviews Are Broken
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 w-full">
            <div className="mt-6 sm:mt-8 rounded-lg shadow-lg bg-gradient-to-bl from-cerulean-600 to-cerulean-700 p-6 sm:p-8">
              <h3 className={`text-xl sm:text-2xl font-light text-white ${radley.className}`}>
                <Clock className='mb-2 text-cerulean-200' />
                Time-Consuming
              </h3>
              <p className="text-cerulean-200 text-sm sm:text-base font-light mt-2">
                Managers spend over 210 hours per year on performance reviews, taking time away from coaching and development.
              </p>
            </div>
            
            <div className="mt-6 sm:mt-8 rounded-lg shadow-lg bg-gradient-to-bl from-cerulean-600 to-cerulean-700 p-6 sm:p-8">
              <h3 className={`text-xl sm:text-2xl font-light text-white ${radley.className}`}>
                <TriangleAlert className='mb-2 text-cerulean-200' />
                Recency Bias
              </h3>
              <p className="text-cerulean-200 text-sm sm:text-base font-light mt-2">
                Traditional reviews focus on recent events, missing months of achievements and creating an incomplete performance picture.
              </p>
            </div>

            <div className="mt-6 sm:mt-8 rounded-lg shadow-lg bg-gradient-to-bl from-cerulean-600 to-cerulean-700 p-6 sm:p-8">
              <h3 className={`text-xl sm:text-2xl font-light text-white ${radley.className}`}>
                <Binoculars className='mb-2 text-cerulean-200' />
                Limited Perspective
              </h3>
              <p className="text-cerulean-200 text-sm sm:text-base font-light mt-2">
                Even the most well-intentioned manager will only gather feedback from a small sample size, missing the full story of employee contributions.
              </p>
            </div>
          </div>

          <p className={`text-white max-w-xl text-sm sm:text-lg font-light mt-8 sm:mt-12 text-center`}>
            58% of companies say their performance management system is <i>&quot;not an effective use of time&quot;</i> and 45% of managers see no value in it.
          </p>
        </div>
      </div>

      {/* Solution Section */}
      <div className="bg-slate-50 py-10 sm:py-16">
        <div className="container mx-auto px-4 sm:px-8">
          <div className="flex flex-col md:flex-row items-center">
            <div className="w-full md:w-1/2 order-2 md:order-1">
              <video
                src="https://candor360bucket.s3.us-east-2.amazonaws.com/candor-solution-video.mp4"
                autoPlay
                muted
                loop
                playsInline
                style={{ width: '100%', height: 'auto' }}
                className="mt-6 md:mt-0"
              >
                <Image 
                  src="/candor-solution.png" 
                  alt="Candor Give Feedback Demo" 
                  width={640} 
                  height={375}
                  className="w-full object-cover rounded-lg" 
                  priority={true}
                />
              </video>
            </div>

            <div className="w-full md:w-1/2 order-1 md:order-2 md:pl-8">
              <h2 className={`text-3xl sm:text-4xl font-light text-cerulean max-w-4xl text-center md:text-left ${radley.className}`}>
                Feedback That Works!
              </h2>
              <p className={`text-slate-500 text-sm sm:text-base font-light max-w-xl mt-4 mb-4 text-center md:text-left`}>
                Candor flips the feedback process on its head. Instead of waiting for managers to initiate reviews, our AI quietly works in the background, automatically collecting contextual feedback based on actual work relationships.
              </p>
              <div className="mt-4">
                <p className='text-slate-500 text-sm sm:text-base font-light mb-2'>
                  <CircleCheck className='inline-block text-cerulean-300 mr-2' />
                  Automatically identifies real working relationships
                </p>
                <p className='text-slate-500 text-sm sm:text-base font-light mb-2'>
                  <CircleCheck className='inline-block text-cerulean-300 mr-2' />
                  Generates contextual surveys based on relationship, role, and industry
                </p>
                <p className='text-slate-500 text-sm sm:text-base font-light mb-2'>
                  <CircleCheck className='inline-block text-cerulean-300 mr-2' />
                  Works continuously in the background with zero maintenance
                </p>
                <p className='text-slate-500 text-sm sm:text-base font-light'>
                  <CircleCheck className='inline-block text-cerulean-300 mr-2' />
                  Uses AI to analyze and summarize feedback themes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className='bg-white py-10 sm:py-16' id="features">
        <div className="container mx-auto px-4 flex flex-col items-center">
          <h2 className={`text-3xl sm:text-4xl font-light text-nonphotoblue-600 max-w-4xl text-center ${radley.className}`}>
            Transform Your Feedback Culture
          </h2>
          <p className={`text-slate-500 text-sm sm:text-lg font-light max-w-2xl mt-4 text-center`}>
            Companies with continuous feedback systems show 39% higher effectiveness in talent attraction and 44% better retention rates.
          </p>

          <div className="w-full mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              
              <div className="mt-4 rounded-lg shadow-lg bg-gradient-to-bl from-slate-50 to-white p-6">
                <h3 className={`text-xl sm:text-2xl font-light text-nonphotoblue-600 ${radley.className}`}>
                  <CalendarSync className='mb-2 text-nonphotoblue-600' />
                  Continuous Feedback
                </h3>
                <p className="text-slate-500 text-sm sm:text-base font-light mt-2">
                  Collect feedback throughout the year instead of periodic review cycles, giving employees the timely insights they need.
                </p>
              </div>

              <div className="mt-4 rounded-lg shadow-lg bg-gradient-to-bl from-slate-50 to-white p-6">
                <h3 className={`text-xl sm:text-2xl font-light text-nonphotoblue-600 ${radley.className}`}>
                  <Zap className='mb-2 text-nonphotoblue-600' />
                  Automated Collection
                </h3>
                <p className="text-slate-500 text-sm sm:text-base font-light mt-2">
                  Zero manual effort required from managers or HR. Candor handles everything from identifying relationships to gathering responses.
                </p>
              </div>

              <div className="mt-4 rounded-lg shadow-lg bg-gradient-to-bl from-slate-50 to-white p-6">
                <h3 className={`text-xl sm:text-2xl font-light text-nonphotoblue-600 ${radley.className}`}>
                  <ChartScatter className='mb-2 text-nonphotoblue-600' />
                  Comprehensive Insights
                </h3>
                <p className="text-slate-500 text-sm sm:text-base font-light mt-2">
                  Get a full view of employee performance based on actual work relationships, not just manager observations.
                </p>
              </div>

              <div className="mt-4 rounded-lg shadow-lg bg-gradient-to-bl from-slate-50 to-white p-6">
                <h3 className={`text-xl sm:text-2xl font-light text-nonphotoblue-600 ${radley.className}`}>
                  <HeartHandshake className='mb-2 text-nonphotoblue-600' />
                  Reduced Bias
                </h3>
                <p className="text-slate-500 text-sm sm:text-base font-light mt-2">
                  Eliminate recency bias by capturing performance data continuously. AI analysis helps identify and reduce subjective biases.
                </p>
              </div>

              <div className="mt-4 rounded-lg shadow-lg bg-gradient-to-bl from-slate-50 to-white p-6">
                <h3 className={`text-xl sm:text-2xl font-light text-nonphotoblue-600 ${radley.className}`}>
                  <Sparkles className='mb-2 text-nonphotoblue-600' />
                  AI Powered
                </h3>
                <p className="text-slate-500 text-sm sm:text-base font-light mt-2">
                  Advanced AI analyzes relationship patterns, generates contextual surveys, and identifies themes from feedback to provide unbiased, actionable insights.
                </p>
              </div>

              <div className="mt-4 rounded-lg shadow-lg bg-gradient-to-bl from-slate-50 to-white p-6">
                <h3 className={`text-xl sm:text-2xl font-light text-nonphotoblue-600 ${radley.className}`}>
                  <Clock8 className='mb-2 text-nonphotoblue-600' />
                  Massive Time Savings
                </h3>
                <p className="text-slate-500 text-sm sm:text-base font-light mt-2">
                  Save 210+ hours per manager annually, freeing them to focus on coaching and development rather than administrative tasks. <i className='text-xs'>Oh, Candor helps with coaching too!</i>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quote Section */}
      <div className='bg-slate-50 py-16'>
        <div className="container mx-auto px-8 flex flex-col items-center text-center">
          <h2 className={`text-xl font-light text-cerulean italic max-w-4xl ${radley.className}`}>
            High-performing teams have mastered the art of giving and receiving feedback. They know feedback is the thing that helps them grow. So they don&apos;t shy away from it. They give positive and constructive feedback ALL. THE. TIME.
          </h2>
          <p className='mt-8 text-slate-500 text-base font-light'>
            Shelley Johnson<br />
            <span className="text-slate-500 text-sm font-light">HR Coach &amp; Author</span>
          </p>
        </div>
      </div>

      <div className='bg-white py-16' id="pricing">
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-cerulean max-w-4xl ${radley.className}`}>
            Simple, Volume-Based Pricing
          </h2>
          <p className={`text-slate-500 text-lg font-light max-w-2xl mt-4`}>
          All features included for every customer - you only pay for what you use.
          </p>

          <div className='bg-white py-16'>
            <div className="mx-auto px-4 flex flex-col items-center">
              <div className="w-full">
                <Tabs defaultValue="monthly" className="w-full" onValueChange={(value) => setBillingCycle(value)}>
                  <div className="flex justify-center mb-8">
                  <TabsList className="bg-slate-100 p-1 rounded-lg overflow-hidden">
                        <TabsTrigger 
                        value="monthly" 
                        className="px-8 py-2 transition-all relative"
                        style={billingCycle === 'monthly' ? {
                            backgroundColor: 'white',
                            color: '#0068b7', // cerulean color
                            
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        } : {
                            backgroundColor: 'transparent',
                            color: '#64748b' // slate-500
                        }}
                        >
                        Monthly
                        </TabsTrigger>
                        <TabsTrigger 
                        value="quarterly" 
                        className="px-8 py-2 transition-all relative"
                        style={billingCycle === 'quarterly' ? {
                            backgroundColor: 'white',
                            color: '#0068b7', // cerulean color
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        } : {
                            backgroundColor: 'transparent',
                            color: '#64748b' // slate-500
                        }}
                        >
                        Quarterly <span className="italic text-slate-500 ml-1">(Save 15%)</span>
                        </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="monthly" className="mt-0">
                    <div className="bg-white w-full rounded-lg shadow-md p-8 border border-slate-200">
                      {/* <div className="text-center mb-8">
                        <h3 className={`text-2xl font-light text-cerulean ${radley.className}`}>Simple, Transparent Pricing</h3>
                        <p className="mt-2 text-slate-500">All features included for every customer - you only pay for what you use</p>
                      </div> */}
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-slate-50 p-6 rounded-lg">
                          <div className="flex items-baseline justify-center">
                            <span className="text-3xl font-light text-slate-900">Free</span>
                          </div>
                          <div className="text-center mt-2 text-slate-500">1-5 users</div>
                        </div>
                        
                        <div className="bg-slate-50 p-6 rounded-lg border-2 border-slate-400 relative">
                          <div className="absolute -top-3 right-4 bg-slate-400 text-white text-xs px-3 py-1 rounded-full">
                            MOST COMMON
                          </div>
                          <div className="flex items-baseline justify-center">
                            <span className="text-3xl font-light text-slate-900">$10</span>
                            <span className="ml-1 text-slate-500 text-sm">/user/month</span>
                          </div>
                          <div className="text-center mt-2 text-slate-500">6-50 users</div>
                        </div>
                        
                        <div className="bg-slate-50 p-6 rounded-lg">
                          <div className="flex items-baseline justify-center">
                            <span className="text-3xl font-light text-slate-900">$9</span>
                            <span className="ml-1 text-slate-500 text-sm">/user/month</span>
                          </div>
                          <div className="text-center mt-2 text-slate-500">51+ users</div>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 p-6 rounded-lg mb-8">
                        <h4 className={`text-xl font-light text-cerulean mb-4 ${radley.className}`}>All Features Included</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">AI-powered feedback collection</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">AI summarizations</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">Company values &amp; employee recognition</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">AI-enabled insights &amp; action</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">Manager view of feedback</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">Email notifications</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">Unlimited feedback cycles</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">10 Day Free Trial</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-center mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                        {/* <Link href="/auth/register" className="inline-block bg-cerulean text-white text-center py-3 px-8 rounded-md hover:bg-cerulean-600 transition-colors">
                          Start Free Trial
                        </Link> */}
                        <Link href="/book-a-demo" className="inline-block bg-cerulean text-white text-center py-3 px-8 rounded-md hover:bg-cerulean-600 transition-colors">
                          Request a Demo
                        </Link>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="quarterly" className="mt-0">
                    <div className="bg-white w-full rounded-lg shadow-md p-8 border border-slate-200">
                      {/* <div className="text-center mb-8">
                        <h3 className={`text-2xl font-light text-cerulean ${radley.className}`}>Simple, Volume-Based Pricing</h3>
                        <p className="mt-2 text-slate-500">All features included for every customer - with quarterly discount</p>
                      </div> */}
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-slate-50 p-6 rounded-lg">
                          <div className="flex items-baseline justify-center">
                            <span className="text-3xl font-light text-slate-900">Free</span>
                          </div>
                          <div className="text-center mt-2 text-cerulean text-sm font-medium">No time limit</div>
                          <div className="text-center mt-2 text-slate-500">1-5 users</div>
                        </div>
                        
                        <div className="bg-slate-50 p-6 rounded-lg border-2 border-slate-400 relative">
                          <div className="absolute -top-3 right-4 bg-slate-400 text-white text-xs px-3 py-1 rounded-full">
                            MOST COMMON
                          </div>
                          <div className="flex items-baseline justify-center">
                            <span className="text-3xl font-light text-slate-900">$8.50</span>
                            <span className="ml-1 text-slate-500 text-sm">/user/month</span>
                          </div>
                          <div className="text-center mt-2 text-cerulean text-sm font-medium">$25.50 per user, billed quarterly</div>
                          <div className="text-center mt-1 text-slate-500">6-50 users</div>
                        </div>
                        
                        <div className="bg-slate-50 p-6 rounded-lg">
                          <div className="flex items-baseline justify-center">
                            <span className="text-3xl font-light text-slate-900">$7.65</span>
                            <span className="ml-1 text-slate-500 text-sm">/user/month</span>
                          </div>
                          <div className="text-center mt-2 text-cerulean text-sm font-medium">$22.95 per user, billed quarterly</div>
                          <div className="text-center mt-1 text-slate-500">51+ users</div>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 p-6 rounded-lg mb-8">
                        <h4 className={`text-xl font-light text-cerulean mb-4 ${radley.className}`}>All Features Included</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">AI-powered feedback collection</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">AI summarizations</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">Company values &amp; employee recognition</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">AI-enabled insights &amp; action</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">Manager view of feedback</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">Email notifications</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">Unlimited feedback cycles</p>
                          </div>
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-slate-500 text-sm">10 Day Free Trial</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-center mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                        {/* <Link href="/auth/register" className="inline-block bg-cerulean text-white text-center py-3 px-8 rounded-md hover:bg-cerulean-600 transition-colors">
                          Start Free Trial
                        </Link> */}
                        <Link href="/book-a-demo" className="inline-block bg-cerulean text-white text-center py-3 px-8 rounded-md hover:bg-cerulean-600 transition-colors">
                          Request a Demo
                        </Link>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* <div className='bg-berkeleyblue py-16'>
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-white max-w-xl ${radley.className}`}>
            Ready to Transform Your Performance Reviews?
          </h2>
          <p className={`text-white text-base font-light max-w-md mt-4`}>
          Join organizations that are saving 210+ hours per manager annually while collecting better, unbiased feedback.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link className='border border-berkeleyblue-200 text-berkeleyblue bg-background shadow-xs hover:bg-cerulean-100 h-10 rounded-md px-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal' href='/auth/register'>
              Start Free Trial
            </Link>
            <Link className='border border-white text-white hover:bg-berkeleyblue-700 h-10 rounded-md px-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal' href='/book-a-demo'>
              Request Demo
            </Link>
          </div>
        </div>
      </div> */}


      <Footer />
    </div>
  );
}