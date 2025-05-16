'use server'

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, arrayContains } from 'drizzle-orm';
import { companies, demoLeads } from '../../../db/schema/schema';
// import { sql } from 'drizzle-orm';

// Create a PostgreSQL client
const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
const db = drizzle(client);

// Check if company exists by domain
export async function findCompanyByDomain(domain: string) {
  const result = await db
    .select({
      id: companies.id,
      name: companies.name,
      industry: companies.industry
    })
    .from(companies)
    .where(arrayContains(companies.domains, [domain]))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Create new company
export async function createCompany(data: {
  name: string;
  domains: string[];
  industry: string;
  userCount: number;
}) {
  const result = await db
    .insert(companies)
    .values({
      name: data.name,
      domains: data.domains,
      industry: data.industry,
      userCount: data.userCount
      // createdAt and updatedAt will use default values
    })
    .returning({ id: companies.id });
  
  return result.length > 0 ? result[0] : null;
}

// Update company with Stripe customer ID
export async function updateCompanyCustomerId(companyId: string, customerId: string) {
  await db
    .update(companies)
    .set({ stripeCustomerId: customerId })
    .where(eq(companies.id, companyId));
}

// Update company with subscription details
export async function updateCompanySubscription(
  companyId: string, 
  data: {
    subscriptionId: string;
    subscriptionInterval: string;
    subscriptionStatus: string;
    trialEnd: Date | null;
    userCount: number;
  }
) {
  await db
    .update(companies)
    .set({
      subscriptionId: data.subscriptionId,
      subscriptionInterval: data.subscriptionInterval,
      subscriptionStatus: data.subscriptionStatus,
      // Convert Date to string format for database
      trialEnd: data.trialEnd ? new Date(data.trialEnd).toISOString() : null,
      userCount: data.userCount
    })
    .where(eq(companies.id, companyId));
}

// Create demo lead
export async function createDemoLead(data: {
  status?: string;
  companySize?: string | number;
  notes?: string;
  company: string;
  name: string;
  email: string;
}) {
  await db
    .insert(demoLeads)
    .values({
      name: data.name,
      email: data.email,
      company: data.company,
      companySize: typeof data.companySize === 'number' 
        ? data.companySize.toString() 
        : (data.companySize || 'unknown'),
      notes: data.notes,
      status: data.status || 'pending'
      // createdAt will use default value
    });
}