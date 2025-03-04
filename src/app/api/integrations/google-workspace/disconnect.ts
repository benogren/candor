// pages/api/integrations/google-workspace/disconnect.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { isAdmin } from'@/app/utils/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check if user is admin
  const authorized = await isAdmin(req);
  if (!authorized) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    try {
      // Update integration status to disconnected
      await prisma.integrations.update({
        where: {
          id: 1, // replace with the correct numeric ID for 'google_workspace'
        },
        data: {
          status: 'disconnected',
          updated_at: new Date(),
          access_token: null,
          refresh_token: null,
          token_expiry: null,
        },
      });
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error disconnecting from Google Workspace:', error);
      return res.status(500).json({ error: 'Failed to disconnect from Google Workspace' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}