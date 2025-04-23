// app/page.tsx
'use client';
import { useAuth } from '@/lib/context/auth-context';
import { redirect } from "next/navigation";
import Image from 'next/image';
import { radley } from './fonts';
import React from 'react';
import { CirclePlay } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/marketing/Header';
import Footer from '@/components/marketing/Footer';


export default function Home() {
  const { user } = useAuth();
  const [showFeedbackScreen, setShowFeedbackScreen] = React.useState(false);
  const [showDashboardScreen, setShowDashboardScreen] = React.useState(false);

  if (user) {
    console.log('Landing Page: User is logged in, redirecting to dashboard');
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="container mx-auto px-4 py-16 flex flex-col items-center text-center">
          <h1 className={`text-6xl font-light text-cerulean max-w-xl ${radley.className}`}>
            360&deg; Feedback That Actually Works.
          </h1>
          <p className={`text-slate-500 text-base font-light max-w-xl mt-4`}>
          Our AI-powered platform seamlessly collects, analyzes, and delivers actionable 360-degree feedback that empowers employees, equips managers, and gives you the insights you need to build high-performing teams.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link className='mt-8 border border-cerulean text-background bg-cerulean shadow-xs hover:bg-cerulean-600 h-10 rounded-md px-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal' href='/auth/register'>
            Start Free Trial
            </Link>
            
            <Link className='mt-8 border border-cerulean text-cerulean bg-background shadow-xs hover:bg-cerulean-100 h-10 rounded-md px-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal' href='/book-a-demo'>
            Book a Demo
            </Link>
          </div>
        </div>
      </main>

      {/* <div className='container mx-auto px-4 py-16 flex flex-col items-center text-center'>
        <div className="grid grid-cols-3 gap-4 text-slate-500 text-base font-light">
          <div className="p-4 text-center">
            <div className={`text-2xl font-light ${radley.className}`}>95%</div>
            <div className="text-sm">reduction in administrative overhead</div>
          </div>
          <div className="p-4 text-center">
            <div className={`text-2xl font-light ${radley.className}`}>15 min</div>
            <div className="text-sm">of setup time for year-round feedback</div>
          </div>
          <div className="p-4 text-center">
            <div className={`text-2xl font-light ${radley.className}`}>78%</div>
            <div className="text-sm">higher participation than traditional systems</div>
          </div>
        </div>
      </div> */}

      {/* Quote Section */}
      <div className='bg-white py-16'>
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

      {/* Features Section */}
      <div className='bg-slate-50 py-16' id="features">
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-berkeleyblue max-w-4xl ${radley.className}`}>
            Features
          </h2>
          <p className={`text-slate-500 text-base font-light max-w-xl mt-4`}>
          Candor transforms workplace feedback from a dreaded annual event into an ongoing conversation that drives growth.
          </p>

          <div>
            <div className="mt-8">
              
              <div className='grid grid-cols-1 md:grid-cols-2 gap-8 items-center'>
                <div className="mt-10 lg:mt-0 relative mx-auto w-full">
                  <div className="rounded-xl shadow-lg transform hover:-translate-y-1 transition-transform duration-300 bg-gradient-to-tl from-berkeleyblue to-cerulean">
                    <div className="relative rounded-lg overflow-hidden w-full">
                    {showDashboardScreen && (
                        <Image 
                        onClick={() => setShowDashboardScreen(false)}
                        src="/candor-give-feedback-demo.gif"
                        alt="Candor Give Feedback Demo" 
                        width={640} 
                        height={375}
                        className="w-full object-cover rounded-lg hover:cursor-pointer" 
                        priority={true}
                      />
                      )}
                      {!showDashboardScreen && (
                        <>
                        <CirclePlay className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-berkeleyblue w-16 h-16'  />
                        <Image 
                        onClick={() => setShowDashboardScreen(true)}
                        src="/candor-give-feedback-demo.png" 
                        alt="Candor Give Feedback Demo" 
                        width={640} 
                        height={375}
                        className="w-full object-cover rounded-lg hover:cursor-pointer" 
                        priority={true}
                      />
                      </>
                      )}
                    </div>
                  </div>
                </div>
                <div className='text-left'>
                <h3 className={`text-xl font-light text-berkeleyblue max-w-xl ${radley.className}`}>
                  Zero-Touch Administration
                </h3>
                
                <p className="text-slate-500 text-base font-light mt-2">
                  <i>One-Time Setup</i> &mdash; No costly implementations, get set up in minutes<br />
                  <i>Smart Scheduling</i> &mdash; Our system automatically determines the optimal cadence for feedback<br />
                  <i>Automated Follow-ups</i> &mdash; Our system automatically manages feedback reminders
                </p>

                <h3 className={`text-xl font-light text-berkeleyblue max-w-xl mt-8 ${radley.className}`}>
                  Frictionless Feedback Collection
                </h3>

                <p className="text-slate-500 text-base font-light mt-2">
                  <i>AI-Generated Questions</i> &mdash; Tailored automatically based on role, relationships, and industry<br />
                  <i>No Survey Creation</i> &mdash; Forget building questionnaires &ndash; our AI handles it all<br />
                  <i>No Feedback Requests</i> &mdash; No more awkward feedback requests &ndash; our system automatically collects feedback from the right people at the right time
                </p>
                </div>
              </div>


              <div className='grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 items-center'>
              <div className='text-left'>
                <h3 className={`text-xl font-light text-berkeleyblue max-w-xl ${radley.className}`}>
                  Powerful Insights
                </h3>
                <p className="text-slate-500 text-base font-light mt-2">
                  <i>Comprehensive Analysis</i> &mdash; AI synthesizes patterns from multiple feedback sources<br />
                  <i>Bias Detection</i> &mdash; AI identifies and neutralize potential unconscious bias<br />
                  <i>Actionable Recommendations</i> &mdash; Concrete development suggestions delivered automatically
                </p>

                <h3 className={`text-xl font-light text-berkeleyblue max-w-xl mt-8 ${radley.className}`}>
                  Effortless Performance Evolution
                </h3>
                <p className="text-slate-500 text-base font-light mt-2">
                  <i>Continuous Documentation</i> &mdash; Ongoing collection creates rich performance history<br />
                  <i>Review Acceleration</i> &mdash; Transform months of review preparation into minutes<br />
                  <i>Development Tracking</i> &mdash; Monitor growth trends without manual tracking
                </p>
                </div>
                <div className="mt-10 lg:mt-0 relative mx-auto w-full">
                  <div className="rounded-xl shadow-lg transform hover:-translate-y-1 transition-transform duration-300 bg-gradient-to-tl from-berkeleyblue to-cerulean">
                    <div className="relative rounded-lg overflow-hidden">
                      {showFeedbackScreen && (
                        <Image 
                        onClick={() => setShowFeedbackScreen(false)}
                        src="/candor-feedback-demo.gif" 
                        alt="Candor Feedback Demo" 
                        width={640} 
                        height={375}
                        className="w-full object-cover rounded-lg hover:cursor-pointer" 
                        priority={true}
                      />
                      )}
                      {!showFeedbackScreen && (
                        <>
                        <CirclePlay className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-berkeleyblue w-16 h-16'  />
                        <Image 
                        onClick={() => setShowFeedbackScreen(true)}
                        src="/candor-feedback-screen.png" 
                        alt="Candor Feedback Screen" 
                        width={640} 
                        height={375}
                        className="w-full object-cover rounded-lg hover:cursor-pointer" 
                        priority={true}
                      />
                      </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div className='bg-cerulean py-16'>
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-white max-w-4xl ${radley.className}`}>
            The Feedback Advantage
          </h2>
          <p className={`text-white text-base font-light max-w-xl mt-4`}>
          Regular feedback is the cornerstone of continuous improvement. By automating the collection and analysis of 360&deg; feedback, Candor helps your organization develop the healthy feedback culture that distinguishes successful teams—without the administrative burden.
          </p>

          <div className='mt-8'>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mt-8">

              <div className="p-4 text-center shadow-md rounded-md bg-cerulean-600">
                <h3 className={`text-4xl font-light text-white ${radley.className}`}>
                23%
                </h3>
                <p className="text-white text-base font-light mt-2">
                Teams with robust feedback systems are more likely to <i>exceed performance targets</i>
                </p>
              </div>

              <div className="p-4 text-center shadow-md rounded-md bg-cerulean-600">
                <h3 className={`text-4xl font-light text-white ${radley.className}`}>
                31%
                </h3>
                <p className="text-white text-base font-light mt-2">
                Organizations with consistent feedback practices <i>experience higher employee engagement</i>
                </p>
              </div>

              <div className="p-4 text-center shadow-md rounded-md bg-cerulean-600">
                <h3 className={`text-4xl font-light text-white ${radley.className}`}>
                2.7x
                </h3>
                <p className="text-white text-base font-light mt-2">
                Teams receiving regular feedback <i>resolve problems faster</i> than those without
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Use Cases */}
      <div className='bg-white py-16' id="use-cases">
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-nonphotoblue-600 max-w-4xl ${radley.className}`}>
            Use Cases
          </h2>
          <p className={`text-slate-500 text-base font-light max-w-xl mt-4`}>
          Transform your organization&apos;s feedback culture from annual reviews to continuous growth conversations with Candor&apos;s AI-powered 360 feedback platform.
          </p>

          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mt-8">

              <div className="p-4 text-center shadow-md rounded-md bg-white">
                <h3 className={`text-xl font-light text-nonphotoblue-600 max-w-xl ${radley.className}`}>
                  Performance Reviews
                </h3>
                <p className="text-slate-500 text-sm font-light mt-2">
                Transform performance reviews from dreaded annual events into data-rich conversations by automatically collecting continuous feedback throughout the review period, eliminating recency bias and providing comprehensive insights with zero administrative effort.
                </p>
              </div>

              <div className="p-4 text-center shadow-md rounded-md bg-white">
                <h3 className={`text-xl font-light text-nonphotoblue-600 max-w-xl ${radley.className}`}>
                  Talent Reviews
                </h3>
                <p className="text-slate-500 text-sm font-light mt-2">
                Make calibration sessions more objective and insightful with Candor&apos;s AI-analyzed feedback patterns that highlight emerging talent, reveal hidden potential, and provide consistent data across departments for more equitable decisions.
                </p>
              </div>

              <div className="p-4 text-center shadow-md rounded-md bg-white">
                <h3 className={`text-xl font-light text-nonphotoblue-600 max-w-xl ${radley.className}`}>
                  1:1 Meetings
                </h3>
                <p className="text-slate-500 text-sm font-light mt-2">
                Enter one-on-one meetings prepared with real-time feedback insights automatically collected from across the organization, turning routine check-ins into targeted development conversations backed by comprehensive context.
                </p>
              </div>

              <div className="p-4 text-center shadow-md rounded-md bg-white">
                <h3 className={`text-xl font-light text-nonphotoblue-600 max-w-xl ${radley.className}`}>
                  Onboarding
                </h3>
                <p className="text-slate-500 text-sm font-light mt-2">
                Accelerate new hire integration by automatically collecting and analyzing feedback during critical first months, enabling timely course corrections and providing new employees with clear guidance on how to succeed in your organization.
                </p>
              </div>

              <div className="p-4 text-center shadow-md rounded-md bg-white">
                <h3 className={`text-xl font-light text-nonphotoblue-600 max-w-xl ${radley.className}`}>
                Self Evaluations
                </h3>
                <p className="text-slate-500 text-sm font-light mt-2">
                Empower employees with a comprehensive view of their impact through Candor&apos;s continuous feedback collection, giving them concrete examples and patterns to reference in self-evaluations rather than relying on memory alone.
                </p>
              </div>

              <div className="p-4 text-center shadow-md rounded-md bg-white">
                <h3 className={`text-xl font-light text-nonphotoblue-600 max-w-xl ${radley.className}`}>
                Employee Recognition
                </h3>
                <p className="text-slate-500 text-sm font-light mt-2">
                Ensure meaningful contributions don&apos;t go unnoticed by automatically capturing positive feedback throughout the year, creating a rich repository of accomplishments that can be leveraged for recognition programs and celebrations.
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>


      {/* Value Section */}
      <div className='bg-slate-50 py-16'>
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-berkeleyblue max-w-4xl ${radley.className}`}>
            Value Across Your Entire Organization
          </h2>
          {/* <p className={`text-slate-500 text-base font-light max-w-xl mt-4`}>
          Candor delivers value across your entire organization.
          </p> */}

          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mt-8">

              <div className="p-4 text-left">
                <h3 className={`text-xl font-light text-berkeleyblue max-w-xl ${radley.className}`}>
                  For Business Owners &amp; HR
                </h3>
                <p className="text-slate-500 text-sm font-light mt-2">
                <i className='text-base'>Transform your organization&apos;s feedback culture from annual reviews to continuous growth conversations.</i><br/><br/>
                Reduce administration, increase feedback participation, and gain unprecedented insights that drive strategic talent decisions — all with no setup time.
                </p>
              </div>

              <div className="p-4 text-left">
                <h3 className={`text-xl font-light text-berkeleyblue max-w-xl ${radley.className}`}>
                  For Managers
                </h3>
                <p className="text-slate-500 text-sm font-light mt-2">
                <i className='text-base'>Become the leader your team deserves by gaining visibility into the full context of your employees&apos; contributions.</i><br/><br/>
                Reduce preparation time for performance discussions, have more impactful career conversations backed by comprehensive data, and watch your team thrive through targeted coaching based on real-time insights.
                </p>
              </div>

              <div className="p-4 text-left">
                <h3 className={`text-xl font-light text-berkeleyblue max-w-xl ${radley.className}`}>
                  For Employees
                </h3>
                <p className="text-slate-500 text-sm font-light mt-2">
                <i className='text-base'>Take control of your professional growth.</i><br/><br/> 
                Receive balanced, anonymous insights from peers, managers, and stakeholders that highlight your true strengths and growth opportunities. Understand how you&apos;re really doing—not just what one person thinks—and build your career on solid, actionable feedback.
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>

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