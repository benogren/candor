'use client';

import { useAuth } from '@/lib/context/auth-context';
import { redirect } from "next/navigation";
import { radley } from '../fonts';
import React from 'react';
import Link from 'next/link';
import Header from '@/components/marketing/Header';
import Footer from '@/components/marketing/Footer';

export default function WatchDemoPage() {
  const { user } = useAuth();

  // Redirect if user is already logged in
  if (user) {
    console.log('Demo Page: User is logged in, redirecting to dashboard');
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center bg-white">
        <div className="container mx-auto px-16 py-16 flex flex-col items-center">
            <div className='w-[750px] h-[422px] rounded-lg shadow-lg bg-white'>
            <div className="w-full rounded-lg" style={{ position: 'relative', paddingBottom: '62.5%', height: 0 }}>
                <iframe width="750" height="421.875" src="https://www.youtube.com/embed/7PvnP_GMIg4?si=lR56Ix5rclAs1KXQ&rel=0" 
                title="YouTube video player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                referrerPolicy="strict-origin-when-cross-origin" 
                className='rounded-lg'
                allowFullScreen></iframe>
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

          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link className='border border-berkeleyblue-200 text-berkeleyblue bg-background shadow-xs hover:bg-cerulean-100 h-10 rounded-md px-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal' href='/auth/register'>
              Start Free Trial
            </Link>
            <Link className='border border-white text-white hover:bg-berkeleyblue-700 h-10 rounded-md px-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal' href='/book-a-demo'>
              Book a Demo
            </Link>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}