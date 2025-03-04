// pages/api/integrations/google-workspace/sync.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { isAdmin } from '@/app/utils/auth';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { ImportResult, ImportError } from '@/app/types/orgChart.types';

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
      // Get integration record
      const integration = await prisma.integrations.findUnique({
        where: {
          type: 'google_workspace',
        },
      });
      
      if (!integration || integration.status !== 'connected' || !integration.refresh_token) {
        return res.status(400).json({ error: 'Google Workspace not connected' });
      }
      
      // Parse config
      const config = integration.config ? JSON.parse(integration.config) : {
        syncUsers: true,
        syncStructure: true,
      };
      
      // Initialize Google Auth client
      const googleAuth = new OAuth2Client({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      });
      
      // Set credentials
      googleAuth.setCredentials({
        refresh_token: integration.refresh_token,
        access_token: integration.access_token,
        expiry_date: integration.token_expiry?.getTime() || 0,
      });
      
      // Create admin directory client
      const adminDirectory = google.admin({
        version: 'directory_v1',
        auth: googleAuth,
      });
      
      // Result object
      const result: ImportResult = {
        success: true,
        usersAdded: 0,
        relationshipsCreated: 0,
        errors: [],
      };
      
      const errors: ImportError[] = [];
      
      // Map to store Google user ID to our user ID mapping
      const userIdMap = new Map<string, string>();
      const managerMap = new Map<string, string>(); // Google User ID to manager's Google User ID
      
      // Get company domain from admin email
      let domain = '';
      try {
        const adminUser = await adminDirectory.users.get({
          userKey: 'admin',
        });
        
        if (adminUser.data.primaryEmail) {
          domain = adminUser.data.primaryEmail.split('@')[1];
        }
      } catch (error) {
        console.error('Error getting admin user:', error);
        return res.status(500).json({ error: 'Failed to get company domain' });
      }
      
      if (!domain) {
        return res.status(500).json({ error: 'Failed to determine company domain' });
      }
      
      // Fetch all users from Google Workspace
      if (config.syncUsers) {
        try {
          let pageToken: string | undefined;
          
          do {
            const response = await adminDirectory.users.list({
              domain,
              pageToken: pageToken || undefined,
              maxResults: 100,
            });
            
            const users = response.data.users || [];
            
            // Process each user
            for (const user of users) {
              if (!user.primaryEmail || user.suspended) continue;
              
              try {
                // Check if user already exists in our system
                const existingUser = await prisma.company_members.findUnique({
                  where: { email: user.primaryEmail },
                  select: { id: true },
                });
                
                if (existingUser) {
                  // User exists, store mapping
                  userIdMap.set(user.id!, existingUser.id);
                } else {
                  // Create new user
                  const newUser = await prisma.company_members.create({
                    data: {
                      email: user.primaryEmail,
                      name: user.name?.fullName || user.primaryEmail.split('@')[0],
                      is_invited: true,
                      google_id: user.id,
                    },
                  });
                  
                  userIdMap.set(user.id!, newUser.id);
                  result.usersAdded++;
                }
                
                // Store manager relationship if present
                if (user.relations && Array.isArray(user.relations)) {
                  const managerRelation = user.relations.find(
                    (relation) => relation.type === 'manager'
                  );
                  
                  if (managerRelation && managerRelation.value) {
                    managerMap.set(user.id!, managerRelation.value);
                  }
                }
              } catch (error) {
                console.error(`Error processing user ${user.primaryEmail}:`, error);
                errors.push({
                  row: 0,
                  email: user.primaryEmail,
                  errorType: 'OTHER',
                  message: `Failed to process user: ${(error as Error).message}`,
                });
              }
            }
            
            pageToken = response.data.nextPageToken ?? undefined;
          } while (pageToken);
        } catch (error) {
          console.error('Error fetching users from Google Workspace:', error);
          return res.status(500).json({
            error: 'Failed to fetch users from Google Workspace',
            details: (error as Error).message,
          });
        }
      }
      
      // Create manager relationships if sync structure is enabled
      if (config.syncStructure && managerMap.size > 0) {
        for (const [userId, managerId] of managerMap.entries()) {
          const ourUserId = userIdMap.get(userId);
          const ourManagerId = userIdMap.get(managerId);
          
          if (ourUserId && ourManagerId) {
            try {
              // Update the user's manager
              await prisma.company_members.update({
                where: { id: ourUserId },
                data: { manager_id: ourManagerId },
              });
              
              result.relationshipsCreated++;
            } catch (error) {
              console.error(`Error setting manager for user ${userId}:`, error);
              // Add to errors but continue processing
              const user = await prisma.company_members.findUnique({
                where: { id: ourUserId },
                select: { email: true },
              });
              
              if (user) {
                errors.push({
                  row: 0,
                  email: user.email,
                  errorType: 'OTHER',
                  message: `Failed to set manager relationship: ${(error as Error).message}`,
                });
              }
            }
          }
        }
      }
      
      // Update last sync date
      await prisma.integrations.update({
        where: {
          type: 'google_workspace',
        },
        data: {
          last_sync_date: new Date(),
        },
      });
      
      // Add errors to result
      result.errors = errors;
      result.success = errors.length === 0;
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error syncing with Google Workspace:', error);
      return res.status(500).json({ error: 'Failed to sync with Google Workspace' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}