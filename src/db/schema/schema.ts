import { pgTable, text, uuid, timestamp, smallint } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  domains: text('domains').array(),
  industry: text('industry'),
  stripeCustomerId: text('stripe_customer_id'),
  subscriptionId: text('subscription_id'),
  subscriptionInterval: text('subscription_interval'),
  subscriptionStatus: text('subscription_status'),
  userCount: smallint('user_count'),
  trialEnd: timestamp('trial_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const demoLeads = pgTable('demo_leads', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  company: text('company').notNull(),
  companySize: text('company_size').notNull(),
  notes: text('notes'),
  status: text('status').default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Add other tables as needed based on your database structure