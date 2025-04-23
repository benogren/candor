// app/api/stripe/update-subscription/route.ts
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
    const { companyId, subscriptionId, newQuantity } = await req.json();
    
    // Validate inputs
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }
    
    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
    }
    
    if (typeof newQuantity !== 'number' || newQuantity < 1) {
      return NextResponse.json({ error: 'Valid quantity is required' }, { status: 400 });
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
    
    // Get the subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }
    
    // Get the first subscription item (assuming single product subscription)
    const subscriptionItemId = subscription.items.data[0]?.id;
    
    if (!subscriptionItemId) {
      return NextResponse.json({ error: 'No subscription items found' }, { status: 404 });
    }
    
    // Update the subscription quantity
    await stripe.subscriptionItems.update(subscriptionItemId, {
      quantity: newQuantity,
    });
    
    // We don't need to update user_count in the database anymore
    // Stripe is now the source of truth
    
    return NextResponse.json({ 
      success: true, 
      message: 'Subscription updated successfully',
      newQuantity
    });
    
  } catch (error) {
    console.error('Error updating subscription:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update subscription' },
      { status: 500 }
    );
  }
}