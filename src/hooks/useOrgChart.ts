import { useState, useEffect, useCallback } from 'react';
import { OrgChartData, ManagerAssignment, User, OrgChartNode } from '@/app/types/orgChart.types';
import { orgChartService } from '../services/orgChartService';

export function useOrgChart() {
  const [orgChartData, setOrgChartData] = useState<OrgChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrgChart = useCallback(async () => {
    try {
      setLoading(true);
      const data = await orgChartService.getOrgChart();
      setOrgChartData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgChart();
  }, [fetchOrgChart]);

  const assignManager = useCallback(async (userId: string, managerId: string | null) => {
    try {
      await orgChartService.assignManager(userId, managerId);
      await fetchOrgChart();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to assign manager'));
      return false;
    }
  }, [fetchOrgChart]);

  const bulkUpdateManagers = useCallback(async (assignments: ManagerAssignment[]) => {
    try {
      await orgChartService.bulkUpdateManagers(assignments);
      await fetchOrgChart();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to bulk update managers'));
      return false;
    }
  }, [fetchOrgChart]);

  const inviteUser = useCallback(async (userData: Partial<User>) => {
    try {
      const newUser = await orgChartService.inviteUser(userData);
      await fetchOrgChart();
      return newUser;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to invite user'));
      return null;
    }
  }, [fetchOrgChart]);

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

  return {
    orgChartData,
    loading,
    error,
    fetchOrgChart,
    assignManager,
    bulkUpdateManagers,
    inviteUser,
    getAllUsers,
    getManagers,
  };
}