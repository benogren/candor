'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { User, ManagerAssignment, OrgChartData, ImportResult, ImportError, OrgChartNode } from '@/app/types/orgChart.types';
import OrgChartView from '@/components/orgchart/OrgChartView';
import UserAssignmentModal from '@/components/orgchart/UserAssignmentModal';
import BulkAssignmentModal from '@/components/orgchart/BulkAssignmentModal';
import CreateUserModal from '@/components/orgchart/CreateUserModal';
import ImportOrgChartModal from '@/components/orgchart/ImportOrgChartModal';
import SyncIntegrationPanel from '@/components/orgchart/SyncIntegrationPanel';
import supabase from '@/lib/supabase/client';

interface CsvRow {
  email: string;
  managerEmail: string;
  name?: string;
  role?: string;
}

export default function OrgChartContainer() {
  // State for org chart data
  const [orgChartData, setOrgChartData] = useState<OrgChartData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // State for Google Workspace integration
  const [isGoogleWorkspaceConnected, setIsGoogleWorkspaceConnected] = useState<boolean>(false);
  const [lastSyncDate, setLastSyncDate] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Selected users state
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Modal visibility states
  const [isUserAssignmentModalOpen, setIsUserAssignmentModalOpen] = useState<boolean>(false);
  const [isBulkAssignmentModalOpen, setIsBulkAssignmentModalOpen] = useState<boolean>(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState<boolean>(false);
  const [isCreateManagerModalOpen, setIsCreateManagerModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  // CSV import state
  const [parsedData, setParsedData] = useState<CsvRow[]>([]);
  const [previewData, setPreviewData] = useState<CsvRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ImportError[]>([]);
  const [importing, setImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Fetch org chart data
  const fetchOrgChart = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/org-chart');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch organization chart: ${response.statusText}`);
      }
      
      const data = await response.json() as OrgChartData;
      setOrgChartData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch org chart data on component mount
  useEffect(() => {
    fetchOrgChart();
  }, [fetchOrgChart]);

  // Assign manager to user
  const assignManager = useCallback(async (userId: string, managerId: string | null): Promise<boolean> => {
    try {
      const response = await fetch('/api/org-chart/assign-manager', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, managerId }),
      });

      if (!response.ok) {
        throw new Error('Failed to assign manager');
      }

      await fetchOrgChart();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to assign manager'));
      return false;
    }
  }, [fetchOrgChart]);

  // Bulk update managers
  const bulkUpdateManagers = useCallback(async (assignments: ManagerAssignment[]): Promise<boolean> => {
    try {
      const response = await fetch('/api/org-chart/bulk-update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignments }),
      });

      if (!response.ok) {
        throw new Error('Failed to bulk update managers');
      }

      await fetchOrgChart();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to bulk update managers'));
      return false;
    }
  }, [fetchOrgChart]);

  // Invite new user
  const inviteUser = useCallback(async (userData: Partial<User>): Promise<User | null> => {
    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        throw new Error('Failed to invite user');
      }

      const newUser = await response.json() as User;
      await fetchOrgChart();
      return newUser;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to invite user'));
      return null;
    }
  }, [fetchOrgChart]);

  // Get all users from org chart data
  const getAllUsers = useCallback((): User[] => {
    if (!orgChartData) return [];

    const allUsers: User[] = [...orgChartData.unassigned];
    
    const addUsersFromNode = (node: OrgChartNode) => {
      allUsers.push(node.user);
      node.directReports.forEach(addUsersFromNode);
    };
    
    orgChartData.hierarchical.forEach(addUsersFromNode);
    
    return allUsers;
  }, [orgChartData]);

  // Get all managers from org chart data
  const getManagers = useCallback((): User[] => {
    if (!orgChartData) return [];
    
    const managers: User[] = [];
    
    const addManagersFromNode = (node: OrgChartNode) => {
      managers.push(node.user);
      node.directReports.forEach(addManagersFromNode);
    };
    
    orgChartData.hierarchical.forEach(addManagersFromNode);
    
    return managers;
  }, [orgChartData]);

  // Handle user selection
  const handleSelectUser = useCallback((user: User) => {
    setSelectedUser(user);
    setIsUserAssignmentModalOpen(true);
  }, []);

  // Handle manager selection
  const handleSelectManager = useCallback((manager: User) => {
    setSelectedUser(manager);
    setIsUserAssignmentModalOpen(true);
  }, []);

  // Handle bulk user selection toggle
  const handleToggleUserSelection = useCallback((user: User) => {
    setSelectedUsers((prev) => {
      const isSelected = prev.some((u) => u.id === user.id);
      if (isSelected) {
        return prev.filter((u) => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  }, []);

  // Parse CSV file for preview
  const parseFile = useCallback(async (file: File): Promise<boolean> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/org-chart/parse-csv', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to parse CSV');
      }
      
      const result = await response.json() as { data: CsvRow[], errors: ImportError[] };
      setParsedData(result.data);
      setPreviewData(result.data.slice(0, 5));
      setValidationErrors(result.errors);
      
      return true;
    } catch (error) {
      console.error('Error parsing CSV:', error);
      return false;
    }
  }, []);

  // Import org chart from CSV
  const importOrgChart = useCallback(async (file: File): Promise<ImportResult | null> => {
    try {
      setImporting(true);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/org-chart/import', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to import organization chart');
      }
      
      const result = await response.json() as ImportResult;
      setImportResult(result);
      
      if (result.success) {
        await fetchOrgChart();
      }
      
      return result;
    } catch (error) {
      console.error('Error importing org chart:', error);
      return null;
    } finally {
      setImporting(false);
    }
  }, [fetchOrgChart]);

  // Handle Google Workspace sync
  const handleGoogleWorkspaceSync = useCallback(async (): Promise<void> => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/integrations/google-workspace/sync', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to sync with Google Workspace');
      }
      
      await fetchOrgChart();
      setLastSyncDate(new Date());
    } catch (error) {
      console.error('Error syncing with Google Workspace:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchOrgChart]);

  // Handle Google Workspace connection
  const handleConnectGoogleWorkspace = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/integrations/google-workspace/connect', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to connect to Google Workspace');
      }
      
      const data = await response.json() as { authUrl: string };
      
      // Open Google auth window
      if (data.authUrl) {
        window.open(data.authUrl, '_blank');
      }
    } catch (error) {
      console.error('Error connecting to Google Workspace:', error);
    }
  }, []);

  // Render loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <p className="text-red-700">Error loading organization chart: {error.message}</p>
        <button
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          onClick={() => fetchOrgChart()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Action bar */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Organization Chart</h1>
        <div className="flex space-x-3">
          <button
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center"
            onClick={() => setIsImportModalOpen(true)}
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Import
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            onClick={() => setIsCreateUserModalOpen(true)}
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add User
          </button>
        </div>
      </div>

      {/* Google Workspace Integration Panel */}
      <SyncIntegrationPanel
        isConnected={isGoogleWorkspaceConnected}
        lastSyncDate={lastSyncDate}
        onSync={handleGoogleWorkspaceSync}
        onConnect={handleConnectGoogleWorkspace}
        isSyncing={isSyncing}
      />

      {/* Bulk Actions (visible when users are selected) */}
      {selectedUsers.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-md mb-6 flex items-center justify-between">
          <div>
            <p className="text-blue-700">
              {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              onClick={() => setSelectedUsers([])}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={() => setIsBulkAssignmentModalOpen(true)}
            >
              Assign Manager
            </button>
          </div>
        </div>
      )}

      {/* Organization Chart View */}
      {orgChartData && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 overflow-auto">
          <OrgChartView
            data={orgChartData.hierarchical}
            onSelectUser={handleSelectUser}
            onSelectManager={handleSelectManager}
          />

          {/* Unassigned Users */}
          {orgChartData.unassigned.length > 0 && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-lg font-medium mb-4">Unassigned Users</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orgChartData.unassigned.map((user) => (
                  <div
                    key={user.id}
                    className="bg-white border border-gray-300 rounded-md p-3 shadow-sm cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSelectUser(user)}
                  >
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    <div className="text-xs text-gray-400">{user.role}</div>
                    {user.isInvited && (
                      <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded mt-1">
                        Invited
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Assignment Modal */}
      {isUserAssignmentModalOpen && selectedUser && (
        <UserAssignmentModal
          user={selectedUser}
          managers={getManagers()}
          onAssign={assignManager}
          onCreateManager={() => {
            setIsUserAssignmentModalOpen(false);
            setIsCreateManagerModalOpen(true);
          }}
          onClose={() => {
            setIsUserAssignmentModalOpen(false);
            setSelectedUser(null);
          }}
        />
      )}

      {/* Bulk Assignment Modal */}
      {isBulkAssignmentModalOpen && (
        <BulkAssignmentModal
          selectedUsers={selectedUsers}
          managers={getManagers().filter(
            (manager) => !selectedUsers.some((u) => u.id === manager.id)
          )}
          onBulkAssign={bulkUpdateManagers}
          onClose={() => {
            setIsBulkAssignmentModalOpen(false);
          }}
        />
      )}

      {/* Create User Modal */}
      {isCreateUserModalOpen && (
        <CreateUserModal
          managers={getManagers()}
          onCreateUser={inviteUser}
          onClose={() => {
            setIsCreateUserModalOpen(false);
          }}
        />
      )}

      {/* Create Manager Modal */}
      {isCreateManagerModalOpen && selectedUser && (
        <CreateUserModal
          managers={getManagers()}
          onCreateUser={inviteUser}
          isForManager={true}
          assignToManager={selectedUser}
          onClose={() => {
            setIsCreateManagerModalOpen(false);
          }}
        />
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <ImportOrgChartModal
          onImport={importOrgChart}
          onPreview={parseFile}
          previewData={previewData}
          validationErrors={validationErrors}
          importing={importing}
          onClose={() => {
            setIsImportModalOpen(false);
            fetchOrgChart(); // Refresh data after import
          }}
        />
      )}
    </div>
  );
}