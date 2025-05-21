// api/org-chart/parse-csv/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import { ImportError } from '@/app/types/orgChart.types';

// Define basic CSV row structure
interface CsvRow {
  email: string;
  managerEmail: string;
  name?: string;
  role?: string;
  title?: string;  // Added this field to match your CSV
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Get company ID for the current user
    const { data: userData, error: companyError } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('id', user.id)
      .single();
    
    if (companyError || !userData?.company_id) {
      return NextResponse.json({ error: 'User not associated with a company' }, { status: 400 });
    }
    
    const companyId = userData.company_id;
    console.log(`Processing CSV for company ID: ${companyId}`);
    
    // Parse multipart form data to get the CSV file
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Read and parse the CSV
    const csvText = await file.text();
    console.log(`CSV content sample: ${csvText.substring(0, 200)}...`);
    
    const parseResult = Papa.parse<CsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transform: (value) => value.trim()
    });
    
    if (parseResult.errors.length > 0) {
      const errors = parseResult.errors.map(err => ({
        row: (err.row ?? -1) + 1, // +1 for human-readable row numbers
        email: '',
        errorType: 'PARSE_ERROR',
        message: `${err.message} at row ${(err.row ?? -1) + 1}`
      }));
      
      return NextResponse.json({
        rows: [],
        errors
      });
    }
    
    // Basic validation of the parsed data
    const rows = parseResult.data;
    console.log(`Parsed ${rows.length} rows from CSV`);
    
    const errors: ImportError[] = [];
    
    // Make sure we have the required columns
    if (!rows.length || !('email' in rows[0]) || !('managerEmail' in rows[0])) {
      errors.push({
        row: 0,
        email: '',
        errorType: 'MISSING_COLUMNS',
        message: 'CSV must include "email" and "managerEmail" columns'
      });
      
      return NextResponse.json({
        rows: [],
        errors
      });
    }
    
    // Extract all email addresses from the CSV
    const emails = rows.map(row => row.email?.toLowerCase()).filter(Boolean);
    const managerEmails = rows.map(row => row.managerEmail?.toLowerCase()).filter(Boolean);
    
    // Combine all unique emails to check in a single query
    const allEmails = [...new Set([...emails, ...managerEmails])];
    console.log(`Found ${allEmails.length} unique email addresses in CSV`);
    
    if (allEmails.length === 0) {
      errors.push({
        row: 0,
        email: '',
        errorType: 'VALIDATION_ERROR',
        message: 'No valid email addresses found in CSV'
      });
      
      return NextResponse.json({
        rows: [],
        errors
      });
    }
    
    // Check for the specific user you're having issues with
    // if (allEmails.includes('ben+2@ogren.me')) {
    //   console.log('Found ben+2@ogren.me in the CSV');
    // }
    
    // Let's try a more direct approach - first, check all user profiles
    console.log(`Querying user_profiles for ${allEmails.length} emails`);
    const { data: userProfiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .filter('email', 'in', `(${allEmails.map(e => `"${e}"`).join(',')})`);
      
    if (profileError) {
      console.error('Error fetching user profiles:', profileError);
      errors.push({
        row: 0,
        email: '',
        errorType: 'DATABASE_ERROR',
        message: 'Failed to verify user profiles: ' + profileError.message
      });
    }
    
    // console.log(`Found ${userProfiles?.length || 0} matching user profiles`);
    if (userProfiles) {
      // Log all found user profiles for debugging
      userProfiles.forEach(profile => {
        console.log(`Profile: ID ${profile.id}, Email ${profile.email}`);
      });
    }
    
    // Let's directly query for deactivated users by email
    console.log('Querying for deactivated users directly');
    const { data: deactivatedUsers, error: deactivatedError } = await supabase
      .rpc('get_deactivated_users_by_emails', { 
        p_company_id: companyId,
        p_emails: allEmails
      });
    
    if (deactivatedError) {
      console.error('Error calling RPC function:', deactivatedError);
      
      // Fallback to direct query
      console.log('Falling back to direct query for deactivated users');
      
      // Try a direct join query
      const { data: directDeactivated, error: directError } = await supabase
        .from('company_members')
        .select(`
          id,
          status,
          userProfiles:user_profiles(email)
        `)
        .eq('company_id', companyId)
        .eq('status', 'deactivated');
      
      if (directError) {
        console.error('Error in direct query:', directError);
        errors.push({
          row: 0,
          email: '',
          errorType: 'DATABASE_ERROR',
          message: 'Failed to verify user status: ' + directError.message
        });
      } else if (directDeactivated && directDeactivated.length > 0) {
        console.log(`Found ${directDeactivated.length} deactivated users via direct query`);
        
        // Log all deactivated users for debugging
        directDeactivated.forEach(member => {
          console.log(`Deactivated member: ID ${member.id}, Status ${member.status}, Email ${member.userProfiles?.[0]?.email || 'unknown'}`);
        });
        
        // Create a set of deactivated emails
        const deactivatedEmails = new Set(
          directDeactivated
            .filter(member => member.userProfiles && member.userProfiles[0]?.email)
            .map(member => member.userProfiles[0].email.toLowerCase())
        );
        
        // Check each row in the CSV
        rows.forEach((row, index) => {
          if (row.email && deactivatedEmails.has(row.email.toLowerCase())) {
            console.log(`Found deactivated user in CSV: ${row.email}`);
            errors.push({
              row: index + 1,
              email: row.email,
              errorType: 'DEACTIVATED_USER',
              message: `User with email ${row.email} has been deactivated and cannot be included in the organization chart.`
            });
          }
          
          if (row.managerEmail && deactivatedEmails.has(row.managerEmail.toLowerCase())) {
            console.log(`Found deactivated manager in CSV: ${row.managerEmail}`);
            errors.push({
              row: index + 1,
              email: row.managerEmail,
              errorType: 'DEACTIVATED_MANAGER',
              message: `Manager with email ${row.managerEmail} has been deactivated and cannot be assigned as a manager.`
            });
          }
        });
      }
    } else if (deactivatedUsers && deactivatedUsers.length > 0) {
      console.log(`Found ${deactivatedUsers.length} deactivated users via RPC`);
      
      // Create a set of deactivated emails
      interface DeactivatedUser {
        email: string;
      }

      const deactivatedEmails = new Set(
        deactivatedUsers.map((user: DeactivatedUser) => user.email.toLowerCase())
      );
      
      // Check each row in the CSV
      rows.forEach((row, index) => {
        if (row.email && deactivatedEmails.has(row.email.toLowerCase())) {
          console.log(`Found deactivated user in CSV: ${row.email}`);
          errors.push({
            row: index + 1,
            email: row.email,
            errorType: 'DEACTIVATED_USER',
            message: `User with email ${row.email} has been deactivated and cannot be included in the organization chart.`
          });
        }
        
        if (row.managerEmail && deactivatedEmails.has(row.managerEmail.toLowerCase())) {
          console.log(`Found deactivated manager in CSV: ${row.managerEmail}`);
          errors.push({
            row: index + 1,
            email: row.managerEmail,
            errorType: 'DEACTIVATED_MANAGER',
            message: `Manager with email ${row.managerEmail} has been deactivated and cannot be assigned as a manager.`
          });
        }
      });
    } else {
      console.log('No deactivated users found');
    }
    
    // Perform additional validations as needed
    rows.forEach((row, index) => {
      // Validate email format
      if (!row.email || !isValidEmail(row.email)) {
        errors.push({
          row: index + 1,
          email: row.email || '',
          errorType: 'INVALID_EMAIL',
          message: `Invalid email format: ${row.email || 'empty'}`
        });
      }
      
      // Validate manager email format (if provided)
      if (row.managerEmail && !isValidEmail(row.managerEmail)) {
        errors.push({
          row: index + 1,
          email: row.managerEmail,
          errorType: 'INVALID_MANAGER_EMAIL',
          message: `Invalid manager email format: ${row.managerEmail}`
        });
      }
      
      // Check for self-referencing managers
      if (row.email && row.managerEmail && 
          row.email.toLowerCase() === row.managerEmail.toLowerCase()) {
        errors.push({
          row: index + 1,
          email: row.email,
          errorType: 'SELF_REFERENCE',
          message: `User cannot be their own manager: ${row.email}`
        });
      }
    });
    
    // Check for circular references in manager hierarchy
    const emailToManagerMap = new Map<string, string>();
    rows.forEach(row => {
      if (row.email && row.managerEmail) {
        emailToManagerMap.set(row.email.toLowerCase(), row.managerEmail.toLowerCase());
      }
    });
    
    emailToManagerMap.forEach((managerEmail, email) => {
      let currentEmail = email;
      const visited = new Set<string>();
      
      while (emailToManagerMap.has(currentEmail) && !visited.has(currentEmail)) {
        visited.add(currentEmail);
        currentEmail = emailToManagerMap.get(currentEmail)!;
        
        if (currentEmail === email) {
          const rowIndex = rows.findIndex(r => r.email.toLowerCase() === email);
          errors.push({
            row: rowIndex + 1,
            email: email,
            errorType: 'CIRCULAR_REFERENCE',
            message: `Circular reference detected: ${email} → ... → ${currentEmail}`
          });
          break;
        }
      }
    });
    
    console.log(`Returning ${rows.length} rows with ${errors.length} errors`);
    
    return NextResponse.json({
      rows,
      errors
    });
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return NextResponse.json(
      { error: 'Failed to parse CSV file' },
      { status: 500 }
    );
  }
}

// Helper function to validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}