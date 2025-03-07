'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { User, OrgChartData, ImportResult, ImportError, OrgChartNode } from '@/app/types/orgChart.types';
import OrgChartView from '@/components/orgchart/OrgChartView';
import UserAssignmentModal from '@/components/orgchart/UserAssignmentModal';
import BulkAssignmentModal from '@/components/orgchart/BulkAssignmentModal';
import CreateUserModal from '@/components/orgchart/CreateUserModal';
import ImportOrgChartModal from '@/components/orgchart/ImportOrgChartModal';
// import SyncIntegrationPanel from '@/components/orgchart/SyncIntegrationPanel';
import supabase from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { faCloudArrowUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LoadingSpinner } from '@/components/loading-spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface CsvRow {
  email: string;
  managerEmail: string;
  name?: string;
  role?: string;
  title?: string;
}

export default function OrgChartContainer() {
  // State for org chart data
  const [orgChartData, setOrgChartData] = useState<OrgChartData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // State for Google Workspace integration
  // const [isGoogleWorkspaceConnected, setIsGoogleWorkspaceConnected] = useState<boolean>(false);
  // const [lastSyncDate, setLastSyncDate] = useState<Date | null>(null);
  // const [isSyncing, setIsSyncing] = useState<boolean>(false);

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
  const [previewData, setPreviewData] = useState<CsvRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ImportError[]>([]);
  const [importing, setImporting] = useState<boolean>(false);
  const [justCompletedImport, setJustCompletedImport] = useState<boolean>(false);

  // Fetch org chart data
  const fetchOrgChart = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch('/api/org-chart', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
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

  // Handle import completion
  useEffect(() => {
    if (justCompletedImport) {
      // Close the modal and reset import-related states
      setIsImportModalOpen(false);
      setPreviewData([]);
      setValidationErrors([]);
      setJustCompletedImport(false); // Reset the flag
    }
  }, [justCompletedImport]);

  // Assign manager to user
  const assignManager = useCallback(async (userId: string, managerId: string | null): Promise<boolean> => {
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch('/api/org-chart/assign-manager', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
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
  const bulkUpdateManagers = useCallback(async (assignments: {userId: string, managerId: string | null}[]): Promise<boolean> => {
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch('/api/org-chart/bulk-update', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
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
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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

  // Parse CSV file for preview
  const parseFile = useCallback(async (file: File): Promise<boolean> => {
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/org-chart/parse-csv', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error parsing CSV:', errorData);
        setValidationErrors([{
          row: 0,
          email: '',
          errorType: 'PARSE_ERROR',
          message: errorData.error || 'Failed to parse CSV'
        }]);
        return false;
      }
      
      const data = await response.json();
      
      if (!data.rows || !Array.isArray(data.rows)) {
        console.error('API response missing rows array:', data);
        setValidationErrors([{
          row: 0,
          email: '',
          errorType: 'API_ERROR',
          message: 'API response format error - missing rows'
        }]);
        return false;
      }
      
      setPreviewData(data.rows.slice(0, 5)); // Show first 5 rows as preview
      setValidationErrors(data.errors || []);
      
      return data.errors?.length === 0;
    } catch (error) {
      console.error('Error previewing CSV:', error);
      setValidationErrors([{
        row: 0,
        email: '',
        errorType: 'PARSE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to parse CSV'
      }]);
      return false;
    }
  }, []);

  // Import org chart from CSV
  const importOrgChart = useCallback(async (file: File): Promise<ImportResult | null> => {
    try {
      setImporting(true);
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      console.log("Sending import request with file:", file.name, file.size);
      
      const response = await fetch('/api/org-chart/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Import failed: ${errorText}`);
      }
      
      const result = await response.json();
      console.log("Import API Response:", result);
      
      if (result.success) {
        // Set the flag that we just completed an import
        await fetchOrgChart();
        setJustCompletedImport(true);
      }
      
      return result;
    } catch (error) {
      console.error('Error importing org chart:', error);
      return {
        success: false,
        errors: [{
          row: 0,
          email: '',
          errorType: 'IMPORT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to import organization chart'
        }],
        usersAdded: 0,
        relationshipsCreated: 0
      };
    } finally {
      setImporting(false);
    }
  }, [fetchOrgChart]);

  // Render loading state
  if (loading) {
    return (
      <>
      <LoadingSpinner />
      </>
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
        <h2 className='text-4xl font-light text-berkeleyblue'>Organization Chart</h2>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
            <FontAwesomeIcon 
                icon={faCloudArrowUp}
                height={18}
                width={18}
                className=""
            />
            Import
          </Button>
          {/* <button
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
          </button> */}
        </div>
      </div>

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
          <div className="mt-8 border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium mb-4 text-berkeleyblue">Unassigned Users</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orgChartData.unassigned.map((user) => (
                <div
                  key={user.id}
                  className="bg-white border border-gray-200 rounded-md p-4 shadow-sm cursor-pointer hover:bg-gray-50 flex items-center"
                  onClick={() => handleSelectUser(user)}
                >
                  <Avatar className="h-12 w-12 mr-4 border border-gray-100">
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                    ) : null}
                    <AvatarFallback className="bg-cerulean text-white font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="overflow-hidden">
                    <h3 className="text-berkeleyblue font-medium truncate">{user.name}</h3>
                    <p className="text-slate-500 text-sm truncate">{user.jobTitle || user.role || ''}</p>
                    
                    <div className="flex flex-wrap mt-1 gap-1">
                      {user.role === 'admin' && (
                        <span className="inline-block bg-nonphotoblue/20 text-nonphotoblue-900 text-xs px-2 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                      {user.isPending && (
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                          Pending
                        </span>
                      )}
                      {user.isInvited && (
                        <span className="inline-block bg-honeydew text-honeydew-900 text-xs px-2 py-0.5 rounded">
                          Invited
                        </span>
                      )}
                    </div>
                  </div>
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
      {isImportModalOpen && !justCompletedImport && (
        <ImportOrgChartModal
          onImport={importOrgChart}
          onPreview={parseFile}
          previewData={previewData}
          validationErrors={validationErrors}
          importing={importing}
          onClose={() => {
            // Only close the modal if we're not in the middle of importing
            if (!importing) {
              setIsImportModalOpen(false);
              setPreviewData([]);
              setValidationErrors([]);
            }
          }}
        />
      )}
    </div>
  );
}