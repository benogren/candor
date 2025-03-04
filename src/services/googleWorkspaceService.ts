// services/googleWorkspaceService.ts
import { ImportResult } from '@/app/types/orgChart.types';

export interface GoogleWorkspaceConfig {
  syncFrequency: 'manual' | 'daily' | 'weekly';
  syncUsers: boolean;
  syncStructure: boolean;
}

export const googleWorkspaceService = {
  getConnectionStatus: async (): Promise<{
    isConnected: boolean;
    lastSyncDate?: Date;
    config?: GoogleWorkspaceConfig;
  }> => {
    const response = await fetch('/api/integrations/google-workspace/status');
    
    if (!response.ok) {
      throw new Error('Failed to get Google Workspace connection status');
    }
    
    return response.json();
  },
  
  connect: async (): Promise<{ authUrl: string }> => {
    const response = await fetch('/api/integrations/google-workspace/connect', {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to initiate Google Workspace connection');
    }
    
    return response.json();
  },
  
  disconnect: async (): Promise<void> => {
    const response = await fetch('/api/integrations/google-workspace/disconnect', {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to disconnect Google Workspace');
    }
  },
  
  updateConfig: async (config: GoogleWorkspaceConfig): Promise<void> => {
    const response = await fetch('/api/integrations/google-workspace/config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update Google Workspace sync configuration');
    }
  },
  
  syncNow: async (): Promise<ImportResult> => {
    const response = await fetch('/api/integrations/google-workspace/sync', {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to sync with Google Workspace');
    }
    
    return response.json();
  },
};