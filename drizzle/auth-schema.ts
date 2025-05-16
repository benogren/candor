// drizzle/auth-schema.ts
import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';

// This matches Supabase's auth.users table structure - simplified for your needs
export const users = pgTable('users', {
  id: uuid().primaryKey().notNull(),
  // Add other fields if needed, but the ID is the main one being referenced
});