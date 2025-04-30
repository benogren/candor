'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import supabase from '@/lib/supabase/client';
import { CardElement, useStripe, useElements, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import IndustrySearch from '@/components/IndustrySearch';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import Header from '@/components/marketing/Header';
import Footer from '@/components/marketing/Footer';
import { useAnalytics } from '@/hooks/useAnalytics';


// Load Stripe outside of component
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Price lookup keys from your Stripe dashboard
const PRICE_KEYS = {
  MONTHLY: 'candor_monthly',
  QUARTERLY: 'candor_quarterly'
};

const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com',
  'gmai.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
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

// Define form schema
const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string()
    .email({ message: 'Please enter a valid email address' })
    .refine(email => {
      const domain = email.split('@')[1]?.toLowerCase();
      return !PUBLIC_EMAIL_DOMAINS.includes(domain);
    }, { message: 'Please use your work email address instead of a personal email provider' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
});

// User range type
type UserRange = '1-5' | '6-50' | '51-100';

interface BillingOptions {
  paymentMethodId?: string;
  priceLookupKey: string;
  billingInterval: 'monthly' | 'quarterly';
  initialUserCount: number;
  userRange: UserRange;
  includeFreeTrial: boolean;
}

interface SubscriptionPayload {
  priceLookupKey: string;
  customerId: string;
  quantity: number;
  includeFreeTrial: boolean;
  paymentMethodId?: string; // Optional property
}

function CheckoutForm({
  companyName,
  onCompanyNameChange,
  onSubmit,
  isLoading,
  onBack,
  industry,
  onIndustrySelect,
}: {
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  onSubmit: (companyName: string, industry: string, billingOptions: BillingOptions) => Promise<void>;
  isLoading: boolean;
  onBack: () => void;
  industry: string;
  onIndustrySelect: (industry: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'quarterly'>('monthly');
  const [userCount, setUserCount] = useState(5);
  
  // Get user range from user count
  const getUserRange = (count: number): UserRange => {
    if (count <= 5) return '1-5';
    if (count <= 50) return '6-50';
    return '51-100';
  };
  
  const userRange = getUserRange(userCount);
  
  // Derived state - determine if on free tier based on user count
  const isFreeTier = userCount <= 5;
  
  // Calculate the current price based on user count and billing interval
  const calculatePricePerUser = (count: number, interval: 'monthly' | 'quarterly'): number => {
    if (count <= 5) return 0;
    
    if (interval === 'monthly') {
      if (count <= 50) return 10.00;
      return 9.00;
    } else {
      if (count <= 50) return 8.50;
      return 7.65;
    }
  };
  
  const pricePerUser = calculatePricePerUser(userCount, billingInterval);
  const formattedPricePerUser = `$${pricePerUser.toFixed(2)}`;
  const totalPrice = pricePerUser * userCount;
  const formattedTotalPrice = `$${totalPrice.toFixed(2)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe && !isFreeTier) {
      setError('Stripe.js hasnt loaded yet');
      return;
    }

    if (companyName.trim().length < 2) {
      setError('Company name must be at least 2 characters');
      return;
    }

    if (!industry) {
      setError('Please select an industry');
      return;
    }

    // Set up billing options
    const billingOptions: BillingOptions = {
      priceLookupKey: billingInterval === 'monthly' ? PRICE_KEYS.MONTHLY : PRICE_KEYS.QUARTERLY,
      billingInterval,
      initialUserCount: userCount,
      userRange,
      includeFreeTrial: !isFreeTier, // Only include trial for paid plans
    };

    // For the free tier, we don't need a payment method
    if (isFreeTier) {
      await onSubmit(companyName, industry, billingOptions);
      return;
    }

    // For paid tiers, we need to create a payment method
    const cardElement = elements?.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found');
      return;
    }

    try {
      const { error, paymentMethod } = await stripe!.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) {
        setError(error.message || 'An error occurred with your payment');
        return;
      }

      // Add payment method ID to billing options
      billingOptions.paymentMethodId = paymentMethod.id;
      
      await onSubmit(companyName, industry, billingOptions);
    } catch (err) {
      console.error('Payment method creation error:', err);
      setError('Failed to process payment. Please try again.');
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="companyName">Company Name</Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="Acme Inc."
            className="mt-1"
          />
          {error?.includes('Company name') && (
            <p className="text-sm font-medium text-red-500 mt-1">{error}</p>
          )}
        </div>

        <div>
          <Label htmlFor="industry">Industry</Label>
          <div className="mt-1">
            <IndustrySearch 
              onSelect={onIndustrySelect} 
              selectedIndustry={industry || null}
              placeholder="Search for your industry..."
              autoFocus={false}
            />
          </div>
          {error?.includes('industry') && (
            <p className="text-sm font-medium text-red-500 mt-1">{error}</p>
          )}
        </div>

        <div>
          <Label htmlFor="userCount">Expected Number of Users: {userCount}</Label>
          <div className="mt-2">
            <Slider
              id="userCount"
              min={1}
              max={100}
              step={1}
              value={[userCount]}
              onValueChange={(values) => setUserCount(values[0])}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        <Separator className="my-4" />
        {!isFreeTier && (
        <div>
          <Label>Billing Interval</Label>
          <RadioGroup 
            value={billingInterval} 
            onValueChange={(value) => setBillingInterval(value as 'monthly' | 'quarterly')}
            className="flex gap-4 mt-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="monthly" id="monthly" />
              <Label htmlFor="monthly">Monthly</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="quarterly" id="quarterly" />
              <Label htmlFor="quarterly">Quarterly (15% savings)</Label>
            </div>
          </RadioGroup>
        </div>
        )}

        <div className='bg-gray-50 p-4 rounded-md'>
          <div className='text-center items-center'>
            <span className="text-4xl font-bold text-gray-800 mb-2">
              {formattedPricePerUser} <br/>
            </span>
            <span className="mt-2 text-sm font-medium">
              Per employee/month
            </span>
          </div>
          
          {!isFreeTier && (
            <div className="mt-2 text-center">
              <span className="text-sm text-gray-700">
                Total: {formattedTotalPrice}/month <span>&bull; 10-Day Free Trial</span>
              </span>
            </div>
          )}
        </div>

        {!isFreeTier && (
          <div>
            <Label htmlFor="card-element">Payment Details</Label>
            <div className="mt-1 border rounded-md p-3">
              <CardElement 
                onChange={(e) => {
                  setCardComplete(e.complete);
                  if (e.error) {
                    setError(e.error.message);
                  } else {
                    setError(null);
                  }
                }}
              />
            </div>
            {error && !error.includes('Company name') && !error.includes('industry') && (
              <p className="text-sm font-medium text-red-500 mt-1">{error}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Your card won&apos;t be charged until after your 10-day free trial. You can update your exact user count before billing begins.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button 
          type="submit" 
          className="flex-1"
          disabled={isLoading || (!isFreeTier && (!stripe || !elements || !cardComplete))}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            'Start Free Trial'
          )}
        </Button>
      </div>
    </form>
    </>
  );
}

// Wrapper component that provides Stripe context
function StripeCheckout(props: {
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  onSubmit: (companyName: string, industry: string, billingOptions: BillingOptions) => Promise<void>;
  isLoading: boolean;
  onBack: () => void;
  industry: string;
  onIndustrySelect: (industry: string) => void;
}) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm {...props} />
    </Elements>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'userInfo' | 'checkout'>('userInfo');
  const [existingCompanyId, setExistingCompanyId] = useState<string | null>(null);
  const [existingCompanyName, setExistingCompanyName] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const { trackRegistrationConversion } = useAnalytics();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
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
          .select('id, name, industry')
          .contains('domains', [domain])
          .limit(1);
        
        if (error) throw error;
        
        if (companies && companies.length > 0) {
          setExistingCompanyId(companies[0].id);
          setExistingCompanyName(companies[0].name);
          
          // If there's an industry, set it
          if (companies[0].industry) {
            setIndustry(companies[0].industry);
          }
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

  async function completeRegistration(
    companyName: string,
    industry: string,
    billingOptions: BillingOptions
  ) {
    try {
      setIsLoading(true);
      console.log('Starting registration process...');
      
      const { name, email, password } = form.getValues();
      const domain = email.split('@')[1];
      console.log('Domain:', domain);
      
      // Company creation logic
      let companyId: string;
      
      if (existingCompanyId) {
        console.log('Using existing company ID:', existingCompanyId);
        companyId = existingCompanyId;
      } else {
        try {
          // Create new company
          const { data: company, error: companyError } = await supabase
            .from('companies')
            .insert({
              name: companyName,
              domains: [domain],
              industry: industry, // Add industry
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              user_count: billingOptions.initialUserCount
            })
            .select('id')
            .single();
          
          if (companyError) {
            console.error('Company creation error details:', companyError);
            throw companyError;
          }
          
          if (!company) {
            throw new Error('Failed to create company: No data returned');
          }
          
          console.log('Company created successfully:', company);
          companyId = company.id;
        } catch (compErr) {
          console.error('Company creation detailed error:', compErr);
          throw new Error(`Company creation failed: ${compErr instanceof Error ? compErr.message : String(compErr)}`);
        }
      }
      
      // User creation logic
      try {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              name: name,
              pending_company_id: companyId,
              pending_company_role: existingCompanyId ? 'member' : 'admin'
            },
          }
        });
        
        if (signUpError) {
          console.error('User signup error details:', signUpError);
          throw signUpError;
        }
        
        if (!authData.user) {
          throw new Error('Failed to create user: No user data returned');
        }
        
        console.log('User created successfully:', authData.user.id);
      
        // Create Stripe customer for all users (including free tier)
        try {
          // Create Stripe customer
          const customerResponse = await fetch('/api/stripe/create-customer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              name,
              userId: authData.user.id,
              companyId,
              companyName
            }),
          });
          
          if (!customerResponse.ok) {
            const errorData = await customerResponse.json();
            throw new Error(`Failed to create Stripe customer: ${errorData.error || customerResponse.statusText}`);
          }
          
          const { customerId } = await customerResponse.json();
          if (!customerId) {
            throw new Error('Failed to create Stripe customer: No customer ID returned');
          }
          
          // Store customer ID with company
          const { error: updateError } = await supabase
            .from('companies')
            .update({ stripe_customer_id: customerId })
            .eq('id', companyId);
            
          if (updateError) {
            console.warn('Error updating company with Stripe customer ID:', updateError);
            // Non-critical, continue
          }
          
          // Create subscription for all users (including free tier)
          const subscriptionPayload: SubscriptionPayload = {
            priceLookupKey: billingOptions.priceLookupKey,
            customerId: customerId,
            quantity: billingOptions.initialUserCount,
            includeFreeTrial: billingOptions.includeFreeTrial
          };
          
          // Only include payment method for paid plans
          if (billingOptions.userRange !== '1-5' && billingOptions.paymentMethodId) {
            subscriptionPayload.paymentMethodId = billingOptions.paymentMethodId;
          }
          
          const subscriptionResponse = await fetch('/api/stripe/create-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(subscriptionPayload),
          });
          
          if (!subscriptionResponse.ok) {
            const errorData = await subscriptionResponse.json();
            throw new Error(`Failed to create subscription: ${errorData.error || subscriptionResponse.statusText}`);
          }
          
          const { subscriptionId, status, trialEnd } = await subscriptionResponse.json();
          
          // Store subscription details with company
          const { error: subUpdateError } = await supabase
            .from('companies')
            .update({ 
              subscription_id: subscriptionId,
              subscription_interval: billingOptions.billingInterval,
              subscription_status: status,
              trial_end: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
              user_count: billingOptions.initialUserCount
            })
            .eq('id', companyId);
            
          if (subUpdateError) {
            console.warn('Error updating company with subscription details:', subUpdateError);
            // Non-critical, continue
          }
            
          console.log('Subscription created successfully:', subscriptionId);

          // update lead in database
          const { error: leadError } = await supabase
            .from('demo_leads')
            .insert({
              status: 'Completed registration',
              company_size: billingOptions.initialUserCount,
              notes: 'Completed registration and payment',
              company: companyName,
              name: name,
              email: email,
            })

          if (leadError) {
            console.error('Error updating lead:', leadError);
            toast({
              title: 'Error',
              description: 'Failed to update your information. Please try again.',
              variant: 'destructive',
            });
          }


        } catch (stripeError) {
          console.error('Stripe setup detailed error:', stripeError);
          // Continue with account creation even if payment setup fails
          // But notify the user
          toast({
            title: 'Account created, but payment setup failed',
            description: 'Your account has been created, but there was an issue setting up your payment. You can set this up later.',
            variant: 'default',
          });
        }
        
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
              email: email,
              name: name,
              companyId,
              role: existingCompanyId ? 'member' : 'admin'
            }),
          });
          
          if (!response.ok) {
            const result = await response.json();
            console.warn('Error storing pending registration:', result.error);
            // Non-critical error, we can continue
          }

          // Google Tracking
          trackRegistrationConversion(companyId);

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
      } catch (userError) {
        console.error('User registration detailed error:', userError);
        throw new Error(`Registration failed: ${userError instanceof Error ? userError.message : String(userError)}`);
      }
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

  // This function handles the continue button click
  const handleContinueClick = async () => {
    try {
      const isValid = await form.trigger(['name', 'email', 'password']);
      
      if (isValid) {
        if (existingCompanyId) {
          // If joining existing company, skip checkout and complete registration
          await completeRegistration(existingCompanyName || '', industry, {
            priceLookupKey: PRICE_KEYS.MONTHLY,
            billingInterval: 'monthly',
            initialUserCount: 1,
            userRange: '1-5',
            includeFreeTrial: false
          });
        } else {
          // Prepare company name suggestion from email domain
          const emailValue = form.getValues().email;
          const domain = emailValue.split('@')[1]?.split('.')[0] || '';
          const suggestedCompanyName = domain.charAt(0).toUpperCase() + domain.slice(1);

          //store as lead in database
          const { error: leadError } = await supabase
            .from('demo_leads')
            .insert({
              email: emailValue,
              name: form.getValues().name,
              company: suggestedCompanyName,
              company_size: 'unknown',
              notes: 'Started registration',
            });
          if (leadError) {
            console.error('Error storing lead:', leadError);
            toast({
              title: 'Error',
              description: 'Failed to store your information. Please try again.',
              variant: 'destructive',
            });
          }
          
          // Set suggested company name
          setCompanyName(suggestedCompanyName);
          
          // Move to checkout step
          setStep('checkout');
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
    <>
    <Header />
    <div className="flex justify-center items-center bg-slate-50">
      <Card className="w-full max-w-md mt-10 mb-20">
        <CardHeader>
          <CardTitle className="text-2xl">Create a Candor Account</CardTitle>
          <CardDescription>
            {step === 'userInfo' 
              ? 'Start by entering your information' 
              : 'Choose your plan and complete setup'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'userInfo' ? (
            <Form {...form}>
              <form className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Please enter your full name" {...field} />
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
                        <Input type="password" placeholder="Please enter a password" {...field} />
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
                <p className="text-xs text-slate-500 mt-4 text-center px-8">
                  By creating an account, you are agreeing to Candor&apos;s <a href="/terms" className="text-cerulean hover:underline">Terms of Use</a> and <a href="/privacy" className="text-cerulean hover:underline">Privacy Policy</a>.
                </p>
              </form>
            </Form>
          ) : (
            <StripeCheckout
              companyName={companyName}
              onCompanyNameChange={setCompanyName}
              onSubmit={completeRegistration}
              isLoading={isLoading}
              onBack={() => setStep('userInfo')}
              industry={industry}
              onIndustrySelect={setIndustry}
            />
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-slate-500 font-light">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-cerulean hover:underline">
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
    <Footer />
    </>
  );
}