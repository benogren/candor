'use client';

import { useAuth } from '@/lib/context/auth-context';
import { redirect } from "next/navigation";
import Image from 'next/image';
import { radley } from '../fonts';
import React from 'react';
import Link from 'next/link';

export default function WatchDemoPage() {
  const { user } = useAuth();

  // Redirect if user is already logged in
  if (user) {
    console.log('Demo Page: User is logged in, redirecting to dashboard');
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="text-xl font-bold text-slate-900">
            <Link href="/">
              <Image src="/logo/candor_cerulean.png" alt="Candor" width={98} height={24} priority={true} />
            </Link>
          </div>
          <div className="hidden md:flex space-x-6 items-center text-slate-500 text-base font-light">
            <Link href="/#features" className="">Features</Link>
            <Link href="/#use-cases" className="">Use Cases</Link>
            <Link className='bg-cerulean text-primary-foreground hover:bg-cerulean-600 rounded-md text-sm font-normal h-9 px-4 py-2' href='/book-a-demo'>Book a Demo</Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center bg-white">
        <div className="container mx-auto px-16 py-16 flex flex-col items-center">
            <div className='w-[750px] h-[422px] rounded-lg shadow-lg bg-white'>
            <div className="w-full rounded-lg" style={{ position: 'relative', paddingBottom: '62.5%', height: 0 }}>
                <iframe 
                src="https://www.loom.com/embed/60982c715e26453eb38866457a48ab1a?sid=394b32bf-8008-4855-934d-2aea6e0fdca7?hide_owner=true&hide_title=true&hide_share=true&hide_controls=true&hideEmbedTopBar=true&hideEmbedFooter=true"
                allowFullScreen 
                frameBorder="0" 
                style={{ position: 'absolute', top: 0, left: 0, width: '750px', height: '422px' }}
                className='rounded-lg'
                ></iframe>
            </div>
            </div>
            <p className={`text-slate-500 text-base font-light max-w-3xl mt-8 text-center`}>
            Candor transforms workplace feedback from a dreaded annual event into an ongoing conversation that drives growth. Our AI-powered platform seamlessly collects, analyzes, and delivers actionable 360-degree feedback that empowers employees, equips managers, and gives HR leaders the insights they need to build high-performing teams.
            </p>
        </div>
      </main>

      <div className='bg-berkeleyblue py-16'>
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-white max-w-xl ${radley.className}`}>
            The Automated Feedback System You&apos;ve Been Waiting For
          </h2>
          <p className={`text-white text-base font-light max-w-xl mt-4`}>
          Join organizations that are transforming their feedback culture from a burdensome annual event to an ongoing conversation that drives growth and improvement.
          </p>

          <Link className='mt-8 border border-berkeleyblue-200 text-berkeleyblue bg-background shadow-xs hover:bg-cerulean-100 h-10 rounded-md px-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal' href='/book-a-demo'>Book a Demo</Link>
        </div>
      </div>

      <footer className="bg-white py-8">
        <div className="container mx-auto px-4 text-center text-berkeleyblue text-sm">
          <Image src="/logo/candor_berkeleyblue.png" alt="Candor" width={75} height={18} priority={true} className='mx-auto mb-4' />
          <div className="flex justify-center space-x-4 mb-4">
            <Link href="/terms" className="text-slate-500 hover:text-cerulean">Terms of Use</Link>
            <Link href="/privacy" className="text-slate-500 hover:text-cerulean">Privacy Policy</Link>
          </div>
          &copy; {new Date().getFullYear()} Candor. All rights reserved.
        </div>
      </footer>
    </div>
  );
}