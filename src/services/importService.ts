// services/importService.ts
import Papa from 'papaparse';
import { ImportResult, ImportError } from '@/app/types/orgChart.types';

export interface CsvRow {
  email: string;
  managerEmail: string;
  name?: string;
  title?: string;
  role?: string;
}

export const importService = {
  parseCSV: (file: File): Promise<CsvRow[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const rows = results.data as CsvRow[];
          resolve(rows);
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  },

  validateCSV: (rows: CsvRow[]): ImportError[] => {
    const errors: ImportError[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    rows.forEach((row, index) => {
      if (!row.email || !emailRegex.test(row.email)) {
        errors.push({
          row: index + 1,
          email: row.email || '',
          errorType: 'INVALID_EMAIL',
          message: `Invalid email format: ${row.email}`,
        });
      }

      if (row.managerEmail && !emailRegex.test(row.managerEmail)) {
        errors.push({
          row: index + 1,
          email: row.managerEmail,
          errorType: 'INVALID_EMAIL',
          message: `Invalid manager email format: ${row.managerEmail}`,
        });
      }
    });

    // Check for circular references
    const emailToManagerMap = new Map<string, string>();
    rows.forEach((row) => {
      if (row.email && row.managerEmail) {
        emailToManagerMap.set(row.email, row.managerEmail);
      }
    });

    emailToManagerMap.forEach((managerEmail, email) => {
      let currentEmail = email;
      const visited = new Set<string>();

      while (emailToManagerMap.has(currentEmail) && !visited.has(currentEmail)) {
        visited.add(currentEmail);
        currentEmail = emailToManagerMap.get(currentEmail) as string;

        if (currentEmail === email) {
          const rowIndex = rows.findIndex((r) => r.email === email);
          errors.push({
            row: rowIndex + 1,
            email: email,
            errorType: 'CIRCULAR_REFERENCE',
            message: `Circular reference detected: ${email} -> ${currentEmail}`,
          });
          break;
        }
      }
    });

    return errors;
  },

  importOrgChart: async (file: File): Promise<ImportResult> => {
    // Get the user's token from local storage
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }
    
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/org-chart/import', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      // Return the error details from the API if available
      if (errorData.errors) {
        return {
          success: false,
          errors: errorData.errors,
          usersAdded: 0,
          relationshipsCreated: 0
        };
      }
      throw new Error('Failed to import organization chart');
    }

    return response.json();
  },
};