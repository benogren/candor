// app/api/org-chart/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ImportError } from '@/app/types/orgChart.types';
import { getAllUserRelationships } from '@/app/utils/userRelationships';

interface CsvRow {
  email: string;
  managerEmail: string;
  name?: string;
  title?: string;
  role?: string;
}

interface ImportResult {
  usersAdded: number;
  relationshipsCreated: number;
  errors: ImportError[];
}

interface ManagerRelationship {
  company_id: string;
  relationship_type: 'direct' | 'dotted';
  member_id?: string | null;
  invited_member_id?: string | null;
  manager_id?: string | null;
  invited_manager_id?: string | null;
}

export async function POST(request: NextRequest) {
  console.log("Organization Chart Import API called");
  
  try {
    // Get auth token from header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing or invalid token' }, { status: 401 });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    
    // Get company ID for the current user
    const { data: userData, error: companyError } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('id', user.id)
      .single();
    
    if (companyError || !userData?.company_id) {
      return NextResponse.json({ 
        error: 'Failed to determine company ID for current user' 
      }, { status: 400 });
    }
    
    // Check if user is an admin
    if (userData.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Only company admins can import organization charts' 
      }, { status: 403 });
    }
    
    const companyId = userData.company_id;
    
    // Get the request data - from multipart form
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Parse CSV data from the file
    const csvText = await file.text();
    const rows = parseCSV(csvText);
    
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty or invalid' }, { status: 400 });
    }
    
    // console.log(`Parsed ${rows.length} rows from CSV`);
    // console.log("Parsed CSV", rows);
    
    // Validate CSV data
    const errors = validateCSV(rows);
    if (errors.length > 0) {
      return NextResponse.json({ 
        success: false, 
        errors 
      }, { status: 400 });
    }
    
    // Process the import
    const result = await processImport(rows, companyId, user.id, supabase);
    
    return NextResponse.json({
      success: true,
      usersAdded: result.usersAdded,
      relationshipsCreated: result.relationshipsCreated,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error importing organization chart:', error);
    return NextResponse.json({ 
      success: false,
      errors: [{ 
        row: 0, 
        email: '', 
        errorType: 'SERVER_ERROR',
        message: error instanceof Error ? error.message : 'An unknown error occurred' 
      }]
    }, { status: 500 });
  }
}

// Helper function to parse CSV
function parseCSV(csvText: string): CsvRow[] {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  const emailIndex = headers.indexOf('email');
  const managerEmailIndex = headers.indexOf('manageremail');
  const nameIndex = headers.indexOf('name');
  const titleIndex = headers.indexOf('title');
  const roleIndex = headers.indexOf('role');
  
  if (emailIndex === -1 || managerEmailIndex === -1) {
    throw new Error('CSV must contain email and managerEmail columns');
  }
  
  const rows: CsvRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // Skip empty lines
    
    const values = lines[i].split(',').map(v => v.trim());
    
    const row: CsvRow = {
      email: values[emailIndex],
      managerEmail: values[managerEmailIndex],
    };
    
    if (nameIndex !== -1 && nameIndex < values.length) {
      row.name = values[nameIndex];
    }
    
    if (roleIndex !== -1 && roleIndex < values.length) {
      row.role = values[roleIndex];
    }

    if (titleIndex !== -1 && titleIndex < values.length) {
      // console.log('Title:', values[titleIndex]);
      row.title = values[titleIndex];
    }
    
    rows.push(row);
  }
  
  return rows;
}

// Helper function to validate CSV
function validateCSV(rows: CsvRow[]): ImportError[] {
  const errors: ImportError[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  rows.forEach((row, index) => {
    if (!row.email || !emailRegex.test(row.email)) {
      errors.push({
        row: index + 1,
        email: row.email || '',
        errorType: 'INVALID_EMAIL',
        message: `Invalid email format: ${row.email}`,
      });
    }
    
    if (row.managerEmail && !emailRegex.test(row.managerEmail)) {
      errors.push({
        row: index + 1,
        email: row.email,
        errorType: 'INVALID_EMAIL',
        message: `Invalid manager email format: ${row.managerEmail}`,
      });
    }
  });
  
  // Check for circular references
  const emailToManagerMap = new Map<string, string>();
  rows.forEach((row) => {
    if (row.email && row.managerEmail) {
      emailToManagerMap.set(row.email.toLowerCase(), row.managerEmail.toLowerCase());
    }
  });
  
  emailToManagerMap.forEach((managerEmail, email) => {
    let currentEmail = email;
    const visited = new Set<string>();
    
    while (emailToManagerMap.has(currentEmail) && !visited.has(currentEmail)) {
      visited.add(currentEmail);
      currentEmail = emailToManagerMap.get(currentEmail) as string;
      
      if (currentEmail === email) {
        const rowIndex = rows.findIndex((r) => r.email.toLowerCase() === email);
        errors.push({
          row: rowIndex + 1,
          email: email,
          errorType: 'CIRCULAR_REFERENCE',
          message: `Circular reference detected: ${email} -> ${managerEmail}`,
        });
        break;
      }
    }
  });
  
  return errors;
}

// Helper function to process the import
async function processImport(
  rows: CsvRow[], 
  companyId: string, 
  userId: string, 
  supabase: SupabaseClient
): Promise<ImportResult> {
  // Store results
  const result: ImportResult = {
    usersAdded: 0,
    relationshipsCreated: 0,
    errors: [] as ImportError[],
  };
  
  // Maps to track email to ID relationships
  const emailToIdMap = new Map<string, { id: string, isInvited: boolean, isPending: boolean }>();
  
  console.log("Starting import process for", rows.length, "rows");
  
  // STEP 1: Build a map of all unique emails in the CSV
  const allEmails = new Set<string>();
  rows.forEach(row => {
    if (row.email) allEmails.add(row.email.toLowerCase());
    if (row.managerEmail) allEmails.add(row.managerEmail.toLowerCase());
  });
  
  console.log(`Found ${allEmails.size} unique email addresses in CSV`);
  
  // STEP 2: Get information about each email address
  for (const email of allEmails) {
    const userInfo = await getAllUserRelationships(email);
    
    if (userInfo.registeredId || userInfo.pendingId || userInfo.invitedId) {
      const id = userInfo.registeredId || userInfo.pendingId || userInfo.invitedId;
      if (id) {
        emailToIdMap.set(email, {
          id,
          isInvited: !!userInfo.invitedId && !userInfo.registeredId && !userInfo.pendingId,
          isPending: !!userInfo.pendingId && !userInfo.registeredId
        });
        // console.log(`Found existing user: ${email} -> ${id} (${
        //   userInfo.registeredId ? 'registered' : 
        //   (userInfo.pendingId ? 'pending' : 'invited')
        // })`);
      }
    }
  }
  
  // STEP 3: Create or update users in the CSV
  for (const row of rows) {
    const email = row.email.toLowerCase();
    const title = row.title || '';
    const name = row.name || email.split('@')[0];
    const role = row.role?.toLowerCase() || 'member';
    
    // Check if user already exists
    if (emailToIdMap.has(email)) {
      const userInfo = emailToIdMap.get(email);
      // console.log(`User ${email} already exists with ID ${userInfo?.id}, updating information`);
      
      // Update the user based on their status
      if (userInfo && userInfo.isInvited) {
        // Update invited user
        const { error: updateError } = await supabase
          .from('invited_users')
          .update({
            name: name,
            role: role,
            job_title: title
          })
          .eq('id', userInfo?.id);
          
        if (updateError) {
          console.error(`Error updating invited user ${email}:`, updateError);
          result.errors.push({
            row: rows.findIndex(r => r.email.toLowerCase() === email) + 1,
            email,
            errorType: 'OTHER',
            message: `Failed to update invited user ${email}: ${updateError.message}`
          });
        } else {
          // console.log(`Successfully updated invited user ${email}`);
        }
      } else {
        // For registered users, update their profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            name: name,
            job_title: title
          })
          .eq('id', userInfo?.id);
          
        if (profileError) {
          console.error(`Error updating user profile for ${email}:`, profileError);
          result.errors.push({
            row: rows.findIndex(r => r.email.toLowerCase() === email) + 1,
            email,
            errorType: 'OTHER',
            message: `Failed to update user profile for ${email}: ${profileError.message}`
          });
        } else {
          // console.log(`Successfully updated user profile for ${email}`);
        }
        
        // Also update their role in company_members if needed
        const { error: memberError } = await supabase
          .from('company_members')
          .update({
            role: role
          })
          .eq('id', userInfo?.id);
          
        if (memberError) {
          console.error(`Error updating role for ${email}:`, memberError);
        }
      }
      
      continue;
    }
    
    // Create new invite for users that don't exist
    try {
      const inviteId = crypto.randomUUID();
      const inviteCode = Math.random().toString(36).substring(2, 10);
      
      // console.log(`Creating new invite for ${email} with ID ${inviteId}`);
      
      const { error: insertError } = await supabase
        .from('invited_users')
        .insert({
          id: inviteId,
          email: email,
          name: name,
          role: role,
          job_title: title,
          company_id: companyId,
          invite_code: inviteCode,
          status: 'pending',
          created_by: userId
        });
      
      if (insertError) {
        console.error(`Error creating invite for ${email}:`, insertError);
        result.errors.push({
          row: rows.findIndex(r => r.email.toLowerCase() === email) + 1,
          email,
          errorType: 'OTHER',
          message: `Failed to create invite for ${email}: ${insertError.message}`
        });
      } else {
        emailToIdMap.set(email, { id: inviteId, isInvited: true, isPending: false });
        result.usersAdded++;
        // console.log(`Successfully created invite for ${email}`);
      }
    } catch (error) {
      console.error(`Unexpected error creating invite for ${email}:`, error);
      result.errors.push({
        row: rows.findIndex(r => r.email.toLowerCase() === email) + 1,
        email,
        errorType: 'OTHER',
        message: `Unexpected error creating invite for ${email}: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
  
  // STEP 4: Clear existing manager relationships
  console.log("Clearing existing manager relationships for the company");
  
  const { error: deleteError } = await supabase
    .from('manager_relationships')
    .delete()
    .eq('company_id', companyId);
    
  if (deleteError) {
    console.error("Error clearing existing relationships:", deleteError);
    result.errors.push({
      row: 0,
      email: '',
      errorType: 'OTHER',
      message: `Failed to clear existing relationships: ${deleteError.message}`
    });
  }
  
  // STEP 5: Create manager relationships
  console.log("Creating manager relationships");
  
  const relationshipsToCreate: ManagerRelationship[] = [];
  
  for (const row of rows) {
    const email = row.email.toLowerCase();
    const managerEmail = row.managerEmail ? row.managerEmail.toLowerCase() : null;
    
    if (!managerEmail || managerEmail === '') {
      // console.log(`No manager specified for ${email}`);
      continue;
    }
    
    // Get user info from our maps
    const member = emailToIdMap.get(email);
    if (!member) {
      // console.log(`Warning: Member email ${email} not found in system`);
      result.errors.push({
        row: rows.findIndex(r => r.email.toLowerCase() === email) + 1,
        email,
        errorType: 'USER_NOT_FOUND',
        message: `Member email ${email} not found in system`
      });
      continue;
    }
    
    const manager = emailToIdMap.get(managerEmail);
    if (!manager) {
      // console.log(`Warning: Manager email ${managerEmail} not found in system`);
      result.errors.push({
        row: rows.findIndex(r => r.email.toLowerCase() === email) + 1,
        email,
        errorType: 'USER_NOT_FOUND',
        message: `Manager email ${managerEmail} not found in system`
      });
      continue;
    }
    
    // Create the relationship object with the appropriate fields
    const relationship: ManagerRelationship = {
      company_id: companyId,
      relationship_type: 'direct'
    };
    
    // When setting relationships for pending users, treat them like registered users
    if (member.isPending || !member.isInvited) {
      relationship.member_id = member.id;
    } else {
      relationship.invited_member_id = member.id;
    }
    
    // Same logic for the manager
    if (manager.isPending || !manager.isInvited) {
      relationship.manager_id = manager.id;
    } else {
      relationship.invited_manager_id = manager.id;
    }
    
    // console.log(`Setting relationship: ${member.isPending ? 'pending' : (member.isInvited ? 'invited' : 'registered')} member ${email} to ${manager.isPending ? 'pending' : (manager.isInvited ? 'invited' : 'registered')} manager ${managerEmail}`);
    
    relationshipsToCreate.push(relationship);
  }
  
  // STEP 6: Batch insert all relationships
  if (relationshipsToCreate.length > 0) {
    // console.log(`Inserting ${relationshipsToCreate.length} manager relationships`);
    
    const { data: insertData, error: insertError } = await supabase
      .from('manager_relationships')
      .insert(relationshipsToCreate)
      .select();
    
    if (insertError) {
      console.error("Error creating manager relationships:", insertError);
      result.errors.push({
        row: 0,
        email: '',
        errorType: 'OTHER',
        message: `Failed to create manager relationships: ${insertError.message}`
      });
    } else {
      result.relationshipsCreated = insertData ? insertData.length : 0;
      // console.log(`Successfully created ${result.relationshipsCreated} manager relationships`);
    }
  }
  
  console.log("Import process complete:", result);
  return result;
}