// app/page.tsx
'use client';
import { useAuth } from '@/lib/context/auth-context';
import { redirect } from "next/navigation";
import Image from 'next/image';
import { radley } from '../fonts';
import { ChartLine, Rocket, Handshake, CirclePercent, Gift, MessageCircleQuestion, MessageCircleHeart, PlayCircleIcon } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import supabase from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';


export default function Home() {
  const { user } = useAuth();

  if (user) {
    console.log('Landing Page: User is logged in, redirecting to dashboard');
    redirect('/dashboard');
  }

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    companySize: '1-50 employees',
    perfMgmt: '',
    anyElse: ''
  });
  
  // Submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (error) {
    console.log('Form error:', error);
  }

  // Handle form input changes
// interface FormData {
//     name: string;
//     email: string;
//     company: string;
//     companySize: string;
//     perfMgmt: string;
// }

const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
        ...prev,
        [name]: value
    }));
};

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
        const notesData = `DPG Application:\n ${formData.perfMgmt}\n ${formData.anyElse}`;

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
            notes: notesData
          }
        ]);
        
      if (error) throw error;
      
      // Set submission success
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
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="text-xl font-bold text-slate-900">
            <Link href="/">
              <Image src="/logo/candor_cerulean.png" alt="Candor" width={98} height={24} priority={true} />
            </Link>
          </div>
          <div className="hidden md:flex space-x-6 items-center text-slate-500 text-base font-light">
            {/* <Link href="/#features" className="">Features</Link>
            <Link href="/#use-cases" className="">Use Cases</Link> */}
            <Link className='bg-nonphotoblue-200 text-cerulean hover:bg-nonphotoblue-300 rounded-md text-sm font-normal h-9 px-4 py-2' href='/dpg#apply'>Apply Now</Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center bg-nonphotoblue-100">
        <div className="container mx-auto px-4 py-16 flex flex-col items-center text-center">
          <h1 className={`text-6xl font-light text-cerulean max-w-xl ${radley.className}`}>
            Join Candor&apos;s Exclusive Design Partnership Program
          </h1>
          <p className={`text-slate-500 text-base font-light max-w-xl mt-4`}>
          Help shape the future of automated performance feedback while gaining early access to revolutionary AI technology.
          </p>
          <Link className='mt-8 border border-cerulean text-cerulean bg-background shadow-xs hover:bg-cerulean-100 h-10 rounded-md px-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal' href='/dpg#apply'>
            Apply Now &mdash; Limited Spots
          </Link>
          <span className="text-slate-500 text-xs font-light mt-2"><i>Only 10 spots available</i></span>
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

    <div className='bg-white py-16'>
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-nonphotoblue-600 max-w-4xl ${radley.className}`}>
            Meet Candor: <i>Fully Automated 360&deg; Feedback</i>
          </h2>
          <p className={`text-slate-500 text-base font-light max-w-3xl mt-4`}>
          Candor is the world&apos;s first truly automated feedback platform that eliminates the administrative burden of collecting and analyzing 360&deg; feedback. Launch within minutes, our AI handles everything &mdash; from determining when to collect feedback and generating questions to synthesizing insights that drive performance.
          </p>
          <p className={`text-slate-500 text-base font-light max-w-3xl mt-4`}>
          Unlike traditional feedback systems, Candor works in the background, automatically capturing valuable perspectives throughout the year without creating additional work. Our calendar intelligence suggests optimal feedback moments based on interactions, while our AI analyzes patterns to deliver actionable insights for employees, managers, and HR leaders.
          </p>
          <div className='mt-8 flex flex-col md:flex-row items-center justify-center gap-4'>
          <Link className='bg-cerulean text-primary-foreground hover:bg-cerulean-600 rounded-md text-sm font-normal h-10 rounded-md px-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal' href='/' target='_blank'>
            Learn More
          </Link>
          <Link className='border border-cerulean text-cerulean bg-background shadow-xs hover:bg-cerulean-100 h-10 rounded-md px-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal' href='/demo' target='_blank'>
            Watch a Demo
            <PlayCircleIcon className="h-4 w-4 text-cerulean" />
          </Link>
          </div>
        </div>
      </div>


      <div className='bg-slate-50 py-16'>
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-berkeleyblue max-w-4xl ${radley.className}`}>
            Design Partnership: <i>An Exclusive Opportunity to Shape the Future of Feedback &amp; Performance Management</i>
          </h2>
          <p className={`text-slate-500 text-base font-light max-w-3xl mt-4`}>
          We&apos;re selecting just <i>10 forward-thinking companies</i> to join our Design Partnership Program. As one of these exclusive partners, you&apos;ll gain early access to revolutionary feedback technology while directly influencing its evolution to meet your organization&apos;s unique needs
          </p>

          <h3 className={`text-2xl font-light text-berkeleyblue max-w-4xl mt-16 ${radley.className}`}>
            What You&apos;ll Receive:
          </h3>

          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
              <div className="p-4 text-left">
                <div className="h-12 w-12 rounded-md bg-gradient-to-bl from-berkeleyblue-400 to-berkeleyblue-600 flex items-center justify-center mb-2">
                  <CirclePercent
                    className="h-6 w-6 text-slate-50"
                  />
                </div>
                <h3 className={`text-xl font-light text-berkeleyblue max-w-xl ${radley.className}`}>
                    Free 6-Month Pilot
                </h3>
                <p className="text-slate-500 text-base font-light mt-2">
                    Experience Candor&apos;s complete feedback platform at no cost, with full functionality for your entire organization.
                </p>
              </div>

              <div className="p-4 text-left">
                <div className="h-12 w-12 rounded-md bg-gradient-to-bl from-berkeleyblue-400 to-berkeleyblue-600 flex items-center justify-center mb-2">
                  <Gift
                    className="h-6 w-6 text-slate-50"
                  />
                </div>
                <h3 className={`text-xl font-light text-berkeleyblue max-w-xl ${radley.className}`}>
                    Early Feature Access
                </h3>
                <p className="text-slate-500 text-base font-light mt-2">
                    Be the first to test and implement new capabilities before they&apos;re available to the public, gaining a competitive advantage in talent development.
                </p>
              </div>

              <div className="p-4 text-left">
                <div className="h-12 w-12 rounded-md bg-gradient-to-bl from-berkeleyblue-400 to-berkeleyblue-600 flex items-center justify-center mb-2">
                  <Rocket
                    className="h-6 w-6 text-slate-50"
                  />
                </div>
                <h3 className={`text-xl font-light text-berkeleyblue max-w-xl ${radley.className}`}>
                    Direct Product Input
                </h3>
                <p className="text-slate-500 text-base font-light mt-2">
                    Shape our roadmap and feature prioritization through regular feedback sessions with our product team, ensuring Candor evolves to meet your specific needs.
                </p>
              </div>

              <div className="p-4 text-left">
                <div className="h-12 w-12 rounded-md bg-gradient-to-bl from-berkeleyblue-400 to-berkeleyblue-600 flex items-center justify-center mb-2">
                  <Handshake
                    className="h-6 w-6 text-slate-50"
                  />
                </div>
                <h3 className={`text-xl font-light text-berkeleyblue max-w-xl ${radley.className}`}>
                    Founding Team Support
                </h3>
                <p className="text-slate-500 text-base font-light mt-2">
                    Receive dedicated onboarding and implementation assistance directly from our founders, ensuring seamless integration and maximum value.
                </p>
              </div>
            </div>
          </div>

          <h3 className={`text-2xl font-light text-berkeleyblue max-w-4xl mt-16 ${radley.className}`}>
            What We Ask in Return:
          </h3>

          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mt-8">
              <div className="p-4 text-left">
                <div className="h-12 w-12 rounded-md bg-gradient-to-bl from-berkeleyblue-400 to-berkeleyblue-600 flex items-center justify-center mb-2">
                  <MessageCircleQuestion
                    className="h-6 w-6 text-slate-50"
                  />
                </div>
                <p className="text-slate-500 text-base font-light mt-2">
                    Access to interview 5-8 employees about their feedback experiences (all interviews conducted with full confidentiality)
                </p>
              </div>

              <div className="p-4 text-left">
                <div className="h-12 w-12 rounded-md bg-gradient-to-bl from-berkeleyblue-400 to-berkeleyblue-600 flex items-center justify-center mb-2">
                  <MessageCircleHeart
                    className="h-6 w-6 text-slate-50"
                  />
                </div>
                <p className="text-slate-500 text-base font-light mt-2">
                    Monthly 30-minute check-in with your team to share insights and gather feedback
                </p>
              </div>

              <div className="p-4 text-left">
                <div className="h-12 w-12 rounded-md bg-gradient-to-bl from-berkeleyblue-400 to-berkeleyblue-600 flex items-center justify-center mb-2">
                  <ChartLine
                    className="h-6 w-6 text-slate-50"
                  />
                </div>
                <p className="text-slate-500 text-base font-light mt-2">
                    Anonymous usage data to improve the platform and enhance functionality
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>


      {/* <div className='bg-white py-16'>
        <div className="container mx-auto px-8 flex flex-col items-center text-center">
          <h2 className={`text-xl font-light text-cerulean italic max-w-4xl ${radley.className}`}>
            High-performing teams have mastered the art of giving and receiving feedback. They know feedback is the thing that helps them grow. So they don&apos;t shy away from it. They give positive and constructive feedback ALL. THE. TIME.
          </h2>
          <p className='mt-8 text-slate-500 text-base font-light'>
            Peggy Shell<br />
            <span className="text-slate-500 text-sm font-light">Founder &amp; CEO, Creative Alignments</span>
          </p>
        </div>
      </div> */}

      <div className='bg-cerulean py-16'>
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-white max-w-4xl ${radley.className}`}>
            Value Across Your Entire Organization
          </h2>

          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mt-8">

              <div className="p-4 text-left">
                <h3 className={`text-xl font-light text-white max-w-xl ${radley.className}`}>
                  For Business Owners &amp; HR
                </h3>
                <p className="text-slate-100 text-sm font-light mt-2">
                <i className='text-base'>Transform your organization&apos;s feedback culture from annual reviews to continuous growth conversations.</i><br/><br/>
                Reduce administration, increase feedback participation, and gain unprecedented insights that drive strategic talent decisions — all with no setup time.
                </p>
              </div>

              <div className="p-4 text-left">
                <h3 className={`text-xl font-light text-white max-w-xl ${radley.className}`}>
                  For Managers
                </h3>
                <p className="text-slate-100 text-sm font-light mt-2">
                <i className='text-base'>Become the leader your team deserves by gaining visibility into the full context of your employees&apos; contributions.</i><br/><br/>
                Reduce preparation time for performance discussions, have more impactful career conversations backed by comprehensive data, and watch your team thrive through targeted coaching based on real-time insights.
                </p>
              </div>

              <div className="p-4 text-left">
                <h3 className={`text-xl font-light text-white max-w-xl ${radley.className}`}>
                  For Employees
                </h3>
                <p className="text-slate-100 text-sm font-light mt-2">
                <i className='text-base'>Take control of your professional growth.</i><br/><br/> 
                Receive balanced, anonymous insights from peers, managers, and stakeholders that highlight your true strengths and growth opportunities. Understand how you&apos;re really doing—not just what one person thinks—and build your career on solid, actionable feedback.
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div className='bg-white py-16' id="apply">
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
        {!submitted ? (
            <>
            <h2 className={`text-4xl font-light text-nonphotoblue-600 max-w-4xl ${radley.className}`}>
            Apply for the Candor Design Partnership Program
            </h2>
            <p className={`text-slate-500 text-base font-light max-w-3xl mt-4`}>
            Complete the brief application below to be considered for one of our limited Design Partnership spots. Our team will review your application and contact you within 2 business days.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md text-left w-full max-w-3xl mt-8">
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
                  <input 
                    id="email"
                    name="email"
                    type="email" 
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full p-2 border border-slate-300 rounded" 
                    placeholder="your@email.com" 
                    required 
                  />
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

                <div>
                  <label htmlFor="perfMgmt" className="block text-slate-700 mb-1 font-medium">Current Performance Management Challenges</label>
                  <Textarea 
                    id="perfMgmt"
                    name="perfMgmt"
                    value={formData.perfMgmt}
                    onChange={handleChange}
                    className="w-full p-2 border border-slate-300 rounded" 
                    placeholder="Describe your current performance management challenges" 
                    rows={4}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="anyElse" className="block text-slate-700 mb-1 font-medium">Anything else you&apos;d like us to know?</label>
                  <Textarea 
                    id="anyElse"
                    name="anyElse"
                    value={formData.anyElse}
                    onChange={handleChange}
                    className="w-full p-2 border border-slate-300 rounded" 
                    placeholder="Any additional information or questions?" 
                    rows={4}
                  />
                </div>
                
                <div className="pt-4">
                  <Button 
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Application'}
                  </Button>
                  <p className="text-xs text-slate-500 mt-4 text-center">
                    By clicking the &quot;Submit Application&quot; button, you are agreeing to Candor&apos;s <a href="/terms" className="text-cerulean hover:underline">Terms of Use</a> and <a href="/privacy" className="text-cerulean hover:underline">Privacy Policy</a>.
                  </p>
                </div>
              </form>
            </>
        ) : (
            <>
            <h2 className={`text-4xl font-light text-nonphotoblue-600 max-w-4xl ${radley.className}`}>
            Thank you for your application!
            </h2>
            <p className={`text-slate-500 text-base font-light max-w-3xl mt-4`}>
            We appreciate your interest in the Candor Design Partnership Program. Our team will review your application and contact you within 2 business days.
            </p>
            </>
        )}
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