// components/orgchart/SyncIntegrationPanel.tsx
import React from 'react';

interface SyncIntegrationPanelProps {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncDate: Date | null;
  onSync: () => Promise<void>;
  onConnect: () => Promise<void>;
}

const SyncIntegrationPanel: React.FC<SyncIntegrationPanelProps> = ({
  isConnected,
  isSyncing,
  lastSyncDate,
  onSync,
  onConnect,
}) => {
  const formatDate = (date: Date | null): string => {
    if (!date) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium">Google Workspace Integration</h3>
      </div>

      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">
              {isConnected
                ? 'Your organization chart is synced with Google Workspace.'
                : 'Connect with Google Workspace to automatically sync your organization structure.'}
            </p>
            {isConnected && lastSyncDate && (
              <p className="text-xs text-gray-500 mt-1">
                Last synced: {formatDate(lastSyncDate)}
              </p>
            )}
          </div>

          {isConnected ? (
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              onClick={onSync}
              disabled={isSyncing}
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          ) : (
            <button 
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              onClick={onConnect}
            >
              Connect
            </button>
          )}
        </div>

        {isConnected && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sync Frequency
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="manual">Manual</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sync Users
              </label>
              <div className="flex items-center mt-2">
                <input
                  type="checkbox"
                  id="sync-users"
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  defaultChecked
                />
                <label htmlFor="sync-users" className="ml-2 text-sm text-gray-700">
                  Import new users
                </label>
              </div>
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sync Structure
              </label>
              <div className="flex items-center mt-2">
                <input
                  type="checkbox"
                  id="sync-structure"
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  defaultChecked
                />
                <label htmlFor="sync-structure" className="ml-2 text-sm text-gray-700">
                  Update reporting structure
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncIntegrationPanel;