// services/orgChartService.ts
import { OrgChartData, ManagerAssignment, User } from '@/app/types/orgChart.types';

export const orgChartService = {
  getOrgChart: async (): Promise<OrgChartData> => {
    const response = await fetch('/api/org-chart');
    if (!response.ok) {
      throw new Error('Failed to fetch organization chart');
    }
    return response.json();
  },

  assignManager: async (userId: string, managerId: string | null): Promise<void> => {
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
  },

  bulkUpdateManagers: async (assignments: ManagerAssignment[]): Promise<void> => {
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
  },

  inviteUser: async (userData: Partial<User>): Promise<User> => {
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

    return response.json();
  },
};
