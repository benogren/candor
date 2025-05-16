// src/db/migrate.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  const migrationClient = postgres(process.env.DATABASE_URL!, { 
    max: 1,
    ssl: 'require'
  });
  
  const db = drizzle(migrationClient);
  
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('Migrations complete!');
  
  await migrationClient.end();
}

main().catch((err) => {
  console.error('Migration failed!', err);
  process.exit(1);
});