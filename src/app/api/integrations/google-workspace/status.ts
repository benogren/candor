// pages/api/integrations/google-workspace/status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { isAdmin } from '@/app/utils/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check if user is admin
  const authorized = await isAdmin(req);
  if (!authorized) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      // Fetch integration status from the database
      const integration = await prisma.integrations.findFirst({
        where: {
          type: 'google_workspace',
        },
      });

      if (!integration) {
        return res.status(200).json({
          isConnected: false,
        });
      }

      return res.status(200).json({
        isConnected: integration.status === 'connected',
        lastSyncDate: integration.last_sync_date,
        config: integration.config ? JSON.parse(integration.config) : undefined,
      });
    } catch (error) {
      console.error('Error fetching Google Workspace status:', error);
      return res.status(500).json({ error: 'Failed to fetch integration status' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}