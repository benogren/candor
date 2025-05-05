// app/page.tsx
'use client';
import Image from 'next/image';
import { radley } from '../fonts';
import React, { useState, useEffect } from 'react';
import { Bot, Calendar, Smartphone, Target } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Script from 'next/script';
import { LinkedInLogoIcon, TwitterLogoIcon } from '@radix-ui/react-icons';

// Declare Prefinery on the window object for TypeScript
declare global {
  interface Window {
    prefinery: {
      q?: unknown[];
      (...args: unknown[]): void;
    };
    fbq?: (event: string, eventName: string, params?: Record<string, unknown>) => void;
    _fbq?: {
      push: (arg: unknown) => void;
      loaded: boolean;
      version: string;
      queue: unknown[];
      [key: string]: unknown;
    };
    addEventListener(event: string, callback: () => void): void;
    removeEventListener(event: string, callback: () => void): void;
  }
}

export default function CoachPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Track Prefinery signup events and Meta Pixel Contact events
  useEffect(() => {
    const handleSignupSuccess = () => {
      setIsSubmitted(true);
      
      // Track the "Contact" event when the form is successfully submitted
      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'Contact');
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('prefinery:signupSuccess', handleSignupSuccess);
      
      return () => {
        window.removeEventListener('prefinery:signupSuccess', handleSignupSuccess);
      };
    }
  }, []);

  return (
    <>
    <div className="flex flex-col min-h-screen">
      {/* Prefinery Script */}
      <Script 
        id="prefinery-script"
        strategy="afterInteractive" 
        dangerouslySetInnerHTML={{
          __html: `
            prefinery=window.prefinery||function(){(window.prefinery.q=window.prefinery.q||[]).push(arguments)};
          `
        }}
      />
      <Script 
        id="prefinery-widget"
        src="https://widget.prefinery.com/widget/v2/7pgzxwbv.js" 
        strategy="afterInteractive"
      />
      
      {/* Meta Pixel Base Code */}
      <Script 
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '9746830468718722'); // Replace YOUR_PIXEL_ID with your actual Meta Pixel ID
            fbq('track', 'PageView'); // Track page view event
          `
        }}
      />

      {/* Meta Pixel noscript fallback */}
      <noscript>
        <img 
          height="1" 
          width="1" 
          style={{ display: 'none' }} 
          src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID&ev=PageView&noscript=1"
          alt="" 
        />
      </noscript>

      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="text-xl font-bold text-slate-900">
            <Link href="/coach">
              <Image src="/logo/candor-coach-logo.png" alt="Candor Coach" width={162} height={30} priority={true} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex bg-slate-50">
        <div className="container mx-auto">
          <div className="flex flex-row relative min-h-[400px]">
            <div className="md:w-1/2 py-24 z-10">
              <h1 className={`text-6xl font-light text-cerulean ${radley.className}`}>
                Your Personal Career Coach, <i>Just a Text Away</i>.
              </h1>
              <p className={`text-slate-500 text-base font-light mt-4`}>
                24/7 AI-powered career coaching via text message. No apps to download, just text us anytime for personalized guidance.
              </p>
                      
              <div className='mt-8'>
                {!isSubmitted ? (
                  <div id="pfy_embed_signup">
                    <form 
                      action="https://i.prefinery.com/projects/7pgzxwbv/users/post" 
                      id="pfy_signup_form" 
                      className="pfy-signup-form" 
                      method="post" 
                      acceptCharset="UTF-8"
                      noValidate
                      onSubmit={() => {
                        // Track form submission attempt with Meta Pixel
                        if (typeof window !== 'undefined' && window.fbq) {
                          window.fbq('track', 'Contact');
                        }
                      }}
                    >
                      {/* Hidden tracking fields */}
                      <input id="referrer" name="referrer" type="hidden" value="" />
                      <input id="referral_token" name="referral_token" type="hidden" value="" />
                      <input id="utm_source" name="utm_source" type="hidden" value="" />
                      <input id="utm_medium" name="utm_medium" type="hidden" value="" />
                      <input id="utm_campaign" name="utm_campaign" type="hidden" value="" />
                      <input id="utm_term" name="utm_term" type="hidden" value="" />
                      <input id="utm_content" name="utm_content" type="hidden" value="" />

                      {/* Email field styled to match your UI */}
                      <div className="flex items-center">
                        <Input
                          type="email"
                          name="user[profile][email]"
                          id="pfy_user_profile_email"
                          placeholder="Enter your email"
                          className="h-10 block w-full px-4 py-4 mr-4 rounded-md border-gray-300 shadow-sm sm:text-sm"
                          required
                        />
                        <Button
                          type="submit"
                          size="lg"
                        >
                          Join Waitlist
                        </Button>
                      </div>

                      {/* Honeypot field */}
                      <div style={{ position: "absolute", left: "-5000px" }} aria-hidden="true">
                        <input 
                          type="text" 
                          name="f134d5352f66e6afbd4eb63bf575dab792b0efb4" 
                          tabIndex={-1} 
                          defaultValue="" // Using defaultValue instead of value to avoid the read-only warning
                          autoComplete="off" 
                        />
                      </div>

                      <p className="mt-3 text-sm text-gray-500">
                        Be the first to know when we launch. We&apos;ll let you know as soon as spots are available.
                      </p>
                    </form>
                  </div>
                ) : (
                  <div className="mt-8">
                    <h3 className={`text-2xl font-light text-cerulean ${radley.className}`}>You&apos;re on the list! 🎉</h3>
                    <p className={`text-slate-500 text-base font-light`}>Thanks for joining our waitlist. We&apos;ll text you soon with early access.</p>
                    <div className="mt-4">
                      <p className={`text-slate-500 text-sm font-light`}>Share with friends to move up the waitlist:</p>
                      <div className="flex gap-2 mt-2">
                        {/* Dynamic share buttons from Prefinery will appear here */}
                        <div id="prefinery-share-buttons"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="md:w-1/2 md:absolute md:right-0 md:bottom-0 md:h-full overflow-hidden">
              <div className="relative h-full w-full">
                <Image
                  src="/candor-coach-hero.png"
                  alt="Candor Coach"
                  width={640}
                  height={375}
                  className="w-full h-auto md:absolute md:bottom-0 md:right-0 object-contain"
                  priority={true}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{
                    maxHeight: '100%',
                    objectPosition: 'bottom right'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className='bg-cerulean py-16'>
        <div className="container mx-auto px-4 flex flex-col items-center">
          <h2 className={`text-4xl font-light text-white max-w-4xl text-center ${radley.className}`}>
            How it Works
          </h2>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="mt-8 rounded-lg shadow-lg bg-gradient-to-bl from-cerulean-600 to-cerulean-700 p-8">
              <h3 className={`text-2xl font-light text-white ${radley.className}`}>
                <Smartphone className='mb-2 text-cerulean-200' />
                Text-Based Simplicity
              </h3>
              <p className="text-cerulean-200 text-base font-light mt-2">
                No apps to download. Just text our number anytime, 24/7, and get an immediate response.
              </p>
            </div>
            
            <div className="mt-8 rounded-lg shadow-lg bg-gradient-to-bl from-cerulean-600 to-cerulean-700 p-8">
              <h3 className={`text-2xl font-light text-white ${radley.className}`}>
                <Bot className='mb-2 text-cerulean-200' />
                Personalized AI Coach
              </h3>
              <p className="text-cerulean-200 text-base font-light mt-2">
                Customize your coach&apos;s name and personality to create the perfect mentor for your needs.
              </p>
            </div>

            <div className="mt-8 rounded-lg shadow-lg bg-gradient-to-bl from-cerulean-600 to-cerulean-700 p-8">
              <h3 className={`text-2xl font-light text-white ${radley.className}`}>
                <Target className='mb-2 text-cerulean-200' />
                Guided Exercises
              </h3>
              <p className="text-cerulean-200 text-base font-light mt-2">
                Access specialized tools like goal-setting frameworks, ikigai exercises, and personality assessments.
              </p>
            </div>

            <div className="mt-8 rounded-lg shadow-lg bg-gradient-to-bl from-cerulean-600 to-cerulean-700 p-8">
              <h3 className={`text-2xl font-light text-white ${radley.className}`}>
                <Calendar className='mb-2 text-cerulean-200' />
                Weekly Check-ins
              </h3>
              <p className="text-cerulean-200 text-base font-light mt-2">
                Your coach proactively reaches out for weekly retrospectives and helps you set goals for the week ahead.
              </p>
            </div>
          </div>
          
          <p className={`text-white max-w-2xl text-lg font-light mt-12 text-center`}>
            Studies show that 81% of employees who receive career coaching report increased job satisfaction, and 63% of individuals who have used a career coach believe it has helped them advance their career.
          </p>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className='bg-slate-50 py-16' id="testimonials">
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-cerulean max-w-4xl ${radley.className}`}>
            What Our Users Are Saying
          </h2>
          <p className={`text-slate-500 text-base font-light max-w-xl mt-4 mb-12`}>
            Hear from professionals who have transformed their careers with Candor Coach.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-white rounded-lg shadow-md p-6 md:p-8 text-left relative">
              <p className="text-slate-600 italic mb-6">
                Since I started using Candor Coach, I&apos;ve become much more strategic about my career moves. The weekly check-ins and goal-setting frameworks helped me prepare for a promotion conversation that led to a 15% salary increase!
              </p>
              <div className="flex items-center">
                <div className="bg-cerulean-100 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-cerulean font-semibold text-sm md:text-base">
                  <Image src="/beau.jpeg" alt="Candor Coach : Beau" width={40} height={40} className="rounded-full" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="font-medium text-slate-800 text-sm md:text-base">Beau L.</p>
                  <p className="text-xs md:text-sm text-slate-500">Engineering</p>
                </div>
              </div>
            </div>
            
            {/* Testimonial 2 */}
            <div className="bg-white rounded-lg shadow-md p-6 md:p-8 text-left relative">
              <p className="text-slate-600 italic mb-6">
                The best part about Candor Coach is being able to text anytime I need guidance. During a stressful job transition, having an AI coach available 24/7 helped me navigate tough decisions and prepare for interviews with confidence.
              </p>
              <div className="flex items-center">
                <div className="bg-cerulean-100 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-cerulean font-semibold text-sm md:text-base">
                  <Image src="/courtney.jpeg" alt="Candor Coach : Courtney" width={40} height={40} className="rounded-full" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="font-medium text-slate-800 text-sm md:text-base">Courtney O.</p>
                  <p className="text-xs md:text-sm text-slate-500">Operations</p>
                </div>
              </div>
            </div>
            
            {/* Testimonial 3 */}
            <div className="bg-white rounded-lg shadow-md p-6 md:p-8 text-left relative">
              <p className="text-slate-600 italic mb-6">
                I was skeptical about AI coaching at first, but Candor Coach has been transformative. The personality assessments and ikigai exercises helped me recognize strengths I wasn&apos;t leveraging. I&apos;m now pursuing projects that align with my values and strengths.
              </p>
              <div className="flex items-center">
                <div className="bg-cerulean-100 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-cerulean font-semibold text-sm md:text-base">
                  <Image src="/kate.jpeg" alt="Candor Coach : Kate" width={40} height={40} className="rounded-full" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="font-medium text-slate-800 text-sm md:text-base">Kate H.</p>
                  <p className="text-xs md:text-sm text-slate-500">Product Management</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-10 md:mt-12">
            <p className="text-slate-500 font-light text-sm md:text-base">
              Join thousands of professionals advancing their careers with personalized coaching.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className='bg-white py-16' id="pricing">
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-cerulean max-w-4xl ${radley.className}`}>
            Pricing
          </h2>

          <div className='bg-white mt-4'>
            <div className="mx-auto px-4 flex flex-col items-center">
              <div className="w-full">
                <div className='bg-white rounded-lg shadow-md p-8 border border-slate-200'>
                  <div className="auto flex items-center justify-center mb-8 mt-2">
                    <div className="bg-slate-50 p-12 rounded-lg border border-slate-200">
                      <div className="flex items-baseline justify-center">
                        <span className={`text-4xl font-light text-slate-900`}>$5</span>
                      </div>
                      <div className="text-center mt-2 text-slate-500">per week</div>
                    </div>
                  </div>

                  <div className="px-6 pb-6 rounded-lg">
                    <h4 className={`text-xl font-light text-cerulean mb-4 ${radley.className}`}>All Features Included</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-start">
                        <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="ml-3 text-slate-500 text-sm">24/7 text-based career coaching</p>
                      </div>
                      <div className="flex items-start">
                        <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="ml-3 text-slate-500 text-sm">Personalized coach personality</p>
                      </div>
                      <div className="flex items-start">
                        <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="ml-3 text-slate-500 text-sm">Goal-setting frameworks</p>
                      </div>
                      <div className="flex items-start">
                        <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="ml-3 text-slate-500 text-sm">Weekly check-ins and planning</p>
                      </div>
                      <div className="flex items-start">
                        <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="ml-3 text-slate-500 text-sm">Specialized career exercises</p>
                      </div>
                      <div className="flex items-start">
                        <svg className="h-5 w-5 text-cerulean flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="ml-3 text-slate-500 text-sm">Unlimited conversations</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-white text-slate-500 py-10">
        <div className="container mx-auto px-6 border-t border-slate-300 mt-10 pt-6">
          <p className={`text-cerulean mb-4 md:mb-0 text-lg ${radley.className}`}>candor<i>coach</i> is a product of <Link href="/" className="text-slate-400 hover:text-slate-500 transition duration-200">candor</Link></p>
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex space-x-4">
              <p className="text-gray-400 mb-4 md:mb-0">&copy; {new Date().getFullYear()} Candor 360, Inc. All rights reserved.</p>
              <Link href="/terms" className="text-slate-400 hover:text-slate-500 transition duration-200">Terms of Use</Link>
              <Link href="/privacy" className="text-slate-400 hover:text-slate-500 transition duration-200">Privacy Policy</Link>
            </div>
            <div className="flex space-x-4">
              <a href="https://x.com/candorso" target='_blank' className="text-slate-400 hover:text-slate-500 transition duration-200">
                <TwitterLogoIcon className="w-6 h-6" />
              </a>
              <Link href="https://linkedin.com/company/candorso" target='_blank' className="text-slate-400 hover:text-slate-500 transition duration-200">
                <LinkedInLogoIcon className="w-6 h-6" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}