'use client';

import { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';

// Load Stripe outside of component 
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Price lookup keys from your Stripe dashboard
const PRICE_KEYS = {
  MONTHLY: 'candor_monthly',
  QUARTERLY: 'candor_quarterly'
};

interface CheckoutFormProps {
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  onSubmit: (companyName: string, billingOptions: BillingOptions) => Promise<void>;
  isLoading: boolean;
  onBack: () => void;
}

interface BillingOptions {
  paymentMethodId?: string;
  priceLookupKey: string;
  billingInterval: 'monthly' | 'quarterly';
  initialUserCount: number;
}

function CheckoutForm({
  companyName,
  onCompanyNameChange,
  onSubmit,
  isLoading,
  onBack
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'quarterly'>('monthly');
  const [userCount, setUserCount] = useState(1);
  const [isFreeTier, setIsFreeTier] = useState(true);

  // Update free tier status whenever user count changes
  useEffect(() => {
    setIsFreeTier(userCount <= 5);
  }, [userCount]);

  // Calculate the current price based on user count and billing interval
  const calculatePrice = (count: number, interval: 'monthly' | 'quarterly'): string => {
    if (count <= 5) return 'Free';
    
    if (interval === 'monthly') {
      if (count <= 50) return `$10.00/user/month`;
      if (count <= 100) return `$9.00/user/month`;
      return `$8.00/user/month`;
    } else {
      if (count <= 50) return `$25.00/user/quarter`;
      if (count <= 100) return `$22.00/user/quarter`;
      return `$19.00/user/quarter`;
    }
  };

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

    // Set up billing options
    const billingOptions: BillingOptions = {
      priceLookupKey: billingInterval === 'monthly' ? PRICE_KEYS.MONTHLY : PRICE_KEYS.QUARTERLY,
      billingInterval,
      initialUserCount: userCount,
    };

    // For the free tier, we don't need a payment method
    if (isFreeTier) {
      await onSubmit(companyName, billingOptions);
      return;
    }

    // For paid tiers, we need to create a payment method
    const cardElement = elements?.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found');
      return;
    }

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
    
    await onSubmit(companyName, billingOptions);
  };

  return (
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
          <Label htmlFor="userCount">Initial Number of Users</Label>
          <Input
            id="userCount"
            type="number"
            min="1"
            value={userCount}
            onChange={(e) => setUserCount(parseInt(e.target.value) || 1)}
            className="mt-1"
          />
          <p className="text-sm text-gray-500 mt-1">
            Current tier: {calculatePrice(userCount, billingInterval)}
          </p>
        </div>

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
            {error && !error.includes('Company name') && (
              <p className="text-sm font-medium text-red-500 mt-1">{error}</p>
            )}
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
            'Create Account'
          )}
        </Button>
      </div>
    </form>
  );
}

// Wrapper component that provides Stripe context
export default function StripeCheckout(props: Omit<CheckoutFormProps, 'stripe' | 'elements'>) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm {...props} />
    </Elements>
  );
}