// pages/api/integrations/google-workspace/connect.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { isAdmin } from '@/app/utils/auth';
import { GoogleAuthClient } from '../../../../lib/google-auth'; 

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check if user is admin
  const authorized = await isAdmin(req, res);
  if (!authorized) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    try {
      // Initialize Google Auth client
      const googleAuth = new GoogleAuthClient();
      
      // Generate an OAuth URL for Google Workspace Directory API
      const authUrl = googleAuth.generateAuthUrl({
        scope: [
          'https://www.googleapis.com/auth/admin.directory.user.readonly',
          'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
        ],
        access_type: 'offline',
        prompt: 'consent',
      });
      
      // Store a pending integration record
      await prisma.integrations.upsert({
        where: {
          type_unique: 'google_workspace',
        },
        update: {
          status: 'pending',
          updated_at: new Date(),
        },
        create: {
          type: 'google_workspace',
          status: 'pending',
          config: JSON.stringify({
            syncFrequency: 'manual',
            syncUsers: true,
            syncStructure: true,
          }),
        },
      });
      
      return res.status(200).json({ authUrl });
    } catch (error) {
      console.error('Error connecting to Google Workspace:', error);
      return res.status(500).json({ error: 'Failed to initiate Google Workspace connection' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}