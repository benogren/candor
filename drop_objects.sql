-- Drop all policies
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN (
    SELECT 
      schemaname,
      tablename,
      policyname
    FROM 
      pg_policies 
    WHERE 
      schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                   pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Drop all functions in public schema
DO $$
DECLARE
  func record;
BEGIN
  FOR func IN (
    SELECT 
      proname, 
      oid
    FROM 
      pg_proc
    WHERE 
      pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I CASCADE', func.proname);
  END LOOP;
END $$;

-- Drop all tables in public schema
DO $$
DECLARE
  tbl record;
BEGIN
  -- Disable triggers temporarily
  SET session_replication_role = 'replica';
  
  FOR tbl IN (
    SELECT 
      tablename
    FROM 
      pg_tables
    WHERE 
      schemaname = 'public'
    ORDER BY tablename
  ) LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', tbl.tablename);
  END LOOP;
  
  -- Re-enable triggers
  SET session_replication_role = 'origin';
END $$;

-- Drop types in public schema
DO $$
DECLARE
  typ record;
BEGIN
  FOR typ IN (
    SELECT 
      typname
    FROM 
      pg_type
    WHERE 
      typnamespace = 'public'::regnamespace
      AND typtype = 'e'  -- Only drop enum types
  ) LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', typ.typname);
  END LOOP;
END $$;