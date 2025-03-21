// supabase/functions/update-feedback-occurrences/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Create Supabase client with admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    console.log("Starting update-feedback-occurrences function");
    
    // Get today's date (in UTC)
    const today = new Date();
    console.log(`Current date: ${today.toISOString()}`);
    
    // Format for date comparison (YYYY-MM-DD)
    const todayFormatted = today.toISOString().split('T')[0];
    
    // Track stats for logging
    const stats = {
      completedOccurrences: 0,
      createdOccurrences: 0,
      errors: [] as string[]
    };
    
    // 1. Get all active feedback cycles
    const { data: activeCycles, error: cyclesError } = await supabase
      .from('feedback_cycles')
      .select('id, cycle_name, frequency')
      .eq('status', 'active');
      
    if (cyclesError) {
      throw new Error(`Error fetching active cycles: ${cyclesError.message}`);
    }
    
    console.log(`Found ${activeCycles?.length || 0} active feedback cycles`);
    
    // If no active cycles, we're done
    if (!activeCycles || activeCycles.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No active cycles found", 
          stats 
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    
    // 2. Process each active cycle
    for (const cycle of activeCycles) {
      console.log(`Processing cycle ${cycle.id} (${cycle.cycle_name})`);
      
      try {
        // 3. Find active occurrences for this cycle
        const { data: activeOccurrences, error: occurrencesError } = await supabase
          .from('feedback_cycle_occurrences')
          .select('id, cycle_id, occurrence_number, start_date, end_date')
          .eq('cycle_id', cycle.id)
          .eq('status', 'active');
          
        if (occurrencesError) {
          throw new Error(`Error fetching occurrences for cycle ${cycle.id}: ${occurrencesError.message}`);
        }
        
        console.log(`Found ${activeOccurrences?.length || 0} active occurrences for cycle ${cycle.id}`);
        
        // 4. No active occurrences? Create one
        if (!activeOccurrences || activeOccurrences.length === 0) {
          console.log(`No active occurrences for cycle ${cycle.id}, creating first occurrence`);
          
          // Create start and end dates (today and 7 days from now)
          const startDate = new Date(today);
          const endDate = new Date(today);
          endDate.setDate(endDate.getDate() + 7); // Weekly frequency
          
          // Create occurrence
          const { data: newOccurrence, error: createError } = await supabase
            .from('feedback_cycle_occurrences')
            .insert({
              cycle_id: cycle.id,
              occurrence_number: 1,
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
              status: 'active'
            })
            .select()
            .single();
            
          if (createError) {
            throw new Error(`Error creating first occurrence for cycle ${cycle.id}: ${createError.message}`);
          }
          
          console.log(`Created first occurrence ${newOccurrence.id} for cycle ${cycle.id}`);
          stats.createdOccurrences++;
          continue; // Move to next cycle
        }
        
        // 5. For each active occurrence, check if it's ending today
        for (const occurrence of activeOccurrences) {
          const endDate = new Date(occurrence.end_date);
          const endDateFormatted = endDate.toISOString().split('T')[0];
          
          console.log(`Checking occurrence ${occurrence.id}: end date ${endDateFormatted}, today ${todayFormatted}`);
          
          // If today is the end date, complete this occurrence and create a new one
          if (endDateFormatted === todayFormatted) {
            console.log(`Occurrence ${occurrence.id} is ending today, marking as completed`);
            
            // Mark occurrence as completed
            const { error: updateError } = await supabase
              .from('feedback_cycle_occurrences')
              .update({ status: 'completed' })
              .eq('id', occurrence.id);
              
            if (updateError) {
              throw new Error(`Error completing occurrence ${occurrence.id}: ${updateError.message}`);
            }
            
            stats.completedOccurrences++;
            
            // Create the next occurrence
            const newStartDate = new Date(today);
            const newEndDate = new Date(today);
            newEndDate.setDate(newEndDate.getDate() + 7); // Weekly frequency
            
            console.log(`Creating next occurrence for cycle ${cycle.id}`);
            console.log(`Start date: ${newStartDate.toISOString()}, End date: ${newEndDate.toISOString()}`);
            
            const { data: newOccurrence, error: createError } = await supabase
              .from('feedback_cycle_occurrences')
              .insert({
                cycle_id: cycle.id,
                occurrence_number: occurrence.occurrence_number + 1,
                start_date: newStartDate.toISOString(),
                end_date: newEndDate.toISOString(),
                status: 'active'
              })
              .select()
              .single();
              
            if (createError) {
              throw new Error(`Error creating next occurrence for cycle ${cycle.id}: ${createError.message}`);
            }
            
            console.log(`Created new occurrence ${newOccurrence.id} for cycle ${cycle.id}`);
            stats.createdOccurrences++;
          } else {
            console.log(`Occurrence ${occurrence.id} is not ending today, skipping`);
          }
        }
      } catch (cycleError) {
        const errorMessage = `Error processing cycle ${cycle.id}: ${cycleError instanceof Error ? cycleError.message : String(cycleError)}`;
        console.error(errorMessage);
        stats.errors.push(errorMessage);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Occurrences updated successfully",
        stats: {
          completedOccurrences: stats.completedOccurrences,
          createdOccurrences: stats.createdOccurrences,
          errors: stats.errors
        }
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error updating occurrences:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});