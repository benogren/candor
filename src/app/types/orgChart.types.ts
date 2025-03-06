// src/app/types/orgChart.types.ts
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isInvited: boolean;
  isPending: boolean;
  managerId: string | null;
  avatarUrl?: string;
  jobTitle?: string;
}

export interface OrgChartNode {
  user: User;
  directReports: OrgChartNode[];
}

export interface OrgChartData {
  hierarchical: OrgChartNode[];
  unassigned: User[];
}

export interface ManagerAssignment {
  userId: string;
  managerId: string | null;
  isInvited: boolean;
}

export interface ImportResult {
  success: boolean;
  usersAdded: number;
  relationshipsCreated: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  email: string;
  errorType: 'INVALID_EMAIL' | 'USER_NOT_FOUND' | 'CIRCULAR_REFERENCE' | 'OTHER' | 'MISSING_EMAIL' | 'INVALID_MANAGER_EMAIL' | 'PARSE_ERROR' | 'API_ERROR' | 'IMPORT_ERROR';
  message: string;
}