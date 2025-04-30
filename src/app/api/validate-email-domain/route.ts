import { NextResponse } from 'next/server';
import dns from 'dns';
import util from 'util';

// Convert dns.resolveMx to a Promise-based function
const resolveMx = util.promisify(dns.resolveMx);

export async function POST(request: Request) {
  try {
    const { domain } = await request.json();

    console.log('Checking Form > domain provided:', domain);
    
    if (!domain || typeof domain !== 'string') {

      return NextResponse.json(
        { valid: false, error: 'Invalid domain parameter' },
        { status: 400 }
      );
    }

    try {
      // Try to resolve MX records for the domain
      const mxRecords = await resolveMx(domain);
      
      console.log('Valid domain:', domain);
      // If we got here, MX records exist
      return NextResponse.json({ 
        valid: true, 
        hasMx: mxRecords && mxRecords.length > 0 
      });
    } catch (dnsError) {
        console.log('Invalid domain:', domain);
      // Domain doesn't exist or has no MX records
      return NextResponse.json({ 
        valid: false, 
        error: 'Domain has no valid mail servers',
        details: (dnsError as Error).message
      });
    }
  } catch (error) {
    console.error('Error validating domain:', error);
    return NextResponse.json(
      { valid: false, error: 'Domain validation failed' },
      { status: 500 }
    );
  }
}