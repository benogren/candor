// app/api/stripe/create-subscription/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { 
        priceLookupKey, 
        paymentMethodId, 
        customerId, 
        quantity = 1,
        includeFreeTrial = true 
      } = await req.json();
    
    // Get the price ID from the lookup key
    const prices = await stripe.prices.list({
      lookup_keys: [priceLookupKey],
      expand: ['data.product']
    });
    
    if (!prices.data.length) {
      console.error(`Price with lookup key ${priceLookupKey} not found`);
      return NextResponse.json(
        { error: `Price with lookup key ${priceLookupKey} not found` },
        { status: 400 }
      );
    }
    
    const priceId = prices.data[0].id;
    console.log(`Found price ID ${priceId} for lookup key ${priceLookupKey}`);
    
    // Determine if this is a free tier based on quantity
    const isFreeTier = quantity <= 5;
    
    // Only attach payment method for paid subscriptions
    if (paymentMethodId && !isFreeTier) {
      // Attach the payment method to the customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      console.log(`Attached payment method ${paymentMethodId} to customer ${customerId}`);
      
      // Set it as the default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
      console.log(`Set payment method ${paymentMethodId} as default for customer ${customerId}`);
    }

    const trialEnd = includeFreeTrial && !isFreeTier ? 
      Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 10) : // 10 days in seconds
      undefined;
    
    // Create subscription params
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [
        {
          price: priceId,
          quantity,
        },
      ],
      trial_end: trialEnd,
      collection_method: 'charge_automatically',
      expand: ['latest_invoice'], // Only expand the invoice, not the payment_intent
    };
    
    // Only set payment behavior for paid subscriptions
    if (!isFreeTier) {
      subscriptionParams.payment_behavior = 'default_incomplete'; // This ensures a payment_intent is created
    }
    
    // Create the subscription
    const subscription = await stripe.subscriptions.create(subscriptionParams);
    
    console.log(`Created subscription ${subscription.id} for customer ${customerId}`);
    
    // Safely get the client secret if available
    let clientSecret = null;
    if (
      subscription.latest_invoice && 
      typeof subscription.latest_invoice !== 'string' &&
      'payment_intent' in subscription.latest_invoice &&
      subscription.latest_invoice.payment_intent &&
      typeof subscription.latest_invoice.payment_intent !== 'string'
    ) {
      clientSecret = (subscription.latest_invoice.payment_intent as Stripe.PaymentIntent).client_secret;
    }
    
    return NextResponse.json({ 
      subscriptionId: subscription.id,
      clientSecret,
      status: subscription.status,
      trialEnd: subscription.trial_end
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create subscription' },
      { status: 500 }
    );
  }
}