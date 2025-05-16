import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../drizzle/schema';

// Determine the environment
const isProd = process.env.NODE_ENV === 'production';
const isStaging = (process.env.NODE_ENV as string) === 'staging';

// Log which environment we're connecting to
console.log(`Connecting to ${isProd ? 'production' : isStaging ? 'staging' : 'development'} database`);

// Create the postgres client
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { 
  ssl: 'require',  // Required for Supabase
  max: 10,         // Connection pool size
  idle_timeout: 30 // How long a connection can be idle before being closed
});

// Create and export the drizzle database instance
export const db = drizzle(client, { schema });

// Export the schema for use elsewhere
export * from '../../drizzle/schema';
export * from '../../drizzle/relations';