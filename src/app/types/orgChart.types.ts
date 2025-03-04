// types/orgChart.types.ts
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isInvited: boolean;
  managerId: string | null;
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
  errorType: 'INVALID_EMAIL' | 'USER_NOT_FOUND' | 'CIRCULAR_REFERENCE' | 'OTHER';
  message: string;
}

// Map from your database schema to our types
export function mapCompanyMemberToUser(member: any): User {
  return {
    id: member.id,
    name: member.name || '',
    email: member.email || '',
    role: member.role || '',
    isInvited: member.status === 'pending',
    managerId: member.manager_id,
  };
}