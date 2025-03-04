// lib/google-auth.ts
import { OAuth2Client } from 'google-auth-library';

// Load environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/integrations/google-workspace/callback';

export class GoogleAuthClient extends OAuth2Client {
  constructor() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.warn('Google OAuth credentials not configured');
    }
    
    super(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );
  }
  
  /**
   * Generate an authentication URL for the user to authorize our application
   */
  generateAuthUrl(options: {
    scope: string[];
    access_type: 'online' | 'offline';
    prompt?: string;
  }): string {
    return this.generateAuthUrl({
      access_type: options.access_type,
      scope: options.scope,
      prompt: options.prompt,
    });
  }
  
  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code: string) {
    const { tokens } = await this.getToken(code);
    return tokens;
  }
  
  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<any> {
    this.setCredentials({
      refresh_token: refreshToken,
    });
    
    const { token } = await this.getAccessToken();
    return token;
  }
}