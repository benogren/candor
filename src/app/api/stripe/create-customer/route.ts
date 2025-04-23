import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { email, name, userId, companyId, companyName } = await req.json();
    
    // Create a customer in Stripe
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
        companyId,
        companyName
      },
    });
    
    return NextResponse.json({ 
      customerId: customer.id 
    });
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}