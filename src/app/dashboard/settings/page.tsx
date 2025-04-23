'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { useIsAdmin } from '@/lib/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileModal } from '@/components/ProfileModal';
import { CompanyModal } from '@/components/CompanyModal';
import { PaymentModal } from '@/components/PaymentModal';
import { LoadingSpinner } from '@/components/loading-spinner';
import supabase from '@/lib/supabase/client';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit } from '@fortawesome/free-solid-svg-icons';
import { toast } from '@/components/ui/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

// Define types for our subscription data
type StripeSubscription = {
  id: string;
  status: string;
  interval: string;
  current_period_end: string;
  trial_end: string | null;
  user_count: number;
  has_payment_method: boolean;
  cancel_at_period_end: boolean;
  product_name: string | null;
  payment_method: {
    last4: string;
    brand: string;
    exp_month: number;
    exp_year: number;
  } | null;
};

const { data: { session } } = await supabase.auth.getSession();

export default function SettingsPage() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<{
    name: string;
    email: string;
    job_title?: string;
    avatar_url?: string;
  } | null>(null);

  const [companyData, setCompanyData] = useState<{
    id: string;
    name: string;
    industry?: string;
    domains?: string[];
    subscription_id?: string;
  } | null>(null);
  
  const [subscription, setSubscription] = useState<StripeSubscription | null>(null);
  const [userCount, setUserCount] = useState<number>(5);
  // const [updatingUserCount, setUpdatingUserCount] = useState(false);
  // console.log('updatingUserCount', updatingUserCount);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user || !session?.access_token) return;
      
      try {
        setLoading(true);
        
        // Get user profile data
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('name, email, job_title, avatar_url')
          .eq('id', user.id)
          .single();
          
        if (profileError) throw profileError;
        setProfileData(profileData);
        
        // If user is admin, get company data
        if (isAdmin) {
          // First get the company_id for the user
          const { data: companyMemberData, error: companyMemberError } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('id', user.id)
            .single();
            
          if (companyMemberError) throw companyMemberError;
          
          // Then get basic company details (we'll get subscription details from Stripe)
          const { data: companyDetails, error: companyError } = await supabase
            .from('companies')
            .select('id, name, industry, domains, subscription_id')
            .eq('id', companyMemberData.company_id)
            .single();
            
          if (companyError) throw companyError;
          
          setCompanyData(companyDetails);
          
          // If there's a subscription ID, fetch details from Stripe
          if (companyDetails.subscription_id) {
            await fetchSubscriptionFromStripe(companyDetails.id, session.access_token);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [user, isAdmin, session?.access_token]);

  const fetchSubscriptionFromStripe = async (companyId: string, accessToken: string) => {
    try {
      const response = await fetch('/api/stripe/get-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ companyId }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch subscription details');
      }
      
      const subscriptionData: StripeSubscription = data;
      setSubscription(subscriptionData);
      
      // Initialize user count slider with current value from Stripe
      setUserCount(subscriptionData.user_count);
      
    } catch (error) {
      console.error('Error fetching subscription:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch subscription details',
        variant: 'destructive',
      });
    } finally {
      setLoadingSubscription(false);
    }
  };

  const handleProfileUpdate = () => {
    // Refresh profile data after update
    if (user) {
      supabase
        .from('user_profiles')
        .select('name, email, job_title, avatar_url')
        .eq('id', user.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setProfileData(data);
          }
        });
    }
  };
  
  const handleCompanyUpdate = () => {
    // Refresh company data after update
    if (user && isAdmin && companyData && session?.access_token) {
      // First get the company_id for the user
      supabase
        .from('company_members')
        .select('company_id')
        .eq('id', user.id)
        .single()
        .then(({ data: memberData, error: memberError }) => {
          if (!memberError && memberData) {
            // Then get the updated company details
            supabase
              .from('companies')
              .select('id, name, industry, domains, subscription_id')
              .eq('id', memberData.company_id)
              .single()
              .then(({ data: companyDetails, error: companyError }) => {
                if (!companyError && companyDetails) {
                  setCompanyData(companyDetails);
                  
                  // Refresh subscription data if subscription ID exists
                  if (companyDetails.subscription_id) {
                    fetchSubscriptionFromStripe(companyDetails.id, session.access_token);
                  }
                }
              });
          }
        });
    }
  };
  
  const handleSubscriptionUpdate = async () => {
    // Refresh subscription data after payment method update
    if (companyData?.id && session?.access_token) {
      await fetchSubscriptionFromStripe(companyData.id, session.access_token);
    }
  };
  
  // const handleUserCountChange = async () => {
  //   if (!companyData || !subscription || userCount === subscription.user_count || !session?.access_token) return;
    
  //   try {
  //     setUpdatingUserCount(true);
      
  //     // Call API to update subscription quantity in Stripe
  //     const response = await fetch('/api/stripe/update-subscription', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Authorization': `Bearer ${session.access_token}`
  //       },
  //       body: JSON.stringify({
  //         companyId: companyData.id,
  //         subscriptionId: subscription.id,
  //         newQuantity: userCount
  //       }),
  //     });
      
  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.error || 'Failed to update subscription');
  //     }
      
  //     // Update local state with the new user count
  //     setSubscription({
  //       ...subscription,
  //       user_count: userCount
  //     });
      
  //     toast({
  //       title: 'Success',
  //       description: 'Your subscription has been updated successfully.',
  //       variant: 'default',
  //     });
      
  //   } catch (error) {
  //     console.error('Error updating subscription:', error);
  //     toast({
  //       title: 'Error',
  //       description: error instanceof Error ? error.message : 'Failed to update subscription',
  //       variant: 'destructive',
  //     });
  //     // Reset to original value
  //     if (subscription) {
  //       setUserCount(subscription.user_count);
  //     }
  //   } finally {
  //     setUpdatingUserCount(false);
  //   }
  // };
  
  // Calculate price based on user count and subscription interval
  // const calculatePricePerUser = (count: number, interval?: string): number => {
  //   if (count <= 5) return 0;
    
  //   if (interval === 'monthly') {
  //     if (count <= 50) return 10.00;
  //     return 9.00;
  //   } else if (interval === 'quarterly') {
  //     if (count <= 50) return 8.50;
  //     return 7.65;
  //   }
    
  //   // Default to monthly pricing
  //   if (count <= 50) return 10.00;
  //   return 9.00;
  // };
  
  // const pricePerUser = calculatePricePerUser(userCount, subscription?.interval);
  // const totalPrice = pricePerUser * userCount;
  const isFreeTier = userCount <= 5;
  
  // Format dates for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Format payment method for display
  // const getPaymentMethodDisplay = () => {
  //   if (!subscription?.payment_method) return 'No payment method on file';
    
  //   const { brand, last4, exp_month, exp_year } = subscription.payment_method;
  //   return `${brand.charAt(0).toUpperCase() + brand.slice(1)} ending in ${last4} (Expires ${exp_month}/${exp_year})`;
  // };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
          <p className="ml-2">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-light text-berkeleyblue">Account Settings</h1>
      </div>
      
      {/* Profile Card */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your personal details and job information</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsProfileModalOpen(true)}
            >
              <FontAwesomeIcon icon={faEdit} className="mr-2" />
              Edit Profile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {profileData ? (
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Name</h3>
                  <p className="mt-1">{profileData.name || 'Not provided'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Email</h3>
                  <p className="mt-1">{profileData.email}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Job Title</h3>
                  <p className="mt-1">{profileData.job_title || 'Not provided'}</p>
                </div>
              </div>
            </div>
          ) : (
            <p>No profile information available.</p>
          )}
        </CardContent>
      </Card>
      
      {/* Company Card - Only for Admins */}
      {isAdmin && companyData && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Organization details and settings</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsCompanyModalOpen(true)}
              >
                <FontAwesomeIcon icon={faEdit} className="mr-2" />
                Edit Company
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Company Name</h3>
                  <p className="mt-1">{companyData.name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Industry</h3>
                  <p className="mt-1">{companyData.industry || 'Not specified'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Subscription Management Card - Only for Admins */}
      {isAdmin && companyData && subscription && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Subscription Management</CardTitle>
                <CardDescription>Manage your plan, seats, and payment information</CardDescription>
              </div>
              <div className='items-center flex gap-2'>
              {/* <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsPaymentModalOpen(true)}
              >
                <FontAwesomeIcon icon={faCreditCard} className="mr-2" />
                Update Payment
              </Button> */}
              <Link 
                href="https://billing.stripe.com/p/login/8wMcOT6TvejKeRi4gg"
                target='_blank'
                rel="noopener noreferrer"
                className="h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 border border-cerulean text-cerulean bg-background shadow-xs hover:bg-cerulean-100 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-normal transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
              >
                
                Manage Subscription
              </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSubscription ? (
              <div className="flex justify-center items-center h-32">
                <LoadingSpinner />
                <p className="ml-2">Loading subscription details...</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {/* Current Plan Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Current Plan</h3>
                    <p className="mt-1 capitalize">
                      {isFreeTier ? 'Free Tier' : `${subscription.interval || 'Monthly'} Plan`}
                      {subscription.product_name && ` (${subscription.product_name})`}
                    </p>
                    {isFreeTier && (
                    <p className="mt-2 text-sm text-green-600">
                      <i>You are currently on the free tier (1-5 users)</i>
                    </p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Total User Count
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-2 text-gray-400 cursor-help">
                              <Badge variant="secondary" className="text-xs text-gray-500">
                                ?
                              </Badge>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm">This includes active and invited users</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </h3>
                    <p className="mt-1 capitalize">
                      {userCount} Users
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Status</h3>
                    <p className="mt-1 capitalize">
                      {subscription.status || 'Active'}
                      {subscription.trial_end && new Date(subscription.trial_end) > new Date() && 
                        ' (Trial)'}
                      {subscription.cancel_at_period_end && ' (Canceling)'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      {subscription.trial_end && new Date(subscription.trial_end) > new Date() 
                        ? 'Trial Ends' 
                        : 'Next Billing Date'}
                    </h3>
                    <p className="mt-1">
                      {subscription.trial_end && new Date(subscription.trial_end) > new Date()
                        ? formatDate(subscription.trial_end)
                        : formatDate(subscription.current_period_end)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Profile Modal */}
      {profileData && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            handleProfileUpdate();
          }}
          defaultValues={profileData}
        />
      )}
      
      {/* Company Modal */}
      {companyData && (
        <CompanyModal
          isOpen={isCompanyModalOpen}
          onClose={() => {
            setIsCompanyModalOpen(false);
            handleCompanyUpdate();
          }}
          defaultValues={companyData}
        />
      )}
      
      {/* Payment Modal */}
      {companyData && subscription && session?.access_token && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            handleSubscriptionUpdate();
          }}
          companyId={companyData.id}
          subscriptionId={subscription.id}
          accessToken={session.access_token}
        />
      )}
    </div>
  );
}