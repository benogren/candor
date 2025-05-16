// src/db/direct-seed.ts
// import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

export async function seedDatabaseDirectly() {
  console.log('Connecting to staging database');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    console.log('Seeding feedback questions...');
    
    const { error: insertError } = await supabase
      .from('feedback_questions')
      .insert({
        question_text: 'Rate {name}\'s contribution right now',
        question_type: 'rating',
        scope: 'global',
        question_description: 'Over the past week, what was {name}\'s level of contribution in meetings or to their work?'
      });

    if (insertError) {
      console.error('Error inserting feedback question:', insertError);
    }

    console.log('Seeded feedback question successfully...');

  } catch (error) {
    console.error('Error seeding database:', error);
  }
  console.log('Database seeded successfully');
  // Close the connection

}
