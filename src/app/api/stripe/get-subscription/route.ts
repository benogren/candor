// app/api/stripe/get-subscription/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    // Auth header handling (unchanged)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    // Supabase client initialization (unchanged)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // User authentication (unchanged)
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Request body handling (unchanged)
    const { companyId } = await req.json();
    
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }
    
    // Company membership check (unchanged)
    const { data: companyMember, error: memberError } = await supabase
      .from('company_members')
      .select('role')
      .eq('id', user.id)
      .eq('company_id', companyId)
      .single();
      
    if (memberError || !companyMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Company subscription check (unchanged)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('subscription_id, stripe_customer_id')
      .eq('id', companyId)
      .single();
      
    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    
    if (!company.subscription_id) {
      return NextResponse.json({ error: 'No subscription found for this company' }, { status: 404 });
    }

    // Get the subscription details directly from Stripe
    const subscriptionResponse = await stripe.subscriptions.retrieve(company.subscription_id, {
      expand: ['default_payment_method', 'items.data.price.product']
    });

    // console.log('subscriptionResponse', subscriptionResponse);
    
    // Handle the subscription data directly to avoid TypeScript issues
    const subscription = subscriptionResponse as unknown as {
      id: string;
      status: string;
      items: {
        data: Array<{
          quantity?: number;
          price: {
            recurring?: {
              interval?: string;
            };
            product?: string | {
              deleted?: boolean;
              name?: string;
            };
            lookup_key?: string;
          };
        }>;
      };
      current_period_end: number;
      trial_end: number | null;
      cancel_at_period_end: boolean;
      default_payment_method?: string | {
        type: string;
        card?: {
          last4: string;
          brand: string;
          exp_month: number;
          exp_year: number;
        };
      };
    };
    
    // Get the subscription item
    const subscriptionItem = subscription.items.data[0];

    // console.log('****subscriptionItem', subscriptionItem);
    
    // Properly handle product name
    let productName: string | null = null;
    if (subscriptionItem?.price.product && 
        typeof subscriptionItem.price.product !== 'string' && 
        !subscriptionItem.price.product.deleted) {
      productName = subscriptionItem.price.product.name || null;
    }

    // console.log('****productName', productName);
    let intervalString = '';
    if (subscriptionItem?.price.lookup_key === 'candor_quarterly') {
        intervalString = 'Quarterly';
    } else {
        intervalString = 'Monthly';
    }

    // console.log('****$$$$', subscription.default_payment_method);
    
    // Format the subscription data for the front end
    const formattedSubscription = {
        id: subscription.id,
        status: subscription.status,
        interval: intervalString,
        current_period_end: subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toISOString() 
          : null,
        trial_end: subscription.trial_end 
          ? new Date(subscription.trial_end * 1000).toISOString() 
          : null,
      user_count: subscriptionItem?.quantity || 0,
      has_payment_method: !!subscription.default_payment_method,
      cancel_at_period_end: subscription.cancel_at_period_end,
      product_name: productName,
      // Handle payment method information
      payment_method: subscription.default_payment_method && 
        typeof subscription.default_payment_method !== 'string' && 
        subscription.default_payment_method.type === 'card' && 
        subscription.default_payment_method.card
          ? {
              last4: subscription.default_payment_method.card.last4,
              brand: subscription.default_payment_method.card.brand,
              exp_month: subscription.default_payment_method.card.exp_month,
              exp_year: subscription.default_payment_method.card.exp_year
            }
          : null
    };

    // console.log('****formattedSubscription', formattedSubscription);
    
    return NextResponse.json(formattedSubscription);
    
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve subscription data' },
      { status: 500 }
    );
  }
}