// supabase/functions/schedule-feedback-emails/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000';

// Validate required environment variables
const missingEnvVars = [];
if (!supabaseUrl) missingEnvVars.push('SUPABASE_URL');
if (!supabaseServiceKey) missingEnvVars.push('SUPABASE_SERVICE_ROLE_KEY');
if (!resendApiKey) missingEnvVars.push('RESEND_API_KEY');

// Create clients only if environment variables are available
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Direct email sending function using fetch API
async function sendEmail(from: string, to: string, subject: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Resend API error (${response.status}):`, errorText);
    throw new Error(`Failed to send email (${response.status}): ${errorText}`);
  }
  
  return await response.json();
}

serve(async (req) => {
  try {
    // Check for missing environment variables
    if (missingEnvVars.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: `Missing required environment variables: ${missingEnvVars.join(', ')}`,
          details: "Please set these variables in your Supabase Edge Function configuration."
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate Resend API key format
    if (!resendApiKey.startsWith('re_') || resendApiKey.length < 20) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid Resend API key format",
          details: `API key should start with 're_' and be at least 20 characters (found: ${resendApiKey.length} chars, starts with: ${resendApiKey.substring(0, 3)}...)`
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Try to send a test email to verify the API key works
    try {
      // Only test in non-production environments or when debugging
      if (Deno.env.get('DEBUG') === 'true') {
        await sendEmail(
          'Candor <feedback@app.candor.so>',
          'test@example.com',
          'Test Email',
          '<p>Test email to verify Resend API key works.</p>'
        );
        console.log('Test email sent successfully');
      }
    } catch (testError) {
      console.error('Test email failed:', testError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send test email",
          details: testError instanceof Error ? testError.message : String(testError)
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get today's day of the week (0 = Sunday, 1 = Monday, etc.)
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Determine if we're sending initial emails (Friday) or reminders (Monday)
    // Default to Friday for initial emails
    const isFriday = dayOfWeek === 5;
    const isMonday = dayOfWeek === 1;
    
    // For testing purposes, allow overriding via request body
    let forceFriday = false;
    let forceMonday = false;
    let targetCycleId: string | null = null;
    let targetOccurrenceId: string | null = null;
    
    try {
      const body = await req.json();
      forceFriday = body.forceFriday === true;
      forceMonday = body.forceMonday === true;
      targetCycleId = body.targetCycleId || null;
      targetOccurrenceId = body.targetOccurrenceId || null;
    } catch (e) {
      // If not a JSON request or no body, that's fine
      console.log("No request body or not JSON");
    }
    
    if ((!isFriday && !isMonday) && (!forceFriday && !forceMonday)) {
      return new Response(
        JSON.stringify({ message: "Not scheduled to run today" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Get all active companies
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
      try {
        // Get active occurrences instead of cycles directly
        let occurrencesQuery = supabase
          .from('feedback_cycle_occurrences')
          .select(`
            id, 
            cycle_id,
            occurrence_number, 
            start_date, 
            end_date, 
            status,
            emails_sent_at,
            reminders_sent_at,
            emails_sent_count,
            responses_count,
            feedback_cycles (
              id, 
              cycle_name, 
              company_id, 
              frequency, 
              status
            )
          `)
          .eq('status', 'active');
        
        // If targeting a specific occurrence
        if (targetOccurrenceId) {
          occurrencesQuery = occurrencesQuery.eq('id', targetOccurrenceId);
        }
        // Otherwise get occurrences for active cycles
        else {
          occurrencesQuery = occurrencesQuery.eq('feedback_cycles.status', 'active');
        }
        
        // If targeting a specific cycle, add that filter
        if (targetCycleId) {
          occurrencesQuery = occurrencesQuery.eq('cycle_id', targetCycleId);
        }
        
        // Execute the query
        const { data: activeOccurrences, error: occurrencesError } = await occurrencesQuery;
          
        if (occurrencesError) {
          throw new Error(`Error fetching active occurrences: ${occurrencesError.message}`);
        }
        
        if (!activeOccurrences || activeOccurrences.length === 0) {
          // No active occurrences for this company, skip
          continue;
        }
        
        // Filter occurrences for cycles in this company
        const companyOccurrences = activeOccurrences.filter(
          occ => occ.feedback_cycles.company_id === company.id
        );
        
        if (companyOccurrences.length === 0) {
          continue;
        }
        
        // Process each active occurrence
        for (const occurrence of companyOccurrences) {
          // Check if this occurrence has ended and should be completed
          const endDate = new Date(occurrence.end_date);
          const isEndDay = endDate.toDateString() === today.toDateString();
          const isPast = endDate < today && endDate.toDateString() !== today.toDateString();
          
          // If it's the end day or past due, complete the occurrence
          if ((isEndDay || isPast) && occurrence.feedback_cycles.status === 'active') {
            // Mark occurrence as completed which will trigger next occurrence creation
            await supabase
              .from('feedback_cycle_occurrences')
              .update({ 
                status: 'completed'
              })
              .eq('id', occurrence.id);
              
            // Continue to next occurrence - the trigger will create the new one
            continue;
          }
          
          // For Friday or forced Friday: Send initial emails to members
          if ((isFriday || forceFriday) && 
              (!occurrence.emails_sent_at || forceFriday)) {
            
            // Get active company members
            const { data: members, error: membersError } = await supabase
              .from('company_members')
              .select('id')
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

            let emailsSentCount = 0;
            
            // Process each member
            for (const member of members) {
              try {
                // Get profile data separately
                const { data: profile, error: profileError } = await supabase
                  .from('user_profiles')
                  .select('email, name')
                  .eq('id', member.id)
                  .single();
                  
                if (profileError) {
                  results.errors.push(`Error fetching profile for user ${member.id}: ${profileError.message}`);
                  continue;
                }
                
                if (!profile || !profile.email) {
                  results.errors.push(`No profile or email found for user ${member.id}`);
                  continue;
                }
                
                const memberEmail = profile.email;
                const memberName = profile.name || memberEmail.split('@')[0];
                
                // Check if already has a session for this occurrence
                const { data: existingSessions } = await supabase
                  .from('feedback_sessions')
                  .select('id')
                  .eq('cycle_id', occurrence.cycle_id)
                  .eq('occurrence_id', occurrence.id)
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
                    cycle_id: occurrence.cycle_id,
                    occurrence_id: occurrence.id, // Link to occurrence
                    provider_id: member.id,
                    status: 'pending'
                  })
                  .select('id')
                  .single();
                  
                if (sessionError) {
                  results.errors.push(`Error creating session for ${memberEmail}: ${sessionError.message}`);
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
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
                    session_id: session.id
                  });
                  
                if (tokenError) {
                  results.errors.push(`Error storing token for ${memberEmail}: ${tokenError.message}`);
                  continue;
                }
                
                // Send email
                const feedbackUrl = `${frontendUrl}/feedback/auth?token=${token}`;

                console.log(`Sending email to ${memberEmail}`);
                
                try {
                  await sendEmail(
                    'Candor <feedbackbot@app.candor.so>',
                    memberEmail,
                    `Your teammates would appreciate your feedback`,
                    getEmailTemplate(memberName, feedbackUrl, company.name)
                  );
                  
                  emailsSentCount++;
                  results.totalEmails++;
                } catch (emailError) {
                  results.errors.push(`Error sending email to ${memberEmail}: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
                }
              } catch (error) {
                results.errors.push(`Error processing user ${member.id}: ${error instanceof Error ? error.message : String(error)}`);
              }
            }
            
            // Also check for invited users
            const { data: invitedUsers, error: invitedError } = await supabase
              .from('invited_users')
              .select('id, email, name, invite_code')
              .eq('company_id', company.id)
              .is('used_at', null);
              
            if (!invitedError && invitedUsers && invitedUsers.length > 0) {
              for (const invitedUser of invitedUsers) {
                try {
                  // Send special email to invited users
                  const signupUrl = `${frontendUrl}/auth/register/invite?code=${invitedUser.invite_code}&email=${encodeURIComponent(invitedUser.email)}`;
                  
                  try {
                    await sendEmail(
                      'Candor <feedbackbot@app.candor.so>',
                      invitedUser.email,
                      `Join Candor: ${company.name}'s New Feedback Platform`,
                      getInvitedUserEmailTemplate(invitedUser.name || invitedUser.email.split('@')[0], signupUrl, company.name)
                    );
                    
                    emailsSentCount++;
                    results.totalEmails++;
                  } catch (emailError) {
                    results.errors.push(`Error sending invite email to ${invitedUser.email}: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
                  }
                } catch (error) {
                  results.errors.push(`Error processing invite for ${invitedUser.email}: ${error instanceof Error ? error.message : String(error)}`);
                }
              }
            }
            
            // Update occurrence with email sent info
            await supabase
              .from('feedback_cycle_occurrences')
              .update({ 
                emails_sent_at: new Date().toISOString(),
                emails_sent_count: occurrence.emails_sent_count + emailsSentCount
              })
              .eq('id', occurrence.id);
          }
          
          // For Monday or forced Monday: Send reminder emails
          if ((isMonday || forceMonday) && 
              (occurrence.emails_sent_at && !occurrence.reminders_sent_at || forceMonday)) {
            
            // Find incomplete sessions that haven't had a reminder
            const { data: pendingSessions, error: pendingError } = await supabase
              .from('feedback_sessions')
              .select('id, provider_id')
              .eq('occurrence_id', occurrence.id)
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
                // Get member details from user_profiles
                const { data: profile, error: profileError } = await supabase
                  .from('user_profiles')
                  .select('name, email')
                  .eq('id', session.provider_id)
                  .single();
                  
                if (profileError) {
                  results.errors.push(`Error fetching profile for user ${session.provider_id}: ${profileError.message}`);
                  continue;
                }
                
                if (!profile || !profile.email) {
                  results.errors.push(`No profile or email found for user ${session.provider_id}`);
                  continue;
                }
                
                const memberEmail = profile.email;
                const memberName = profile.name || memberEmail.split('@')[0];
                
                // Generate token
                const token = generateSecureToken();
                
                // Store token
                const { error: tokenError } = await supabase
                  .from('auth_tokens')
                  .insert({
                    token,
                    user_id: session.provider_id,
                    type: 'feedback',
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
                    session_id: session.id
                  });
                  
                if (tokenError) {
                  results.errors.push(`Error storing token for ${memberEmail}: ${tokenError.message}`);
                  continue;
                }
                
                // Update session with reminder timestamp
                await supabase
                  .from('feedback_sessions')
                  .update({ reminder_sent_at: new Date().toISOString() })
                  .eq('id', session.id);
                
                // Send reminder email
                const feedbackUrl = `${frontendUrl}/feedback/auth?token=${token}`;
                
                try {
                  await sendEmail(
                    'Candor <feedbackbot@app.candor.so>',
                    memberEmail,
                    `A gentle reminder: Your feedback is still needed`,
                    getReminderEmailTemplate(memberName, feedbackUrl, company.name)
                  );
                  
                  results.totalEmails++;
                } catch (emailError) {
                  results.errors.push(`Error sending reminder email to ${memberEmail}: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
                }
              } catch (error) {
                results.errors.push(`Error sending reminder for session ${session.id}: ${error instanceof Error ? error.message : String(error)}`);
              }
            }
            
            // Update occurrence with reminder timestamp
            await supabase
              .from('feedback_cycle_occurrences')
              .update({ reminders_sent_at: new Date().toISOString() })
              .eq('id', occurrence.id);
          }
        }
      } catch (companyError) {
        results.errors.push(`Error processing company ${company.name}: ${companyError instanceof Error ? companyError.message : String(companyError)}`);
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
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
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

// Email template function for registered users
function getEmailTemplate(name: string, url: string, companyName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { margin-bottom: 40px; }
        .header img { width: 150px; height: 37px; }
        .header a.img {text-decoration: none;}
        h1 { font-size: 24px; margin-bottom: 20px; color: #457b9d; }
        p { margin-bottom: 20px; color: #333333; }
        a { text-decoration: none; }
        .button { display: inline-block; background-color: #457b9d; color: #fefefe!important; 
                 padding: 12px 24px; text-decoration: none; border-radius: 4px; }
        .footer { margin-top: 40px; font-size: 12px; color: #777777; text-align: center; }
        hr { border: 0; border-top: 1px solid #eeeeee; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
            <a href="${url}"><img src="https://sjxwcwtgahnbooyboeww.supabase.co/storage/v1/object/public/marketing/candor_cerulean.png" width="150" height="37" alt="Candor" /></a>
        </div>
        <h1>Your teammates would appreciate your feedback!</h1>
        <p>
            Hi ${name}, <br/>Your team would value your perspective on how they&#39;re doing. Your insights can make a real difference in their professional growth.
        </p>
        <p><strong>Why your feedback matters:</strong></p>
        <p>
            Your unique perspective helps create a fuller picture of your colleagues&#39; impact. The small things you notice might be exactly what they need to hear.
        </p>
        <p><strong>This will be quick and meaningful:</strong></p>
        <ul>
            <li>Takes just 3-5 minutes</li>
            <li>Your feedback remains 100% anonymous</li>
            <li>Focus on specific examples rather than general impressions</li>
            <li>Be thoughtful but don&#39;t overthink it &mdash; your honest perspective is what counts</li>
        </ul>
        <p><strong>Ready to share your thoughts?</strong></p>
        <p>
            <a href="${url}" class="button" style="color: #fefefe!important;">Provide Feedback</a>
        </p>
        <p>
            Remember, the most helpful feedback is specific, balanced, and actionable. Share both strengths you&#39;ve observed and suggestions that could help your teammates grow.
        </p>
        <p>
            Thank you for contributing to our culture of growth and continuous improvement!
        </p>
        <p>
            Best,<br/>
            The ${companyName} Team
        </p>
        <div class="footer">
            <hr />
          <p>${companyName} is powered by Candor</p>
          <p>You received this email because you are an employee of ${companyName} and subscribed to receive communications from Candor. If you did not expect this email, please contact your company&#39;s administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Email template function for registered users
function getReminderEmailTemplate(name: string, url: string, companyName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { margin-bottom: 40px; }
        .header img { width: 150px; height: 37px; }
        .header a.img {text-decoration: none;}
        h1 { font-size: 24px; margin-bottom: 20px; color: #457b9d; }
        p { margin-bottom: 20px; color: #333333; }
        a { text-decoration: none; }
        .button { display: inline-block; background-color: #457b9d; color: #fefefe!important; 
                 padding: 12px 24px; text-decoration: none; border-radius: 4px; }
        .footer { margin-top: 40px; font-size: 12px; color: #777777; text-align: center; }
        hr { border: 0; border-top: 1px solid #eeeeee; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
            <a href="${url}"><img src="https://sjxwcwtgahnbooyboeww.supabase.co/storage/v1/object/public/marketing/candor_cerulean.png" width="150" height="37" alt="Candor" /></a>
        </div>
        <p>
            Hi ${name}, <br/>Just a friendly reminder that your team is still looking forward to your feedback.
        </p>
        <p><strong>We know you&#39;re busy:</strong></p>
        <p>
            We completely understand that things get hectic, but your perspective is valuable and only takes a few minutes to share.
        </p>
        <p><strong>This will be quick and meaningful:</strong></p>
        <ul>
            <li>Your feedback helps build a stronger team</li>
            <li>The feedback window closes soon!</li>
            <li>Your insights remain 100% anonymous</li>
        </ul>
        <p><strong>It&#39;s quick and impactful:</strong></p>
        <p>Your observations could provide the exact guidance a colleague needs to excel in their role.</p>
        <p>
            <a href="${url}" class="button" style="color: #fefefe!important;">Provide Feedback Now</a>
        </p>
        <p>
            If you&#39;ve already submitted your feedback, thank you! You can disregard this reminder.
        </p>
        <p>
            Thanks for being part of our feedback culture,<br/>
            The ${companyName} Team
        </p>
        <div class="footer">
            <hr />
          <p>${companyName} is powered by Candor</p>
          <p>You received this email because you are an employee of ${companyName} and subscribed to receive communications from Candor. If you did not expect this email, please contact your company&#39;s administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Email template function for invited users
function getInvitedUserEmailTemplate(name: string, url: string, companyName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { margin-bottom: 40px; }
        .header img { display: block; margin: 0 auto; width: 150px; height: 37px; }
        .header a.img {text-decoration: none;}
        h1 { font-size: 24px; margin-bottom: 20px; color: #457b9d; }
        p { margin-bottom: 20px; color: #333333; }
        a { text-decoration: none; }
        .button { display: inline-block; background-color: #457b9d; color: #fefefe!important; 
                 padding: 12px 24px; text-decoration: none; border-radius: 4px; }
        .footer { margin-top: 40px; font-size: 12px; color: #777777; text-align: center; }
        hr { border: 0; border-top: 1px solid #eeeeee; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
            <a href="${url}"><img src="https://sjxwcwtgahnbooyboeww.supabase.co/storage/v1/object/public/marketing/candor_cerulean.png" width="150" height="37" alt="Candor" /></a>
        </div>
        <h1>Join Candor: Your Team&#39;s New Feedback Platform!</h1>
        <p>
            Hi ${name}, <br/>Great news! ${companyName} is now using Candor to help us all grow through better feedback.
        </p>
        <p><strong>What is Candor?</strong></p>
        <p>Candor is a simple platform that makes collecting and receiving honest, anonymous feedback from your colleagues effortless. It integrates with tools you already use and provides insights that can help you develop professionally.</p>
        <p><strong>Why you&#39;ll love it:</strong></p>
        <ul>
            <li>Get a clearer picture of your strengths and growth areas</li>
            <li>Receive consistent feedback without the awkwardness</li>
            <li>Spend less time on formal reviews and more time on meaningful conversations</li>
        </ul>
        <p><strong>Getting started takes just 60 seconds:</strong></p>
        <ol>
            <li>Click the button below to create your account</li>
            <li>Set up your profile</li>
            <li>You&#39;re ready to give and receive valuable feedback</li>
        </ol>
        <p style="margin: 30px 0; text-align: center;">
            <a href="${url}" class="button" style="color: #fefefe!important;">Join Candor Now</a>
        </p>
        <p>
            If you have any questions, just reply to this email. We&#39;re excited to build a stronger feedback culture together!
        </p>
        <p>
            Welcome aboard,<br/>
            The ${companyName} Team
        </p>
        <div class="footer">
            <hr />
          <p>${companyName} is powered by Candor</p>
          <p>You received this email because you are an employee of ${companyName} and subscribed to receive communications from Candor. If you did not expect this email, please contact your company&#39;s administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}