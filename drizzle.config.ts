import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './drizzle/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Use verbose mode to see all operations
  verbose: true,
  // Strict mode ensures all schema elements are created
  strict: true,
});