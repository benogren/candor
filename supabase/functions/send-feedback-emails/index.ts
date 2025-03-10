// supabase/functions/send-feedback-emails/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';
import { Resend } from 'https://esm.sh/resend@0.15.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

serve(async (req) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Check if this is a scheduled invocation
    const { isScheduled } = await req.json();
    
    // Get today's day of the week
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Check if it's Friday (day 5) for new invitations
    // or Monday (day 1) for reminders
    const shouldSendInitial = dayOfWeek === 5 || isScheduled === 'friday';
    const shouldSendReminder = dayOfWeek === 1 || isScheduled === 'monday';
    
    if (!(shouldSendInitial || shouldSendReminder)) {
      return new Response(
        JSON.stringify({ message: 'Not scheduled to run today' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Find active feedback cycles
    const { data: activeCycles, error: cyclesError } = await supabase
      .from('feedback_cycles')
      .select('*')
      .eq('status', 'active')
      .gte('due_date', today.toISOString());
      
    if (cyclesError) throw new Error(`Error fetching cycles: ${cyclesError.message}`);
    
    if (!activeCycles || activeCycles.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active feedback cycles' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const results = {
      initialEmailsSent: 0,
      reminderEmailsSent: 0,
      errors: [] as string[]
    };

    // Process each active cycle
    for (const cycle of activeCycles) {
      // Get all company members for this cycle's company
      const { data: companyMembers, error: membersError } = await supabase
        .from('company_members')
        .select('id, name, email')
        .eq('company_id', cycle.company_id)
        .eq('status', 'active');
        
      if (membersError) {
        results.errors.push(`Error fetching members for company ${cycle.company_id}: ${membersError.message}`);
        continue;
      }
      
      if (!companyMembers || companyMembers.length === 0) continue;

      // For initial emails (Friday)
      if (shouldSendInitial) {
        for (const member of companyMembers) {
          // Check if member already has a session for this cycle
          const { data: existingSessions } = await supabase
            .from('feedback_sessions')
            .select('id')
            .eq('cycle_id', cycle.id)
            .eq('provider_id', member.id)
            .limit(1);
            
          if (existingSessions && existingSessions.length > 0) continue;
          
          // Create a new feedback session
          const { data: session, error: sessionError } = await supabase
            .from('feedback_sessions')
            .insert({
              cycle_id: cycle.id,
              provider_id: member.id,
              status: 'pending'
            })
            .select('id')
            .single();
            
          if (sessionError) {
            results.errors.push(`Error creating session for ${member.email}: ${sessionError.message}`);
            continue;
          }
          
          // Generate a secure token for authentication
          const token = generateSecureToken();
          
          // Store the token (you'd need to implement this table too)
          const { error: tokenError } = await supabase
            .from('auth_tokens')
            .insert({
              token,
              user_id: member.id,
              type: 'feedback',
              expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
              session_id: session.id
            });
            
          if (tokenError) {
            results.errors.push(`Error storing token for ${member.email}: ${tokenError.message}`);
            continue;
          }
          
          // Send email using Resend
          try {
            const feedbackUrl = `${Deno.env.get('FRONTEND_URL')}/feedback/auth?token=${token}`;
            
            await resend.emails.send({
              from: 'Candor <feedback@yourcandor.com>',
              to: member.email,
              subject: 'Provide feedback for your colleagues',
              html: `
                <h1>Hello ${member.name},</h1>
                <p>It's time to provide feedback for your colleagues.</p>
                <p>Your insights help the team grow and improve.</p>
                <p><a href="${feedbackUrl}" style="background-color: #457B9D; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Provide Feedback</a></p>
                <p>This link will expire in 48 hours.</p>
              `
            });
            
            results.initialEmailsSent++;
          } catch (emailError) {
            results.errors.push(`Error sending email to ${member.email}: ${emailError.message}`);
            continue;
          }
        }
      }
      
      // For reminder emails (Monday)
      if (shouldSendReminder) {
        // Find incomplete sessions that haven't had a reminder yet
        const { data: pendingSessions, error: pendingError } = await supabase
          .from('feedback_sessions')
          .select('id, provider_id')
          .eq('cycle_id', cycle.id)
          .neq('status', 'completed')
          .is('reminder_sent_at', null);
        
        if (pendingError) {
          results.errors.push(`Error fetching pending sessions: ${pendingError.message}`);
          continue;
        }
        
        if (!pendingSessions || pendingSessions.length === 0) continue;
        
        for (const session of pendingSessions) {
          // Get the provider's information
          const { data: provider } = await supabase
            .from('company_members')
            .select('name, email')
            .eq('id', session.provider_id)
            .single();
            
          if (!provider) continue;
          
          // Generate a new token for the reminder
          const token = generateSecureToken();
          
          // Store the token
          const { error: tokenError } = await supabase
            .from('auth_tokens')
            .insert({
              token,
              user_id: session.provider_id,
              type: 'feedback',
              expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
              session_id: session.id
            });
            
          if (tokenError) {
            results.errors.push(`Error storing reminder token for ${provider.email}: ${tokenError.message}`);
            continue;
          }
          
          // Update the session with reminder timestamp
          await supabase
            .from('feedback_sessions')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', session.id);
          
          // Send reminder email
          try {
            const feedbackUrl = `${Deno.env.get('FRONTEND_URL')}/feedback/auth?token=${token}`;
            
            await resend.emails.send({
              from: 'Candor <feedback@yourcandor.com>',
              to: provider.email,
              subject: 'Reminder: Your feedback is still needed',
              html: `
                <h1>Hello ${provider.name},</h1>
                <p>This is a friendly reminder to provide feedback for your colleagues.</p>
                <p>Your insights are valuable and help everyone improve.</p>
                <p><a href="${feedbackUrl}" style="background-color: #457B9D; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Complete Your Feedback</a></p>
                <p>This link will expire in 48 hours.</p>
              `
            });
            
            results.reminderEmailsSent++;
          } catch (emailError) {
            results.errors.push(`Error sending reminder to ${provider.email}: ${emailError.message}`);
            continue;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Email sending completed',
        initialEmailsSent: results.initialEmailsSent,
        reminderEmailsSent: results.reminderEmailsSent,
        errors: results.errors
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to generate a secure token
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}