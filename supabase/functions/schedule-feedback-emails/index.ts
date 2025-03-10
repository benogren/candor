// supabase/functions/schedule-feedback-emails/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';
import { Resend } from 'https://esm.sh/resend@0.15.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000';

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

serve(async (req) => {
  try {
    // This function should be triggered by a Supabase scheduled task
    
    // Get today's day of the week (0 = Sunday, 1 = Monday, etc.)
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Determine if we're sending initial emails (Friday) or reminders (Monday)
    const isFriday = dayOfWeek === 5;
    const isMonday = dayOfWeek === 1;
    
    // For testing purposes, allow overriding via request body
    let forceFriday = false;
    let forceMonday = false;
    
    try {
      const body = await req.json();
      forceFriday = body.forceFriday === true;
      forceMonday = body.forceMonday === true;
    } catch (e) {
      // If not a JSON request or no body, that's fine
    }
    
    if ((!isFriday && !isMonday) && (!forceFriday && !forceMonday)) {
      return new Response(
        JSON.stringify({ message: "Not scheduled to run today" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Get all active companies with their settings
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name');
      
    if (companiesError) {
      throw new Error(`Error fetching companies: ${companiesError.message}`);
    }
    
    const results = {
      totalEmails: 0,
      errors: [] as string[]
    };
    
    // Process each company
    for (const company of companies) {
      // Check if any active feedback cycles for this company
      const { data: activeCycles, error: cyclesError } = await supabase
        .from('feedback_cycles')
        .select('id, cycle_name')
        .eq('company_id', company.id)
        .eq('status', 'active')
        .gte('due_date', today.toISOString());
        
      if (cyclesError) {
        results.errors.push(`Error fetching cycles for ${company.name}: ${cyclesError.message}`);
        continue;
      }
      
      if (!activeCycles || activeCycles.length === 0) {
        // No active cycles for this company, skip
        continue;
      }
      
      // Use the most recent cycle
      const currentCycle = activeCycles[0];
      
      // Get all active members for the company
      const { data: members, error: membersError } = await supabase
        .from('company_members')
        .select('id, name, email')
        .eq('company_id', company.id)
        .eq('status', 'active');
        
      if (membersError) {
        results.errors.push(`Error fetching members for ${company.name}: ${membersError.message}`);
        continue;
      }
      
      if (!members || members.length === 0) {
        // No active members, skip
        continue;
      }
      
      // For Friday: Send initial emails
      if (isFriday || forceFriday) {
        for (const member of members) {
          try {
            // Check if already has a session for this cycle
            const { data: existingSessions } = await supabase
              .from('feedback_sessions')
              .select('id')
              .eq('cycle_id', currentCycle.id)
              .eq('provider_id', member.id)
              .limit(1);
              
            if (existingSessions && existingSessions.length > 0) {
              // Already has a session, skip
              continue;
            }
            
            // Create a new feedback session
            const { data: session, error: sessionError } = await supabase
              .from('feedback_sessions')
              .insert({
                cycle_id: currentCycle.id,
                provider_id: member.id,
                status: 'pending'
              })
              .select('id')
              .single();
              
            if (sessionError) {
              results.errors.push(`Error creating session for ${member.email}: ${sessionError.message}`);
              continue;
            }
            
            // Generate auth token
            const token = generateSecureToken();
            
            // Store token
            const { error: tokenError } = await supabase
              .from('auth_tokens')
              .insert({
                token,
                user_id: member.id,
                type: 'feedback',
                expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                session_id: session.id
              });
              
            if (tokenError) {
              results.errors.push(`Error storing token for ${member.email}: ${tokenError.message}`);
              continue;
            }
            
            // Send email
            const feedbackUrl = `${frontendUrl}/feedback/auth?token=${token}`;
            
            await resend.emails.send({
              from: 'Candor <feedback@yourcandor.com>',
              to: member.email,
              subject: 'Your weekly feedback opportunity is here',
              html: getEmailTemplate(member.name, feedbackUrl, false)
            });
            
            results.totalEmails++;
          } catch (error) {
            results.errors.push(`Error processing ${member.email}: ${error.message}`);
          }
        }
      }
      
      // For Monday: Send reminder emails
      if (isMonday || forceMonday) {
        // Find incomplete sessions that haven't had a reminder
        const { data: pendingSessions, error: pendingError } = await supabase
          .from('feedback_sessions')
          .select('id, provider_id')
          .eq('cycle_id', currentCycle.id)
          .neq('status', 'completed')
          .is('reminder_sent_at', null);
          
        if (pendingError) {
          results.errors.push(`Error fetching pending sessions: ${pendingError.message}`);
          continue;
        }
        
        if (!pendingSessions || pendingSessions.length === 0) {
          // No pending sessions, skip
          continue;
        }
        
        for (const session of pendingSessions) {
          try {
            // Get member details
            const { data: member } = await supabase
              .from('company_members')
              .select('name, email')
              .eq('id', session.provider_id)
              .single();
              
            if (!member) {
              results.errors.push(`Member not found for session ${session.id}`);
              continue;
            }
            
            // Generate token
            const token = generateSecureToken();
            
            // Store token
            const { error: tokenError } = await supabase
              .from('auth_tokens')
              .insert({
                token,
                user_id: session.provider_id,
                type: 'feedback',
                expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                session_id: session.id
              });
              
            if (tokenError) {
              results.errors.push(`Error storing token for ${member.email}: ${tokenError.message}`);
              continue;
            }
            
            // Update session with reminder timestamp
            await supabase
              .from('feedback_sessions')
              .update({ reminder_sent_at: new Date().toISOString() })
              .eq('id', session.id);
            
            // Send reminder email
            const feedbackUrl = `${frontendUrl}/feedback/auth?token=${token}`;
            
            await resend.emails.send({
              from: 'Candor <feedback@yourcandor.com>',
              to: member.email,
              subject: 'Reminder: Your feedback is still needed',
              html: getEmailTemplate(member.name, feedbackUrl, true)
            });
            
            results.totalEmails++;
          } catch (error) {
            results.errors.push(`Error sending reminder: ${error.message}`);
          }
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        emailsSent: results.totalEmails,
        errors: results.errors
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// Helper function to generate a secure token
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Email template function
function getEmailTemplate(name: string, url: string, isReminder: boolean): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; background-color: #457B9D; color: white; 
                 padding: 12px 24px; text-decoration: none; border-radius: 4px; }
        .footer { margin-top: 40px; font-size: 12px; color: #777; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Hello ${name},</h1>
        
        ${isReminder 
          ? `<p>This is a friendly reminder that your feedback is still needed. Your insights help your team grow and improve.</p>
             <p>Please take a few minutes to provide feedback for your colleagues.</p>`
          : `<p>It's time for your weekly feedback opportunity!</p>
             <p>Providing regular feedback helps your team grow and improve.</p>
             <p>This should only take a few minutes to complete.</p>`
        }
        
        <p style="margin: 30px 0; text-align: center;">
          <a href="${url}" class="button">Provide Feedback</a>
        </p>
        
        <p>This link will expire in 48 hours.</p>
        
        <div class="footer">
          <p>This email was sent by Candor, your team feedback platform.</p>
          <p>If you did not expect this email, please contact your administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}