'use client';
// import { useAuth } from '@/lib/context/auth-context';
import { radley } from '../fonts';
import React, { useState } from 'react';
import Link from 'next/link';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from '@/components/marketing/Header';
import Footer from '@/components/marketing/Footer';

export default function Pricing() {
//   const { user } = useAuth();
  const [userCount, setUserCount] = useState(10);
  const [billingCycle, setBillingCycle] = useState('monthly');

  // Calculate pricing based on user count and billing cycle
  const calculatePricing = () => {
    let pricePerUser = 0;
    let totalPrice = 0;
    let savings = 0;

    if (userCount <= 5) {
      pricePerUser = 0;
      totalPrice = 0;
    } else if (userCount <= 50) {
      if (billingCycle === 'monthly') {
        pricePerUser = 10;
        totalPrice = userCount * pricePerUser;
      } else {
        pricePerUser = 8.50;
        totalPrice = userCount * 25.50;
        savings = userCount * ((10 * 3) - 25.50);
      }
    } else {
      if (billingCycle === 'monthly') {
        pricePerUser = 9;
        totalPrice = userCount * pricePerUser;
      } else {
        pricePerUser = 7.65;
        totalPrice = userCount * 22.95;
        savings = userCount * ((9 * 3) - 22.95);
      }
    }

    return {
      pricePerUser: pricePerUser.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
      savings: savings.toFixed(2)
    };
  };

  const pricing = calculatePricing();

  // Format the total price for display
  const formatTotalPrice = () => {
    if (userCount <= 5) return 'FREE';
    return `$${pricing.totalPrice}`;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      {/* Pricing Hero Section */}
      <main className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="container mx-auto px-4 py-16 flex flex-col items-center text-center">
          <h1 className={`text-5xl font-light text-cerulean max-w-xl ${radley.className}`}>
            Simple, Transparent Pricing
          </h1>
        </div>
      </main>

      {/* Pricing Overview */}
      <div className='bg-white py-16'>
        <div className="container mx-auto px-4 flex flex-col items-center">
          <div className="w-full max-w-4xl">
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
                <div className="bg-white rounded-lg shadow-md p-8 border border-slate-200">
                  <div className="text-center mb-8">
                    <h3 className={`text-2xl font-light text-cerulean ${radley.className}`}>Simple, Volume-Based Pricing</h3>
                    <p className="mt-2 text-slate-500">All features included for every customer - you only pay for what you use</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-50 p-6 rounded-lg">
                      <div className="flex items-baseline justify-center">
                        <span className="text-3xl font-light text-slate-900">Free</span>
                      </div>
                      <div className="text-center mt-2 text-slate-500">1-5 users</div>
                    </div>
                    
                    <div className="bg-slate-50 p-6 rounded-lg border-2 border-cerulean relative">
                      <div className="absolute -top-3 right-4 bg-cerulean text-white text-xs px-3 py-1 rounded-full">
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
                  
                  <div className="text-center">
                    <Link href="/book-a-demo" className="inline-block bg-cerulean text-white text-center py-3 px-8 rounded-md hover:bg-cerulean-600 transition-colors">
                      Request a Demo
                    </Link>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="quarterly" className="mt-0">
                <div className="bg-white rounded-lg shadow-md p-8 border border-slate-200">
                  <div className="text-center mb-8">
                    <h3 className={`text-2xl font-light text-cerulean ${radley.className}`}>Simple, Volume-Based Pricing</h3>
                    <p className="mt-2 text-slate-500">All features included for every customer - with quarterly discount</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-50 p-6 rounded-lg">
                      <div className="flex items-baseline justify-center">
                        <span className="text-3xl font-light text-slate-900">Free</span>
                      </div>
                      <div className="text-center mt-2 text-cerulean text-sm font-medium">No time limit</div>
                      <div className="text-center mt-2 text-slate-500">1-5 users</div>
                    </div>
                    
                    <div className="bg-slate-50 p-6 rounded-lg border-2 border-cerulean relative">
                      <div className="absolute -top-3 right-4 bg-cerulean text-white text-xs px-3 py-1 rounded-full">
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
                  
                  <div className="text-center">
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

      {/* Pricing Calculator */}
      <div className='bg-slate-50 py-16'>
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-berkeleyblue max-w-4xl ${radley.className}`}>
            Calculate Your Price
          </h2>
          <p className={`text-slate-500 text-base font-light max-w-xl mt-4`}>
            Use the slider to estimate your pricing based on team size.
          </p>

          <div className="w-full max-w-2xl mt-8 p-8 bg-white rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-500 text-sm">Number of Users</span>
              <span className="text-cerulean font-medium">{userCount}</span>
            </div>
            
            <Slider
              defaultValue={[10]}
              min={1}
              max={100}
              step={1}
              onValueChange={(value) => setUserCount(value[0])}
              className="my-6"
            />
            
            <div className="flex justify-between mb-2">
              <span className="text-slate-500 text-sm">1</span>
              <span className="text-slate-500 text-sm">25</span>
              <span className="text-slate-500 text-sm">50</span>
              <span className="text-slate-500 text-sm">75</span>
              <span className="text-slate-500 text-sm">100</span>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-4 rounded-md">
                <h3 className="text-berkeleyblue text-lg font-medium mb-2">
                  Price Per User
                </h3>
                <div className="text-3xl font-light text-slate-900 mb-1">
                  {userCount <= 5 ? 'FREE' : `$${pricing.pricePerUser}`}
                </div>
                <div className="text-slate-500 text-sm">
                  {billingCycle === 'monthly' ? 'per month' : 'per month, billed quarterly'}
                </div>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-md">
                <h3 className="text-berkeleyblue text-lg font-medium mb-2">
                  Total Cost
                </h3>
                <div className="text-3xl font-light text-slate-900 mb-1">
                  {formatTotalPrice()}
                </div>
                <div className="text-slate-500 text-sm">
                  {userCount <= 5 ? '' : billingCycle === 'monthly' ? 'per month' : 'per quarter'}
                </div>
                {billingCycle === 'quarterly' && userCount > 5 && (
                  <div className="mt-2 text-cerulean text-sm font-medium">
                    Save ${pricing.savings} per quarter
                  </div>
                )}
              </div>
            </div>

            {/* <div className="mt-8">
              <Link href="/auth/register" className="block w-full bg-cerulean text-white text-center py-3 rounded-md hover:bg-cerulean-600 transition-colors">
                Get Started
              </Link>
            </div> */}
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className='bg-white py-16'>
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-cerulean max-w-4xl ${radley.className}`}>
            Frequently Asked Questions
          </h2>
          
          <div className="w-full max-w-3xl mt-8 space-y-6 text-left">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-medium text-berkeleyblue mb-2">How is the user count calculated?</h3>
              <p className="text-slate-500">If you can leave feedback on the user in Candor then we count them as part of your plan. This can include active users and invited users.</p>
            </div>
            
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-medium text-berkeleyblue mb-2">Is there a minimum commitment period?</h3>
              <p className="text-slate-500">No, there are no long-term contracts. Monthly plans can be canceled at any time, and quarterly plans run for three months.</p>
            </div>
            
            {/* <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-medium text-berkeleyblue mb-2">Do you offer discounts for non-profits?</h3>
              <p className="text-slate-500">Yes, we offer special pricing for non-profit organizations. Please contact our sales team for more information.</p>
            </div> */}
            
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-medium text-berkeleyblue mb-2">What happens if my team size changes?</h3>
              <p className="text-slate-500">If your team grows or shrinks, your billing will automatically adjust at the next billing cycle.</p>
            </div>
            
            <div className="pb-4">
              <h3 className="text-lg font-medium text-berkeleyblue mb-2">Can I try Candor before purchasing?</h3>
              <p className="text-slate-500">Absolutely! We offer a 10 Day Free Trial to experience Candor&apos;s core features.</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className='bg-berkeleyblue py-16'>
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <h2 className={`text-4xl font-light text-white max-w-xl ${radley.className}`}>
            Ready to Transform Your Feedback Culture?
          </h2>
          <p className={`text-white text-base font-light max-w-xl mt-4`}>
            Join organizations that are turning feedback from a dreaded annual event into an ongoing conversation that drives growth.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            {/* <Link className='border border-berkeleyblue-200 text-berkeleyblue bg-background shadow-xs hover:bg-cerulean-100 h-10 rounded-md px-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal' href='/auth/register'>
              Start Free Trial
            </Link> */}
            <Link className='border border-white text-white hover:bg-berkeleyblue-700 h-10 rounded-md px-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal' href='/book-a-demo'>
              Request a Demo
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}