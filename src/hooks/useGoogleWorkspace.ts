// hooks/useGoogleWorkspace.ts
import { useState, useEffect, useCallback } from 'react';
import { ImportResult } from '@/app/types/orgChart.types';
import { googleWorkspaceService, GoogleWorkspaceConfig } from '../services/googleWorkspaceService';

export function useGoogleWorkspace() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncDate, setLastSyncDate] = useState<Date | undefined>(undefined);
  const [config, setConfig] = useState<GoogleWorkspaceConfig | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<ImportResult | null>(null);

  const fetchConnectionStatus = useCallback(async () => {
    try {
      setLoading(true);
      const status = await googleWorkspaceService.getConnectionStatus();
      setIsConnected(status.isConnected);
      
      if (status.lastSyncDate) {
        setLastSyncDate(new Date(status.lastSyncDate));
      }
      
      if (status.config) {
        setConfig(status.config);
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectionStatus();
  }, [fetchConnectionStatus]);

  const connect = useCallback(async () => {
    try {
      const { authUrl } = await googleWorkspaceService.connect();
      // Open the authorization URL in a new window/tab
      window.open(authUrl, '_blank');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to connect to Google Workspace'));
      return false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await googleWorkspaceService.disconnect();
      setIsConnected(false);
      setLastSyncDate(undefined);
      setConfig(undefined);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to disconnect from Google Workspace'));
      return false;
    }
  }, []);

  const updateConfig = useCallback(async (newConfig: GoogleWorkspaceConfig) => {
    try {
      await googleWorkspaceService.updateConfig(newConfig);
      setConfig(newConfig);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update sync configuration'));
      return false;
    }
  }, []);

  const syncNow = useCallback(async () => {
    try {
      setIsSyncing(true);
      setSyncResult(null);
      const result = await googleWorkspaceService.syncNow();
      setSyncResult(result);
      
      // Update last sync date
      if (result.success) {
        setLastSyncDate(new Date());
      }
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sync with Google Workspace'));
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    isConnected,
    lastSyncDate,
    config,
    loading,
    error,
    isSyncing,
    syncResult,
    fetchConnectionStatus,
    connect,
    disconnect,
    updateConfig,
    syncNow,
  };
}