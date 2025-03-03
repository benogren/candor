export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
          domains: string[];
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
          domains?: string[];
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
          domains?: string[];
        };
      };
      company_members: {
        Row: {
          id: string;
          company_id: string;
          role: 'admin' | 'member';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          company_id: string;
          role?: 'admin' | 'member';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          role?: 'admin' | 'member';
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};