// app/api/stripe/update-payment-method/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Get request body
    const { companyId, subscriptionId, paymentMethodId } = await req.json();
    
    // Validate inputs
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }
    
    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 });
    }
    
    // Check if user is an admin of the company
    const { data: companyMember, error: memberError } = await supabase
      .from('company_members')
      .select('role')
      .eq('id', user.id)
      .eq('company_id', companyId)
      .single();
      
    if (memberError || !companyMember || companyMember.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Get the company's stripe customer ID
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('stripe_customer_id, subscription_id')
      .eq('id', companyId)
      .single();
      
    if (companyError || !company || !company.stripe_customer_id) {
      return NextResponse.json({ error: 'Company not found or missing Stripe customer ID' }, { status: 404 });
    }
    
    // Make sure we have the right subscription ID
    const subscriptionIdToUse = subscriptionId || company.subscription_id;
    if (!subscriptionIdToUse) {
      return NextResponse.json({ error: 'No subscription found for this company' }, { status: 404 });
    }
    
    // Attach the payment method to the customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: company.stripe_customer_id,
    });
    
    // Set as the default payment method for the customer
    await stripe.customers.update(company.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    
    // Update the subscription's default payment method
    await stripe.subscriptions.update(subscriptionIdToUse, {
      default_payment_method: paymentMethodId,
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Payment method updated successfully' 
    });
    
  } catch (error) {
    console.error('Error updating payment method:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update payment method' },
      { status: 500 }
    );
  }
}