// pages/api/integrations/google-workspace/config.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma'; 
import { isAdmin } from '@/app/utils/auth';
import { GoogleWorkspaceConfig } from '../../../../services/googleWorkspaceService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check if user is admin
  const authorized = await isAdmin(req, res);
  if (!authorized) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (req.method === 'PATCH') {
    try {
      const config = req.body as GoogleWorkspaceConfig;
      
      // Validate config
      if (!config || typeof config !== 'object') {
        return res.status(400).json({ error: 'Invalid configuration' });
      }
      
      const { syncFrequency, syncUsers, syncStructure } = config;
      
      if (!['manual', 'daily', 'weekly'].includes(syncFrequency)) {
        return res.status(400).json({ error: 'Invalid sync frequency' });
      }
      
      if (typeof syncUsers !== 'boolean' || typeof syncStructure !== 'boolean') {
        return res.status(400).json({ error: 'Invalid sync options' });
      }
      
      // Update integration config
      await prisma.integrations.update({
        where: {
          type_unique: 'google_workspace',
        },
        data: {
          config: JSON.stringify(config),
          updated_at: new Date(),
        },
      });
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating Google Workspace config:', error);
      return res.status(500).json({ error: 'Failed to update integration configuration' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}