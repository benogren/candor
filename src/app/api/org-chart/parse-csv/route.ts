// app/api/org-chart/parse-csv/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ImportError } from '@/app/types/orgChart.types';

interface CsvRow {
  email: string;
  managerEmail: string;
  name?: string;
  title?: string;
  role?: string;
}

export async function POST(request: NextRequest) {
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
    
    // Get the request data - from multipart form
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Parse CSV data from the file
    const csvText = await file.text();
    const rows = parseCSV(csvText);

    // console.log(`Parsed CSV`, rows);
    
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty or invalid' }, { status: 400 });
    }
    
    // Validate CSV data
    const errors = validateCSV(rows);
    
    return NextResponse.json({
      rows,
      errors
    });
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
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
    
    // Add title extraction
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