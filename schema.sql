

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."member_status" AS ENUM (
    'pending',
    'active',
    'deactivated'
);


ALTER TYPE "public"."member_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'member'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_user_profiles"("admin_id" "uuid", "company_id" "uuid", "users_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  user_record JSONB;
  result JSONB = '{"success": [], "errors": []}'::JSONB;
  is_admin BOOLEAN;
  user_id UUID;
  temp_email TEXT;
  temp_name TEXT;
  temp_role TEXT;
BEGIN
  -- Verify the caller is an admin for the specified company
  SELECT EXISTS (
    SELECT 1 
    FROM public.company_members 
    WHERE id = admin_id 
    AND company_id = $2
    AND role = 'admin'
  ) INTO is_admin;
  
  IF NOT is_admin THEN
    RETURN jsonb_build_object('error', 'Permission denied: User is not an admin for this company');
  END IF;
  
  -- Process each user in the array
  FOR user_record IN SELECT * FROM jsonb_array_elements(users_data)
  LOOP
    BEGIN
      -- Extract values with appropriate defaults
      temp_email = user_record->>'email';
      
      -- Email is required
      IF temp_email IS NULL OR temp_email = '' THEN
        result = jsonb_set(
          result, 
          '{errors}', 
          (result->'errors') || jsonb_build_object('record', user_record, 'message', 'Email is required')
        );
        CONTINUE;
      END IF;
      
      temp_name = COALESCE(user_record->>'name', '');
      temp_role = COALESCE(user_record->>'role', 'member');
      
      -- Validate role
      IF temp_role != 'admin' AND temp_role != 'member' THEN
        temp_role := 'member';
      END IF;
      
      -- Generate a UUID for the user
      user_id = gen_random_uuid();
      
      -- Create user profile
      INSERT INTO public.user_profiles (
        id, 
        email, 
        name, 
        created_at,
        updated_at
      )
      VALUES (
        user_id,
        temp_email,
        temp_name,
        NOW(),
        NOW()
      );
      
      -- Create company member entry with pending status
      INSERT INTO public.company_members (
        id,
        company_id,
        role,
        status,
        created_at,
        updated_at
      )
      VALUES (
        user_id,
        company_id,
        temp_role,
        'pending',
        NOW(),
        NOW()
      );
      
      -- Add to success list
      result = jsonb_set(
        result, 
        '{success}', 
        (result->'success') || jsonb_build_object(
          'id', user_id,
          'email', temp_email,
          'name', temp_name
        )
      );
      
    EXCEPTION WHEN OTHERS THEN
      -- Add to error list
      result = jsonb_set(
        result, 
        '{errors}', 
        (result->'errors') || jsonb_build_object(
          'record', user_record,
          'message', SQLERRM
        )
      );
    END;
  END LOOP;
  
  RETURN result;
END;
$_$;


ALTER FUNCTION "public"."admin_create_user_profiles"("admin_id" "uuid", "company_id" "uuid", "users_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_team_member"("member_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update the status to 'active'
  UPDATE public.company_members
  SET 
    status = 'active',
    updated_at = NOW()
  WHERE id = member_id;
  
  -- Return success
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."approve_team_member"("member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_feedback_response"("response_recipient_id" "uuid", "viewer_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Get the target user_id by following the relationship chain
  SELECT fui.id INTO target_user_id
  FROM feedback_recipients fr
  JOIN feedback_user_identities fui ON fr.recipient_id = fui.id
  WHERE fr.id = response_recipient_id;
  
  -- Returns true if:
  -- 1. The viewer is the target user
  -- 2. The viewer is the target user's manager
  RETURN (
    target_user_id = viewer_id
    OR EXISTS (
      SELECT 1 FROM manager_relationships
      WHERE manager_id = viewer_id
      AND member_id = target_user_id
    )
  );
END;
$$;


ALTER FUNCTION "public"."can_view_feedback_response"("response_recipient_id" "uuid", "viewer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_account_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result jsonb;
BEGIN
  -- Get basic status
  result := get_user_status();
  
  -- Add user-friendly messages based on status
  IF result->>'status' = 'pending' THEN
    result := result || jsonb_build_object(
      'message', 'Your account is pending approval. You can view limited information until an administrator approves your account.',
      'action_required', false
    );
  ELSIF result->>'status' = 'deactivated' THEN
    result := result || jsonb_build_object(
      'message', 'Your account has been deactivated. Please contact your administrator for assistance.',
      'action_required', false
    );
  ELSIF result->>'status' = 'pending_registration' THEN
    result := result || jsonb_build_object(
      'message', 'Your registration is pending. Please complete the registration process.',
      'action_required', true,
      'action_type', 'complete_registration'
    );
  ELSIF result->>'status' = 'no_account' THEN
    result := result || jsonb_build_object(
      'message', 'You do not have an account in the system. Please contact your administrator.',
      'action_required', false
    );
  ELSE
    result := result || jsonb_build_object(
      'message', 'Your account is active.',
      'action_required', false
    );
  END IF;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."check_user_account_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_company_member_after_verification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- If this is a pending registration being marked as processed
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'pending_registrations' 
     AND OLD.status = 'pending' AND NEW.status = 'processed' THEN
    
    -- Check if a company_members record already exists
    PERFORM 1 FROM company_members WHERE id = NEW.user_id LIMIT 1;
    
    -- If no record exists, create one
    IF NOT FOUND THEN
      INSERT INTO company_members (
        id,
        company_id,
        role,
        status,
        created_at,
        updated_at
      ) VALUES (
        NEW.user_id,
        NEW.company_id,
        COALESCE(NEW.role, 'member'),
        'active', -- Set as active since email is verified
        NOW(),
        NOW()
      );
      
      -- Log the creation
      RAISE NOTICE 'Created company_members record for user %', NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_company_member_after_verification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_initial_occurrence"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  cycle_start_date TIMESTAMP WITH TIME ZONE;
  cycle_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Set start date to the cycle's start_date or current date
  cycle_start_date := COALESCE(NEW.start_date, CURRENT_TIMESTAMP);
  
  -- Set end date based on frequency (default to 7 days for weekly)
  CASE LOWER(NEW.frequency)
    WHEN 'weekly' THEN cycle_end_date := cycle_start_date + INTERVAL '7 days';
    WHEN 'biweekly' THEN cycle_end_date := cycle_start_date + INTERVAL '14 days';
    WHEN 'monthly' THEN cycle_end_date := cycle_start_date + INTERVAL '1 month';
    WHEN 'quarterly' THEN cycle_end_date := cycle_start_date + INTERVAL '3 months';
    ELSE cycle_end_date := cycle_start_date + INTERVAL '7 days';
  END CASE;
  
  -- Insert the first occurrence
  INSERT INTO feedback_cycle_occurrences (
    cycle_id,
    occurrence_number,
    start_date,
    end_date,
    status
  ) VALUES (
    NEW.id,
    1,
    cycle_start_date,
    cycle_end_date,
    'active'
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_initial_occurrence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_next_occurrence"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  cycle_record RECORD;
  next_start_date TIMESTAMP WITH TIME ZONE;
  next_end_date TIMESTAMP WITH TIME ZONE;
  next_occurrence_number INTEGER;
BEGIN
  -- Get cycle details
  SELECT * INTO cycle_record FROM feedback_cycles WHERE id = NEW.cycle_id;
  
  -- Only proceed if cycle is still active
  IF cycle_record.status = 'active' THEN
    -- Set next occurrence dates
    next_start_date := NEW.end_date;
    
    -- Calculate end date based on frequency
    CASE LOWER(cycle_record.frequency)
      WHEN 'weekly' THEN next_end_date := next_start_date + INTERVAL '7 days';
      WHEN 'biweekly' THEN next_end_date := next_start_date + INTERVAL '14 days';
      WHEN 'monthly' THEN next_end_date := next_start_date + INTERVAL '1 month';
      WHEN 'quarterly' THEN next_end_date := next_start_date + INTERVAL '3 months';
      ELSE next_end_date := next_start_date + INTERVAL '7 days';
    END CASE;
    
    -- Get next occurrence number
    next_occurrence_number := NEW.occurrence_number + 1;
    
    -- Insert the next occurrence
    INSERT INTO feedback_cycle_occurrences (
      cycle_id,
      occurrence_number,
      start_date,
      end_date,
      status
    ) VALUES (
      NEW.cycle_id,
      next_occurrence_number,
      next_start_date,
      next_end_date,
      'active'
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_next_occurrence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_profile"("user_id" "uuid", "user_email" "text", "user_name" "text" DEFAULT NULL::"text", "user_job_title" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO user_profiles (id, email, name, job_title)
  VALUES (user_id, user_email, user_name, user_job_title)
  ON CONFLICT (id) DO UPDATE
  SET email = user_email,
      name = COALESCE(user_name, user_profiles.name),
      job_title = COALESCE(user_job_title, user_profiles.job_title),
      updated_at = now();
      
  RETURN user_id;
END;
$$;


ALTER FUNCTION "public"."create_user_profile"("user_id" "uuid", "user_email" "text", "user_name" "text", "user_job_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deactivate_team_member"("member_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update the status to 'deactivated'
  UPDATE public.company_members
  SET 
    status = 'deactivated',
    updated_at = NOW()
  WHERE id = member_id;
  
  -- Return success
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."deactivate_team_member"("member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_manager_assignment"("manager_id_param" "uuid", "member_id_param" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result jsonb;
  manager_company_id uuid;
  member_company_id uuid;
  user_company_id uuid;
  is_admin boolean;
BEGIN
  -- Get the current user's company and admin status
  SELECT 
    cm.company_id, 
    cm.role = 'admin' 
  INTO 
    user_company_id, 
    is_admin
  FROM company_members cm
  WHERE cm.id = auth.uid()
  AND cm.status = 'active';
  
  -- Get manager's company
  SELECT cm.company_id INTO manager_company_id
  FROM company_members cm
  WHERE cm.id = manager_id_param;
  
  -- Get member's company
  SELECT cm.company_id INTO member_company_id
  FROM company_members cm
  WHERE cm.id = member_id_param;
  
  -- Build diagnostic info
  SELECT jsonb_build_object(
    'user_id', auth.uid(),
    'user_company_id', user_company_id,
    'is_admin', is_admin,
    'manager_id', manager_id_param,
    'manager_company_id', manager_company_id,
    'member_id', member_id_param,
    'member_company_id', member_company_id,
    'same_company', COALESCE(user_company_id = manager_company_id AND user_company_id = member_company_id, false),
    'can_assign', COALESCE(is_admin AND user_company_id = manager_company_id AND user_company_id = member_company_id, false)
  ) INTO result;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."debug_manager_assignment"("manager_id_param" "uuid", "member_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_company"("p_company_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Disable triggers temporarily to avoid unexpected behavior during bulk deletion
    SET session_replication_role = 'replica';
    
    -- First handle tables that depend on feedback_sessions
    -- Delete feedback_responses (depends on feedback_recipients, feedback_questions, feedback_sessions)
    DELETE FROM public.feedback_responses
    WHERE session_id IN (
        SELECT id FROM public.feedback_sessions 
        WHERE cycle_id IN (
            SELECT id FROM public.feedback_cycles 
            WHERE company_id = p_company_id
        )
    );
    
    -- Delete feedback_recipients (depends on feedback_sessions, feedback_user_identities)
    DELETE FROM public.feedback_recipients
    WHERE session_id IN (
        SELECT id FROM public.feedback_sessions 
        WHERE cycle_id IN (
            SELECT id FROM public.feedback_cycles 
            WHERE company_id = p_company_id
        )
    );
    
    -- Delete auth_tokens that reference feedback_sessions
    DELETE FROM public.auth_tokens
    WHERE session_id IN (
        SELECT id FROM public.feedback_sessions 
        WHERE cycle_id IN (
            SELECT id FROM public.feedback_cycles 
            WHERE company_id = p_company_id
        )
    );
    
    -- Delete feedback_sessions (depends on feedback_cycles)
    DELETE FROM public.feedback_sessions
    WHERE cycle_id IN (
        SELECT id FROM public.feedback_cycles 
        WHERE company_id = p_company_id
    );
    
    -- Delete feedback_cycles (will cascade delete feedback_cycle_occurrences)
    DELETE FROM public.feedback_cycles
    WHERE company_id = p_company_id;
    
    -- Delete auth_tokens that reference company_members
    DELETE FROM public.auth_tokens
    WHERE user_id IN (
        SELECT id FROM public.company_members 
        WHERE company_id = p_company_id
    );
    
    -- Delete feedback_questions
    DELETE FROM public.feedback_questions
    WHERE company_id = p_company_id;
    
    -- Delete feedback_user_identities
    DELETE FROM public.feedback_user_identities
    WHERE company_id = p_company_id;
    
    -- Finally, delete the company itself
    -- This will cascade delete related records in:
    -- company_values, invited_users, pending_registrations, 
    -- manager_relationships, company_members, and feedback_summaries
    -- (all these tables have ON DELETE CASCADE constraints)
    DELETE FROM public.companies
    WHERE id = p_company_id;
    
    -- Re-enable triggers
    SET session_replication_role = 'origin';
    
    -- Log the deletion for audit purposes
    INSERT INTO public.debug_logs(event_type, details, metadata)
    VALUES ('company_deleted', 'Company data purged', jsonb_build_object('company_id', p_company_id));
END;
$$;


ALTER FUNCTION "public"."delete_company"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invite_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_invite_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_functions"() RETURNS TABLE("function_name" "text", "schema_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.proname::text AS function_name,
    n.nspname::text AS schema_name
  FROM 
    pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE 
    n.nspname = 'public'
  ORDER BY 
    n.nspname, p.proname;
END;
$$;


ALTER FUNCTION "public"."get_available_functions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_deactivated_users_by_emails"("p_company_id" "uuid", "p_emails" "text"[]) RETURNS TABLE("id" "uuid", "email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    prof.email
  FROM 
    company_members cm
  JOIN 
    user_profiles prof ON cm.id = prof.id
  WHERE 
    cm.company_id = p_company_id
    AND cm.status = 'deactivated'
    AND LOWER(prof.email) = ANY(SELECT LOWER(e) FROM UNNEST(p_emails) e);
END;
$$;


ALTER FUNCTION "public"."get_deactivated_users_by_emails"("p_company_id" "uuid", "p_emails" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_member_status_enum"() RETURNS TABLE("enum_value" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT unnest(enum_range(NULL::public.member_status)::text[]);
END;
$$;


ALTER FUNCTION "public"."get_member_status_enum"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nominee_name"("user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  user_name TEXT;
BEGIN
  -- Try to get name from user_profiles
  SELECT name INTO user_name
  FROM user_profiles
  WHERE id = user_id;
  
  -- If not found, try company_members for email
  IF user_name IS NULL THEN
    SELECT email INTO user_name
    FROM company_members
    WHERE id = user_id;
  END IF;
  
  -- Last resort, use ID prefix
  IF user_name IS NULL THEN
    user_name := 'User ' || SUBSTRING(user_id::text, 1, 8);
  END IF;
  
  RETURN user_name;
END;
$$;


ALTER FUNCTION "public"."get_nominee_name"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_top_value_nominees"("company_value_id_param" "uuid", "limit_param" integer) RETURNS TABLE("nominee_name" "text", "nomination_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH value_responses AS (
    -- Get all responses for the specific company value
    SELECT 
      fr.id,
      fr.session_id,
      fr.rating_value,
      fs.provider_id,
      fq.company_value_id,
      fr.created_at
    FROM 
      feedback_responses fr
      JOIN feedback_questions fq ON fr.question_id = fq.id
      JOIN feedback_sessions fs ON fr.session_id = fs.id
    WHERE 
      fq.company_value_id = company_value_id_param
      AND fr.rating_value >= 4  -- Consider ratings of 4 or 5 as nominations
      AND NOT fr.skipped
  ),
  nominees AS (
    -- Join with user profiles to get nominee names
    SELECT 
      COALESCE(up.name, cm.id::text) AS nominee_name,
      COUNT(*) AS nomination_count
    FROM 
      value_responses vr
      JOIN company_members cm ON vr.provider_id = cm.id
      LEFT JOIN user_profiles up ON cm.id = up.id
    GROUP BY 
      COALESCE(up.name, cm.id::text)
    ORDER BY 
      nomination_count DESC
    LIMIT limit_param
  )
  SELECT * FROM nominees;
END;
$$;


ALTER FUNCTION "public"."get_top_value_nominees"("company_value_id_param" "uuid", "limit_param" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_company_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  company_id_val uuid;
BEGIN
  SELECT cm.company_id INTO company_id_val
  FROM company_members cm
  WHERE cm.id = auth.uid()
  AND cm.status = 'active';
  
  -- Return NULL instead of raising an exception
  -- This makes it more flexible in policy usage
  RETURN company_id_val;
END;
$$;


ALTER FUNCTION "public"."get_user_company_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  status_info jsonb;
BEGIN
  SELECT jsonb_build_object(
    'user_id', auth.uid(),
    'status', COALESCE(cm.status, 'unknown'),
    'role', COALESCE(cm.role, 'none'),
    'company_id', cm.company_id,
    'is_active', cm.status = 'active',
    'is_pending', cm.status = 'pending',
    'is_deactivated', cm.status = 'deactivated'
  ) INTO status_info
  FROM company_members cm
  WHERE cm.id = auth.uid();
  
  -- If no record in company_members, check pending_registrations
  IF status_info IS NULL THEN
    SELECT jsonb_build_object(
      'user_id', auth.uid(),
      'status', 'pending_registration',
      'role', pr.role,
      'company_id', pr.company_id,
      'is_active', false,
      'is_pending', true,
      'is_deactivated', false
    ) INTO status_info
    FROM pending_registrations pr
    WHERE pr.user_id = auth.uid() AND pr.status = 'pending';
  END IF;
  
  -- Default if no status found
  IF status_info IS NULL THEN
    status_info := jsonb_build_object(
      'user_id', auth.uid(),
      'status', 'no_account',
      'role', 'none',
      'company_id', null,
      'is_active', false,
      'is_pending', false,
      'is_deactivated', false
    );
  END IF;
  
  RETURN status_info;
END;
$$;


ALTER FUNCTION "public"."get_user_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_confirmed_registration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  pending_record RECORD;
  search_path_val TEXT;
  current_schemas TEXT[];
BEGIN
  -- Log the search path and schemas for debugging
  SELECT current_setting('search_path') INTO search_path_val;
  SELECT current_schemas(true) INTO current_schemas;
  
  INSERT INTO public.debug_logs (
    event_type, user_id, user_email, details, metadata
  ) VALUES (
    'path_debug',
    NEW.id,
    NEW.email,
    'Checking search path and schemas',
    jsonb_build_object(
      'search_path', search_path_val,
      'current_schemas', current_schemas
    )
  );

  -- Only proceed if email was just confirmed
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    BEGIN
      -- Try to find the pending registration
      SELECT * INTO pending_record FROM public.pending_registrations
      WHERE user_id = NEW.id;
      
      IF FOUND THEN
        -- Log the pending record
        INSERT INTO public.debug_logs (
          event_type, user_id, user_email, details, metadata
        ) VALUES (
          'pending_found',
          NEW.id,
          NEW.email,
          'Found pending registration in trigger',
          jsonb_build_object(
            'pending_id', pending_record.id,
            'company_id', pending_record.company_id,
            'role', pending_record.role
          )
        );
        
        -- Try different approaches to insert the record
        
        -- Approach 1: Set search path explicitly first
        BEGIN
          -- Set search path to include public
          EXECUTE 'SET search_path TO public, auth';
          
          -- Attempt the insert
          EXECUTE format('
            INSERT INTO company_members (
              id,
              company_id,
              role,
              status,
              created_at,
              updated_at
            ) VALUES (
              %L,
              %L,
              %L,
              %L,
              NOW(),
              NOW()
            )',
            NEW.id,
            pending_record.company_id,
            pending_record.role,
            'pending'
          );
          
          -- Log success
          INSERT INTO public.debug_logs (
            event_type, user_id, user_email, details
          ) VALUES (
            'approach1_success',
            NEW.id,
            NEW.email,
            'Approach 1 succeeded: Set search path'
          );
          
        EXCEPTION WHEN OTHERS THEN
          -- Log the approach 1 error
          INSERT INTO public.debug_logs (
            event_type, user_id, user_email, details, metadata
          ) VALUES (
            'approach1_error',
            NEW.id,
            NEW.email,
            'Approach 1 error: ' || SQLERRM,
            jsonb_build_object(
              'error_code', SQLSTATE
            )
          );
          
          -- Approach 2: Use fully qualified name with double quotes
          BEGIN
            EXECUTE format('
              INSERT INTO "public"."company_members" (
                id,
                company_id,
                role,
                status,
                created_at,
                updated_at
              ) VALUES (
                %L,
                %L,
                %L,
                %L,
                NOW(),
                NOW()
              )',
              NEW.id,
              pending_record.company_id,
              pending_record.role,
              'pending'
            );
            
            -- Log success
            INSERT INTO public.debug_logs (
              event_type, user_id, user_email, details
            ) VALUES (
              'approach2_success',
              NEW.id,
              NEW.email,
              'Approach 2 succeeded: Double quotes'
            );
            
          EXCEPTION WHEN OTHERS THEN
            -- Log the approach 2 error
            INSERT INTO public.debug_logs (
              event_type, user_id, user_email, details, metadata
            ) VALUES (
              'approach2_error',
              NEW.id,
              NEW.email,
              'Approach 2 error: ' || SQLERRM,
              jsonb_build_object(
                'error_code', SQLSTATE
              )
            );
            
            -- Approach 3: Create a temporary function
            BEGIN
              -- Create a temporary helper function
              CREATE OR REPLACE FUNCTION public.temp_insert_member(
                user_id UUID,
                company_id UUID,
                user_role TEXT,
                user_status TEXT
              ) RETURNS VOID AS $$
              BEGIN
                INSERT INTO public.company_members (
                  id,
                  company_id,
                  role,
                  status,
                  created_at,
                  updated_at
                ) VALUES (
                  user_id,
                  company_id,
                  user_role,
                  user_status,
                  NOW(),
                  NOW()
                );
              END;
              $$ LANGUAGE plpgsql SECURITY DEFINER;
              
              -- Call the helper function
              PERFORM public.temp_insert_member(
                NEW.id,
                pending_record.company_id,
                pending_record.role,
                'pending'
              );
              
              -- Log success
              INSERT INTO public.debug_logs (
                event_type, user_id, user_email, details
              ) VALUES (
                'approach3_success',
                NEW.id,
                NEW.email,
                'Approach 3 succeeded: Helper function'
              );
              
              -- Clean up the temporary function
              DROP FUNCTION IF EXISTS public.temp_insert_member;
              
            EXCEPTION WHEN OTHERS THEN
              -- Log the approach 3 error
              INSERT INTO public.debug_logs (
                event_type, user_id, user_email, details, metadata
              ) VALUES (
                'approach3_error',
                NEW.id,
                NEW.email,
                'Approach 3 error: ' || SQLERRM,
                jsonb_build_object(
                  'error_code', SQLSTATE
                )
              );
            END;
          END;
        END;
        
        -- Mark as processed regardless of insert success (to avoid reprocessing)
        UPDATE public.pending_registrations
        SET 
          processed_at = NOW(),
          status = 'processed'
        WHERE user_id = NEW.id;
        
      ELSE
        -- Log no pending registration found
        INSERT INTO public.debug_logs (
          event_type, user_id, user_email, details
        ) VALUES (
          'no_pending_found',
          NEW.id,
          NEW.email,
          'No pending registration found in trigger'
        );
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log any unexpected errors
      INSERT INTO public.debug_logs (
        event_type, user_id, user_email, details, metadata
      ) VALUES (
        'general_error',
        NEW.id,
        NEW.email,
        'General error in trigger: ' || SQLERRM,
        jsonb_build_object(
          'error_code', SQLSTATE
        )
      );
    END;
  END IF;
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."handle_confirmed_registration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, name)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'name'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_with_rls_bypass"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert into user_profiles with RLS bypass
  INSERT INTO public.user_profiles (id, email, name, created_at, updated_at)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_with_rls_bypass"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_user_email_verification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update the status to 'active' in the company_members table
  UPDATE public.company_members
  SET 
    status = 'active',
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_user_email_verification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_user_profile_merge"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  profile_exists BOOLEAN;
BEGIN
  -- Check if a profile already exists for this user
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = NEW.id
  ) INTO profile_exists;
  
  IF profile_exists THEN
    -- Profile exists (likely created by admin), update relevant fields
    UPDATE public.user_profiles
    SET 
      email = COALESCE(public.user_profiles.email, NEW.email),
      updated_at = NOW()
    WHERE id = NEW.id;
  ELSE
    -- Profile doesn't exist, create a new one
    INSERT INTO public.user_profiles (id, email, name, created_at, updated_at)
    VALUES (
      NEW.id, 
      NEW.email,
      NEW.raw_user_meta_data->>'name',
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_user_profile_merge"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("company_id_param" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM company_members cm
    WHERE cm.id = (SELECT auth.uid())
    AND cm.company_id = company_id_param
    AND cm.role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"("company_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_manager_of"("member_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM manager_relationships
    WHERE manager_id = (SELECT auth.uid())
    AND member_id = $1
  );
END;
$_$;


ALTER FUNCTION "public"."is_manager_of"("member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_user"("user_id" "uuid", "company_id" "uuid", "user_role" "text" DEFAULT 'member'::"text") RETURNS boolean
    LANGUAGE "sql"
    AS $$
  SELECT link_user_to_company(user_id, company_id, user_role);
$$;


ALTER FUNCTION "public"."link_user"("user_id" "uuid", "company_id" "uuid", "user_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_user_to_company"("user_id" "uuid", "company_id" "uuid", "user_role" "text" DEFAULT 'member'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  success BOOLEAN;
BEGIN
  -- First check if the user is already linked to a company
  IF EXISTS (SELECT 1 FROM company_members WHERE id = user_id) THEN
    RETURN FALSE;
  END IF;
  
  -- Insert the user-company relationship
  INSERT INTO company_members (id, company_id, role, created_at, updated_at)
  VALUES (user_id, company_id, user_role, NOW(), NOW());
  
  success := FOUND;
  RETURN success;
END;
$$;


ALTER FUNCTION "public"."link_user_to_company"("user_id" "uuid", "company_id" "uuid", "user_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."maintain_manager_relationships"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  invite_record RECORD;
  manager_id_value UUID;
  invited_manager_id_value UUID;
BEGIN
  -- If this is a new pending registration (from accepting an invite)
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'pending_registrations' THEN
    -- Find the corresponding invite record
    SELECT * INTO invite_record 
    FROM invited_users 
    WHERE email = NEW.email 
    AND company_id = NEW.company_id
    LIMIT 1;
    
    IF invite_record IS NOT NULL THEN
      -- Find any manager relationship for this invited user
      SELECT manager_id, invited_manager_id INTO manager_id_value, invited_manager_id_value
      FROM manager_relationships
      WHERE invited_member_id = invite_record.id
      LIMIT 1;
      
      -- If a relationship exists, create a new one for the pending user
      IF manager_id_value IS NOT NULL OR invited_manager_id_value IS NOT NULL THEN
        INSERT INTO manager_relationships (
          member_id,
          manager_id,
          invited_manager_id,
          company_id,
          relationship_type,
          created_at,
          updated_at
        ) VALUES (
          NEW.user_id,
          manager_id_value,
          invited_manager_id_value,
          NEW.company_id,
          'direct',
          NOW(),
          NOW()
        );
      END IF;
    END IF;
  END IF;
  
  -- If this is a user confirming their email (pending to active)
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'pending_registrations' 
     AND OLD.status = 'pending' AND NEW.status = 'processed' THEN
    -- Find any manager relationship for this pending user
    SELECT manager_id, invited_manager_id INTO manager_id_value, invited_manager_id_value
    FROM manager_relationships
    WHERE member_id = NEW.user_id
    LIMIT 1;
    
    -- If a relationship exists, ensure it stays intact
    -- The relationship already uses member_id, so it should work
    -- but we might need to update company_members details
    -- This depends on how you configure the registration process
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."maintain_manager_relationships"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_invited_user_feedback"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_invited_user RECORD;
  v_count INTEGER;
BEGIN
  -- Check if this new user was previously invited
  SELECT * INTO v_invited_user 
  FROM public.invited_users 
  WHERE email = NEW.email 
  AND used_at IS NULL
  LIMIT 1;
  
  -- If we found a matching invited user
  IF FOUND THEN
    -- Log for debugging
    RAISE NOTICE 'Migrating feedback for invited user % (ID: %) to registered user % (ID: %)', 
                 v_invited_user.email, 
                 v_invited_user.id,
                 NEW.email,
                 NEW.id;
    
    -- Check if feedback_user_identity exists for this invited user
    IF EXISTS (SELECT 1 FROM public.feedback_user_identities WHERE id = v_invited_user.id) THEN
      -- Step 1: Create a new feedback identity with the user's registered ID
      INSERT INTO public.feedback_user_identities (
        id, 
        identity_type, 
        company_id, 
        email, 
        name
      ) 
      SELECT 
        NEW.id,
        'registered',
        company_id,
        NEW.email,
        COALESCE(NEW.name, name)
      FROM public.feedback_user_identities
      WHERE id = v_invited_user.id;
      
      -- Step 2: Update all feedback_recipients to reference the new identity ID
      UPDATE public.feedback_recipients
      SET recipient_id = NEW.id
      WHERE recipient_id = v_invited_user.id;
      
      -- Get count of updated records for logging
      GET DIAGNOSTICS v_count = ROW_COUNT;
      
      -- Step 3: Now it's safe to delete the old identity record
      DELETE FROM public.feedback_user_identities
      WHERE id = v_invited_user.id;
      
      -- Step 4: Mark the invited user as used
      UPDATE public.invited_users
      SET used_at = NOW()
      WHERE id = v_invited_user.id;
      
      RAISE NOTICE 'Feedback migration complete for user % - created new identity and updated % recipient records', 
                   NEW.email, v_count;
    ELSE
      RAISE NOTICE 'No feedback found for invited user %', v_invited_user.email;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log errors but don't break the registration process
  RAISE WARNING 'Error in migrate_invited_user_feedback: %', SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."migrate_invited_user_feedback"() OWNER TO "postgres";


CREATE PROCEDURE "public"."setup_standard_rls"(IN "table_name" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  
  -- Create owner/admin policy
  EXECUTE format('CREATE POLICY "admins_full_access" ON %I FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.company_members 
      WHERE company_members.id = auth.uid() 
      AND company_members.company_id = %I.company_id 
      AND company_members.role = ''admin''
    )
  )', table_name, table_name);
  
  -- Create service role bypass policy
  EXECUTE format('CREATE POLICY "service_role_bypass" ON %I USING (true) WITH CHECK (true)', table_name);
  EXECUTE format('ALTER POLICY "service_role_bypass" ON %I TO service_role', table_name);
  
  -- Add other common policies as needed
END;
$$;


ALTER PROCEDURE "public"."setup_standard_rls"(IN "table_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_manager_relationships"("invited_user_id" "uuid", "auth_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update relationships where invited user is the member
  UPDATE public.manager_relationships
  SET member_id = auth_user_id, invited_member_id = NULL
  WHERE invited_member_id = invited_user_id;
  
  -- Update relationships where invited user is the manager
  UPDATE public.manager_relationships
  SET manager_id = auth_user_id, invited_manager_id = NULL
  WHERE invited_manager_id = invited_user_id;
  
  -- Return success
  RETURN;
END;
$$;


ALTER FUNCTION "public"."transfer_manager_relationships"("invited_user_id" "uuid", "auth_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_user_profile_info"("invited_user_id" "uuid", "auth_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_name TEXT;
  v_job_title TEXT;
  v_invited_record RECORD;
BEGIN
  -- Get profile info from invited_users
  SELECT * INTO v_invited_record
  FROM public.invited_users 
  WHERE id = invited_user_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Invited user record not found for ID %', invited_user_id;
    RETURN;
  END IF;
  
  v_name := v_invited_record.name;
  v_job_title := v_invited_record.job_title;
  
  -- Update or create user_profiles
  -- First try to update an existing profile
  UPDATE public.user_profiles 
  SET 
    name = COALESCE(v_name, name),
    job_title = v_job_title  -- Always update job title if present in invited record
  WHERE id = auth_user_id;
  
  -- If no profile exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (id, name, job_title, email)
    VALUES (
      auth_user_id, 
      v_name, 
      v_job_title,
      v_invited_record.email
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."transfer_user_profile_info"("invited_user_id" "uuid", "auth_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."auth_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "token" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auth_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "domains" "text"[] DEFAULT '{}'::"text"[],
    "industry" "text",
    "stripe_customer_id" "text",
    "subscription_id" "text",
    "subscription_interval" "text",
    "subscription_status" "text",
    "user_count" smallint,
    "trial_end" timestamp with time zone
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_members" (
    "id" "uuid" NOT NULL,
    "company_id" "uuid",
    "role" "public"."user_role" DEFAULT 'member'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."member_status" DEFAULT 'pending'::"public"."member_status" NOT NULL
);


ALTER TABLE "public"."company_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "icon" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debug_logs" (
    "id" integer NOT NULL,
    "event_type" "text",
    "user_id" "uuid",
    "user_email" "text",
    "details" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."debug_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."debug_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."debug_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."debug_logs_id_seq" OWNED BY "public"."debug_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."demo_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "company" "text" NOT NULL,
    "company_size" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "status" "text" DEFAULT 'pending'::"text"
);


ALTER TABLE "public"."demo_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_cycle_occurrences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "occurrence_number" integer NOT NULL,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "emails_sent_count" integer DEFAULT 0 NOT NULL,
    "responses_count" integer DEFAULT 0 NOT NULL,
    "emails_sent_at" timestamp with time zone,
    "reminders_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feedback_cycle_occurrences_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."feedback_cycle_occurrences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_cycles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "cycle_name" "text",
    "status" "text" NOT NULL,
    "start_date" timestamp with time zone,
    "due_date" timestamp with time zone,
    "frequency" "text" DEFAULT 'weekly'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feedback_cycles_frequency_check" CHECK (("frequency" = ANY (ARRAY['weekly'::"text", 'biweekly'::"text", 'monthly'::"text", 'quarterly'::"text"]))),
    CONSTRAINT "feedback_cycles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'draft'::"text"])))
);


ALTER TABLE "public"."feedback_cycles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_questions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid",
    "question_text" "text" NOT NULL,
    "question_type" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "question_description" "text",
    "question_subtype" "text",
    "company_value_id" "uuid",
    "is_admin_manageable" boolean DEFAULT true NOT NULL,
    CONSTRAINT "feedback_questions_question_type_check" CHECK (("question_type" = ANY (ARRAY['rating'::"text", 'text'::"text", 'values'::"text", 'ai'::"text"]))),
    CONSTRAINT "feedback_questions_scope_check" CHECK (("scope" = ANY (ARRAY['global'::"text", 'company'::"text"])))
);


ALTER TABLE "public"."feedback_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_recipients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feedback_recipients_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."feedback_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_responses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "rating_value" integer,
    "text_response" "text",
    "has_comment" boolean DEFAULT false,
    "comment_text" "text",
    "skipped" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "session_id" "uuid" NOT NULL,
    "nominated_user_id" "uuid",
    "nomination_date" timestamp with time zone
);


ALTER TABLE "public"."feedback_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "reminder_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "occurrence_id" "uuid",
    CONSTRAINT "feedback_sessions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."feedback_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_summaries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "timeframe" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "feedback_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "text"
);


ALTER TABLE "public"."feedback_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_data" "jsonb" DEFAULT '{}'::"jsonb",
    "avatar_url" "text",
    "job_title" "text"
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."feedback_summaries_view" AS
 SELECT "fs"."id",
    "fs"."user_id",
    "fs"."timeframe",
    "fs"."summary",
    "fs"."created_at",
    "up"."name" AS "user_name",
    "up"."email" AS "user_email",
    "cm"."company_id"
   FROM (("public"."feedback_summaries" "fs"
     JOIN "public"."user_profiles" "up" ON (("fs"."user_id" = "up"."id")))
     JOIN "public"."company_members" "cm" ON (("fs"."user_id" = "cm"."id")));


ALTER TABLE "public"."feedback_summaries_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_user_identities" (
    "id" "uuid" NOT NULL,
    "identity_type" "text" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text"
);


ALTER TABLE "public"."feedback_user_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invited_users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "role" "public"."user_role" DEFAULT 'member'::"public"."user_role" NOT NULL,
    "company_id" "uuid",
    "invite_code" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "used_at" timestamp with time zone,
    "created_by" "uuid",
    "job_title" "text"
);


ALTER TABLE "public"."invited_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logs" (
    "id" integer NOT NULL,
    "action" "text" NOT NULL,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."logs_id_seq" OWNED BY "public"."logs"."id";



CREATE TABLE IF NOT EXISTS "public"."manager_feedback_summaries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "manager_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "timeframe" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "feedback_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" NOT NULL
);


ALTER TABLE "public"."manager_feedback_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manager_relationships" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "member_id" "uuid",
    "manager_id" "uuid",
    "relationship_type" character varying(20) DEFAULT 'direct'::character varying,
    "company_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "invited_member_id" "uuid",
    "invited_manager_id" "uuid",
    CONSTRAINT "check_at_least_one_member" CHECK (((("member_id" IS NOT NULL) AND ("invited_member_id" IS NULL)) OR (("member_id" IS NULL) AND ("invited_member_id" IS NOT NULL)))),
    CONSTRAINT "check_manager_consistency" CHECK (((("manager_id" IS NOT NULL) AND ("invited_manager_id" IS NULL)) OR (("manager_id" IS NULL) AND ("invited_manager_id" IS NOT NULL)) OR (("manager_id" IS NULL) AND ("invited_manager_id" IS NULL))))
);


ALTER TABLE "public"."manager_relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "company_id" "uuid",
    "role" "public"."user_role" DEFAULT 'member'::"public"."user_role" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."pending_registrations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."org_structure" AS
 SELECT "u"."id",
    "cm"."role",
    ("p"."email")::character varying AS "email",
    "cm"."company_id",
    false AS "is_invited",
    false AS "is_pending",
    COALESCE("mr"."manager_id", "imr"."id") AS "manager_id",
    COALESCE("mr"."relationship_type", 'direct'::character varying) AS "relationship_type"
   FROM (((("auth"."users" "u"
     JOIN "public"."company_members" "cm" ON (("u"."id" = "cm"."id")))
     LEFT JOIN "public"."user_profiles" "p" ON (("u"."id" = "p"."id")))
     LEFT JOIN ( SELECT DISTINCT ON ("manager_relationships"."member_id", "manager_relationships"."company_id") "manager_relationships"."member_id",
            "manager_relationships"."manager_id",
            "manager_relationships"."company_id",
            "manager_relationships"."relationship_type",
            "manager_relationships"."invited_manager_id"
           FROM "public"."manager_relationships"
          ORDER BY "manager_relationships"."member_id", "manager_relationships"."company_id", "manager_relationships"."updated_at" DESC) "mr" ON ((("u"."id" = "mr"."member_id") AND ("cm"."company_id" = "mr"."company_id"))))
     LEFT JOIN "public"."invited_users" "imr" ON (("mr"."invited_manager_id" = "imr"."id")))
  WHERE ("cm"."status" = 'active'::"public"."member_status")
UNION ALL
 SELECT "iu"."id",
    "iu"."role",
    ("iu"."email")::character varying AS "email",
    "iu"."company_id",
    true AS "is_invited",
    false AS "is_pending",
    COALESCE("mr"."manager_id", "imr"."id") AS "manager_id",
    COALESCE("mr"."relationship_type", 'direct'::character varying) AS "relationship_type"
   FROM (("public"."invited_users" "iu"
     LEFT JOIN ( SELECT DISTINCT ON ("manager_relationships"."invited_member_id", "manager_relationships"."company_id") "manager_relationships"."invited_member_id",
            "manager_relationships"."manager_id",
            "manager_relationships"."company_id",
            "manager_relationships"."relationship_type",
            "manager_relationships"."invited_manager_id"
           FROM "public"."manager_relationships"
          ORDER BY "manager_relationships"."invited_member_id", "manager_relationships"."company_id", "manager_relationships"."updated_at" DESC) "mr" ON ((("iu"."id" = "mr"."invited_member_id") AND ("iu"."company_id" = "mr"."company_id"))))
     LEFT JOIN "public"."invited_users" "imr" ON (("mr"."invited_manager_id" = "imr"."id")))
  WHERE (("iu"."status" = 'pending'::"text") AND (NOT (EXISTS ( SELECT 1
           FROM ("public"."company_members" "cm"
             JOIN "public"."user_profiles" "p" ON (("cm"."id" = "p"."id")))
          WHERE (("lower"("p"."email") = "lower"("iu"."email")) AND ("cm"."company_id" = "iu"."company_id"))))))
UNION ALL
 SELECT "pr"."user_id" AS "id",
    "pr"."role",
    ("pr"."email")::character varying AS "email",
    "pr"."company_id",
    false AS "is_invited",
    true AS "is_pending",
    COALESCE("mr"."manager_id", "imr"."id") AS "manager_id",
    COALESCE("mr"."relationship_type", 'direct'::character varying) AS "relationship_type"
   FROM (("public"."pending_registrations" "pr"
     LEFT JOIN ( SELECT DISTINCT ON ("manager_relationships"."member_id", "manager_relationships"."company_id") "manager_relationships"."member_id",
            "manager_relationships"."manager_id",
            "manager_relationships"."company_id",
            "manager_relationships"."relationship_type",
            "manager_relationships"."invited_manager_id"
           FROM "public"."manager_relationships"
          ORDER BY "manager_relationships"."member_id", "manager_relationships"."company_id", "manager_relationships"."updated_at" DESC) "mr" ON ((("pr"."user_id" = "mr"."member_id") AND ("pr"."company_id" = "mr"."company_id"))))
     LEFT JOIN "public"."invited_users" "imr" ON (("mr"."invited_manager_id" = "imr"."id")))
  WHERE (("pr"."status" = 'pending'::"text") AND ("pr"."processed_at" IS NULL) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."company_members" "cm"
          WHERE (("cm"."id" = "pr"."user_id") AND ("cm"."company_id" = "pr"."company_id"))))) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."invited_users" "iu"
          WHERE (("lower"("iu"."email") = "lower"("pr"."email")) AND ("iu"."company_id" = "pr"."company_id"))))));


ALTER TABLE "public"."org_structure" OWNER TO "postgres";


ALTER TABLE ONLY "public"."debug_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."debug_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."auth_tokens"
    ADD CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_tokens"
    ADD CONSTRAINT "auth_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_values"
    ADD CONSTRAINT "company_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debug_logs"
    ADD CONSTRAINT "debug_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."demo_leads"
    ADD CONSTRAINT "demo_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_cycle_occurrences"
    ADD CONSTRAINT "feedback_cycle_occurrences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_cycles"
    ADD CONSTRAINT "feedback_cycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_questions"
    ADD CONSTRAINT "feedback_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_recipients"
    ADD CONSTRAINT "feedback_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_responses"
    ADD CONSTRAINT "feedback_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_sessions"
    ADD CONSTRAINT "feedback_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_summaries"
    ADD CONSTRAINT "feedback_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_user_identities"
    ADD CONSTRAINT "feedback_user_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invited_users"
    ADD CONSTRAINT "invited_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."invited_users"
    ADD CONSTRAINT "invited_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manager_feedback_summaries"
    ADD CONSTRAINT "manager_feedback_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manager_relationships"
    ADD CONSTRAINT "manager_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "one_company_per_user" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_registrations"
    ADD CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_registrations"
    ADD CONSTRAINT "pending_registrations_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "auth_tokens_token_idx" ON "public"."auth_tokens" USING "btree" ("token");



CREATE INDEX "demo_leads_email_idx" ON "public"."demo_leads" USING "btree" ("email");



CREATE INDEX "idx_companies_domains" ON "public"."companies" USING "gin" ("domains");



CREATE INDEX "idx_company_members_company_id" ON "public"."company_members" USING "btree" ("company_id");



CREATE INDEX "idx_company_values_company_id" ON "public"."company_values" USING "btree" ("company_id");



CREATE INDEX "idx_feedback_cycle_occurrences_cycle_id" ON "public"."feedback_cycle_occurrences" USING "btree" ("cycle_id");



CREATE INDEX "idx_feedback_cycle_occurrences_status" ON "public"."feedback_cycle_occurrences" USING "btree" ("status");



CREATE INDEX "idx_feedback_cycles_company_id" ON "public"."feedback_cycles" USING "btree" ("company_id");



CREATE INDEX "idx_feedback_questions_company_value_id" ON "public"."feedback_questions" USING "btree" ("company_value_id");



CREATE INDEX "idx_feedback_recipients_session_id" ON "public"."feedback_recipients" USING "btree" ("session_id");



CREATE INDEX "idx_feedback_responses_nominated_user_id" ON "public"."feedback_responses" USING "btree" ("nominated_user_id");



CREATE INDEX "idx_feedback_sessions_occurrence_id" ON "public"."feedback_sessions" USING "btree" ("occurrence_id");



CREATE INDEX "idx_feedback_sessions_provider_id" ON "public"."feedback_sessions" USING "btree" ("provider_id");



CREATE INDEX "idx_feedback_summaries_timeframe" ON "public"."feedback_summaries" USING "btree" ("timeframe");



CREATE INDEX "idx_feedback_summaries_user_id" ON "public"."feedback_summaries" USING "btree" ("user_id");



CREATE INDEX "idx_manager_feedback_summaries_employee_id" ON "public"."manager_feedback_summaries" USING "btree" ("employee_id");



CREATE INDEX "idx_manager_feedback_summaries_manager_id" ON "public"."manager_feedback_summaries" USING "btree" ("manager_id");



CREATE INDEX "idx_manager_feedback_summaries_timeframe" ON "public"."manager_feedback_summaries" USING "btree" ("timeframe");



CREATE INDEX "idx_manager_feedback_summaries_type" ON "public"."manager_feedback_summaries" USING "btree" ("type");



CREATE INDEX "idx_manager_relationships_combined" ON "public"."manager_relationships" USING "btree" ("company_id", "member_id", "manager_id");



CREATE INDEX "idx_manager_relationships_company_id" ON "public"."manager_relationships" USING "btree" ("company_id");



CREATE INDEX "idx_manager_relationships_manager_id" ON "public"."manager_relationships" USING "btree" ("manager_id");



CREATE INDEX "idx_manager_relationships_member_id" ON "public"."manager_relationships" USING "btree" ("member_id");



CREATE INDEX "user_profiles_email_idx" ON "public"."user_profiles" USING "btree" ("email");



CREATE OR REPLACE TRIGGER "create_company_member_trigger" AFTER UPDATE ON "public"."pending_registrations" FOR EACH ROW WHEN ((("old"."status" = 'pending'::"text") AND ("new"."status" = 'processed'::"text"))) EXECUTE FUNCTION "public"."create_company_member_after_verification"();



CREATE OR REPLACE TRIGGER "pending_registration_created" AFTER INSERT ON "public"."pending_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."maintain_manager_relationships"();



CREATE OR REPLACE TRIGGER "pending_registration_processed" AFTER UPDATE ON "public"."pending_registrations" FOR EACH ROW WHEN ((("old"."status" = 'pending'::"text") AND ("new"."status" = 'processed'::"text"))) EXECUTE FUNCTION "public"."maintain_manager_relationships"();



CREATE OR REPLACE TRIGGER "trg_migrate_invited_user_feedback" AFTER INSERT ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."migrate_invited_user_feedback"();



CREATE OR REPLACE TRIGGER "update_company_members_updated_at" BEFORE UPDATE ON "public"."company_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_company_values_updated_at" BEFORE UPDATE ON "public"."company_values" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_feedback_cycle_occurrences_updated_at" BEFORE UPDATE ON "public"."feedback_cycle_occurrences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."auth_tokens"
    ADD CONSTRAINT "auth_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."feedback_sessions"("id");



ALTER TABLE ONLY "public"."auth_tokens"
    ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."company_members"("id");



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_id_fkey1" FOREIGN KEY ("id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_values"
    ADD CONSTRAINT "company_values_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_cycle_occurrences"
    ADD CONSTRAINT "feedback_cycle_occurrences_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."feedback_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_cycles"
    ADD CONSTRAINT "feedback_cycles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."feedback_questions"
    ADD CONSTRAINT "feedback_questions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."feedback_questions"
    ADD CONSTRAINT "feedback_questions_company_value_id_fkey" FOREIGN KEY ("company_value_id") REFERENCES "public"."company_values"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedback_recipients"
    ADD CONSTRAINT "feedback_recipients_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."feedback_user_identities"("id");



ALTER TABLE ONLY "public"."feedback_recipients"
    ADD CONSTRAINT "feedback_recipients_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."feedback_sessions"("id");



ALTER TABLE ONLY "public"."feedback_responses"
    ADD CONSTRAINT "feedback_responses_nominated_user_id_fkey" FOREIGN KEY ("nominated_user_id") REFERENCES "public"."feedback_user_identities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedback_responses"
    ADD CONSTRAINT "feedback_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."feedback_questions"("id");



ALTER TABLE ONLY "public"."feedback_responses"
    ADD CONSTRAINT "feedback_responses_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."feedback_recipients"("id");



ALTER TABLE ONLY "public"."feedback_responses"
    ADD CONSTRAINT "feedback_responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."feedback_sessions"("id");



ALTER TABLE ONLY "public"."feedback_sessions"
    ADD CONSTRAINT "feedback_sessions_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."feedback_cycles"("id");



ALTER TABLE ONLY "public"."feedback_sessions"
    ADD CONSTRAINT "feedback_sessions_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "public"."feedback_cycle_occurrences"("id");



ALTER TABLE ONLY "public"."feedback_sessions"
    ADD CONSTRAINT "feedback_sessions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."company_members"("id");



ALTER TABLE ONLY "public"."feedback_summaries"
    ADD CONSTRAINT "feedback_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."company_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invited_users"
    ADD CONSTRAINT "invited_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_feedback_summaries"
    ADD CONSTRAINT "manager_feedback_summaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."company_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_feedback_summaries"
    ADD CONSTRAINT "manager_feedback_summaries_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."company_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_relationships"
    ADD CONSTRAINT "manager_relationships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_relationships"
    ADD CONSTRAINT "manager_relationships_invited_manager_id_fkey" FOREIGN KEY ("invited_manager_id") REFERENCES "public"."invited_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."manager_relationships"
    ADD CONSTRAINT "manager_relationships_invited_member_id_fkey" FOREIGN KEY ("invited_member_id") REFERENCES "public"."invited_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_relationships"
    ADD CONSTRAINT "manager_relationships_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."manager_relationships"
    ADD CONSTRAINT "manager_relationships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_registrations"
    ADD CONSTRAINT "pending_registrations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete feedback cycles" ON "public"."feedback_cycles" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."company_id" = "feedback_cycles"."company_id") AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "Admins can insert feedback cycles" ON "public"."feedback_cycles" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."company_id" = "feedback_cycles"."company_id") AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "Admins can manage company" ON "public"."companies" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."company_id" = "companies"."id") AND ("cm"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."company_id" = "companies"."id") AND ("cm"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update any member status" ON "public"."company_members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_members" "admin_check"
  WHERE (("admin_check"."id" = "auth"."uid"()) AND ("admin_check"."company_id" = "company_members"."company_id") AND ("admin_check"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_members" "admin_check"
  WHERE (("admin_check"."id" = "auth"."uid"()) AND ("admin_check"."company_id" = "company_members"."company_id") AND ("admin_check"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update feedback cycles" ON "public"."feedback_cycles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."company_id" = "feedback_cycles"."company_id") AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."company_id" = "feedback_cycles"."company_id") AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "Admins create company values" ON "public"."company_values" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "Admins delete company values" ON "public"."company_values" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "Admins delete feedback questions" ON "public"."feedback_questions" FOR DELETE TO "authenticated" USING ((("scope" = 'company'::"text") AND ("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status"))))));



CREATE POLICY "Admins manage feedback cycle occurrences" ON "public"."feedback_cycle_occurrences" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."feedback_cycles" "fc"
     JOIN "public"."company_members" "cm" ON (("fc"."company_id" = "cm"."company_id")))
  WHERE (("feedback_cycle_occurrences"."cycle_id" = "fc"."id") AND ("cm"."id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."feedback_cycles" "fc"
     JOIN "public"."company_members" "cm" ON (("fc"."company_id" = "cm"."company_id")))
  WHERE (("feedback_cycle_occurrences"."cycle_id" = "fc"."id") AND ("cm"."id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "Admins manage feedback questions" ON "public"."feedback_questions" FOR INSERT TO "authenticated" WITH CHECK ((("scope" = 'company'::"text") AND ("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status"))))));



CREATE POLICY "Admins manage manager relationships" ON "public"."manager_relationships" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."company_id" = "manager_relationships"."company_id") AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."company_id" = "manager_relationships"."company_id") AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "Admins update company values" ON "public"."company_values" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status"))))) WITH CHECK (("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "Admins update feedback questions" ON "public"."feedback_questions" FOR UPDATE TO "authenticated" USING ((("scope" = 'company'::"text") AND ("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status")))))) WITH CHECK ((("scope" = 'company'::"text") AND ("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status"))))));



CREATE POLICY "Allow unregistered users to create companies" ON "public"."companies" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow updating companies during registration flow" ON "public"."companies" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow users to check company domains" ON "public"."companies" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow users to create companies during registration" ON "public"."companies" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Anyone can insert a demo lead" ON "public"."demo_leads" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Authenticated users can create feedback questions of type 'ai'" ON "public"."feedback_questions" FOR INSERT TO "authenticated" WITH CHECK (("question_type" = 'ai'::"text"));



CREATE POLICY "Authenticated users can view logs" ON "public"."logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Create/update responses" ON "public"."feedback_responses" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."feedback_sessions" "fs"
  WHERE (("feedback_responses"."session_id" = "fs"."id") AND ("fs"."provider_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Managers view direct reports as recipients" ON "public"."feedback_recipients" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."feedback_user_identities" "fui"
     JOIN "public"."manager_relationships" "mr" ON (("fui"."id" = "mr"."member_id")))
  WHERE (("feedback_recipients"."recipient_id" = "fui"."id") AND ("mr"."manager_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view their company" ON "public"."companies" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "company_members"."company_id"
   FROM "public"."company_members"
  WHERE ("company_members"."id" = "auth"."uid"()))));



CREATE POLICY "Verify invite code" ON "public"."invited_users" FOR SELECT TO "anon" USING (("invite_code" IS NOT NULL));



CREATE POLICY "View assigned feedback tasks" ON "public"."feedback_recipients" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."feedback_sessions" "fs"
  WHERE (("feedback_recipients"."session_id" = "fs"."id") AND ("fs"."provider_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "View company members" ON "public"."company_members" FOR SELECT TO "authenticated" USING (("company_id" = ( SELECT "public"."get_user_company_id"() AS "get_user_company_id")));



CREATE POLICY "View company values" ON "public"."company_values" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "View cycles in company" ON "public"."feedback_cycles" FOR SELECT TO "authenticated" USING (("company_id" = ( SELECT "cm"."company_id"
   FROM "public"."company_members" "cm"
  WHERE ("cm"."id" = "auth"."uid"()))));



CREATE POLICY "View feedback cycle occurrences" ON "public"."feedback_cycle_occurrences" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."feedback_cycles" "fc"
     JOIN "public"."company_members" "cm" ON (("fc"."company_id" = "cm"."company_id")))
  WHERE (("feedback_cycle_occurrences"."cycle_id" = "fc"."id") AND ("cm"."id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "View feedback provided" ON "public"."feedback_responses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."feedback_sessions" "fs"
  WHERE (("feedback_responses"."session_id" = "fs"."id") AND ("fs"."provider_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "View feedback questions" ON "public"."feedback_questions" FOR SELECT TO "authenticated" USING ((("scope" = 'global'::"text") OR (("scope" = 'company'::"text") AND ("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"public"."member_status")))))));



CREATE POLICY "View identities in company" ON "public"."feedback_user_identities" FOR SELECT TO "authenticated" USING (("company_id" = ( SELECT "cm"."company_id"
   FROM "public"."company_members" "cm"
  WHERE ("cm"."id" = "auth"."uid"()))));



CREATE POLICY "View invited users" ON "public"."invited_users" FOR SELECT TO "authenticated" USING (("company_id" = ( SELECT "public"."get_user_company_id"() AS "get_user_company_id")));



CREATE POLICY "View own company member record" ON "public"."company_members" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "View own provided responses" ON "public"."feedback_responses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."feedback_sessions" "fs"
  WHERE (("feedback_responses"."session_id" = "fs"."id") AND ("fs"."provider_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "View relationships" ON "public"."manager_relationships" FOR SELECT TO "authenticated" USING (("company_id" = ( SELECT "public"."get_user_company_id"() AS "get_user_company_id")));



CREATE POLICY "View self as recipient" ON "public"."feedback_recipients" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."feedback_user_identities" "fui"
  WHERE (("feedback_recipients"."recipient_id" = "fui"."id") AND ("fui"."id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "admin_delete_feedback_user_identities" ON "public"."feedback_user_identities" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."id" = "auth"."uid"()) AND ("company_members"."company_id" = "feedback_user_identities"."company_id") AND ("company_members"."role" = 'admin'::"public"."user_role") AND ("company_members"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "admin_feedback_recipients" ON "public"."feedback_recipients" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."feedback_sessions" "fs"
     JOIN "public"."feedback_cycles" "fc" ON (("fs"."cycle_id" = "fc"."id")))
     JOIN "public"."company_members" "cm" ON (("fc"."company_id" = "cm"."company_id")))
  WHERE (("feedback_recipients"."session_id" = "fs"."id") AND ("cm"."id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "admin_feedback_responses" ON "public"."feedback_responses" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."feedback_sessions" "fs"
     JOIN "public"."feedback_cycles" "fc" ON (("fs"."cycle_id" = "fc"."id")))
     JOIN "public"."company_members" "cm" ON (("fc"."company_id" = "cm"."company_id")))
  WHERE (("feedback_responses"."session_id" = "fs"."id") AND ("cm"."id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "admin_feedback_sessions" ON "public"."feedback_sessions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."feedback_cycles" "fc"
     JOIN "public"."company_members" "cm" ON (("fc"."company_id" = "cm"."company_id")))
  WHERE (("feedback_sessions"."cycle_id" = "fc"."id") AND ("cm"."id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "admin_feedback_user_identities" ON "public"."feedback_user_identities" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."id" = "auth"."uid"()) AND ("company_members"."company_id" = "feedback_user_identities"."company_id") AND ("company_members"."role" = 'admin'::"public"."user_role") AND ("company_members"."status" = 'active'::"public"."member_status"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."id" = "auth"."uid"()) AND ("company_members"."company_id" = "feedback_user_identities"."company_id") AND ("company_members"."role" = 'admin'::"public"."user_role") AND ("company_members"."status" = 'active'::"public"."member_status")))));



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_values" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "create_feedback_user_identities" ON "public"."feedback_user_identities" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "company_members"."company_id"
   FROM "public"."company_members"
  WHERE (("company_members"."id" = "auth"."uid"()) AND ("company_members"."status" = 'active'::"public"."member_status")))));



ALTER TABLE "public"."debug_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."demo_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_cycle_occurrences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_cycles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_user_identities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_feedback_sessions" ON "public"."feedback_sessions" FOR INSERT TO "authenticated" WITH CHECK ((("provider_id" = "auth"."uid"()) AND ("cycle_id" IN ( SELECT "fc"."id"
   FROM ("public"."feedback_cycles" "fc"
     JOIN "public"."company_members" "cm" ON (("fc"."company_id" = "cm"."company_id")))
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"public"."member_status"))))));



CREATE POLICY "insert_own_profile" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "insert_own_summaries" ON "public"."feedback_summaries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."invited_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manage_manager_relationships" ON "public"."manager_relationships" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."company_id" = "manager_relationships"."company_id") AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."company_id" = "manager_relationships"."company_id") AND ("cm"."role" = 'admin'::"public"."user_role") AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "manage_own_feedback_recipients" ON "public"."feedback_recipients" TO "authenticated" USING (("session_id" IN ( SELECT "feedback_sessions"."id"
   FROM "public"."feedback_sessions"
  WHERE ("feedback_sessions"."provider_id" = "auth"."uid"())))) WITH CHECK (("session_id" IN ( SELECT "feedback_sessions"."id"
   FROM "public"."feedback_sessions"
  WHERE ("feedback_sessions"."provider_id" = "auth"."uid"()))));



CREATE POLICY "manage_own_feedback_responses" ON "public"."feedback_responses" TO "authenticated" USING (("session_id" IN ( SELECT "feedback_sessions"."id"
   FROM "public"."feedback_sessions"
  WHERE ("feedback_sessions"."provider_id" = "auth"."uid"())))) WITH CHECK (("session_id" IN ( SELECT "feedback_sessions"."id"
   FROM "public"."feedback_sessions"
  WHERE ("feedback_sessions"."provider_id" = "auth"."uid"()))));



ALTER TABLE "public"."manager_relationships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manager_view_team_feedback_recipients" ON "public"."feedback_recipients" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."feedback_user_identities" "fui"
     JOIN "public"."manager_relationships" "mr" ON (("fui"."id" = "mr"."member_id")))
  WHERE (("feedback_recipients"."recipient_id" = "fui"."id") AND ("mr"."manager_id" = "auth"."uid"()) AND (("mr"."relationship_type")::"text" = 'direct'::"text")))));



CREATE POLICY "manager_view_team_feedback_responses" ON "public"."feedback_responses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."feedback_recipients" "fr"
     JOIN "public"."feedback_user_identities" "fui" ON (("fr"."recipient_id" = "fui"."id")))
     JOIN "public"."manager_relationships" "mr" ON (("fui"."id" = "mr"."member_id")))
  WHERE (("feedback_responses"."recipient_id" = "fr"."id") AND ("mr"."manager_id" = "auth"."uid"()) AND (("mr"."relationship_type")::"text" = 'direct'::"text")))));



ALTER TABLE "public"."pending_registrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_bypass" ON "public"."company_values" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."feedback_questions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."feedback_user_identities" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."invited_users" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."pending_registrations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "update_feedback_sessions" ON "public"."feedback_sessions" FOR UPDATE TO "authenticated" USING (("provider_id" = "auth"."uid"())) WITH CHECK (("provider_id" = "auth"."uid"()));



CREATE POLICY "update_own_profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "view_feedback_recipients" ON "public"."feedback_recipients" FOR SELECT TO "authenticated" USING (("session_id" IN ( SELECT "fs"."id"
   FROM (("public"."feedback_sessions" "fs"
     JOIN "public"."feedback_cycles" "fc" ON (("fs"."cycle_id" = "fc"."id")))
     JOIN "public"."company_members" "cm" ON (("fc"."company_id" = "cm"."company_id")))
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "view_feedback_sessions" ON "public"."feedback_sessions" FOR SELECT TO "authenticated" USING (("cycle_id" IN ( SELECT "fc"."id"
   FROM ("public"."feedback_cycles" "fc"
     JOIN "public"."company_members" "cm" ON (("fc"."company_id" = "cm"."company_id")))
  WHERE (("cm"."id" = "auth"."uid"()) AND ("cm"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "view_feedback_user_identities" ON "public"."feedback_user_identities" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "company_members"."company_id"
   FROM "public"."company_members"
  WHERE (("company_members"."id" = "auth"."uid"()) AND ("company_members"."status" = 'active'::"public"."member_status")))));



CREATE POLICY "view_own_summaries" ON "public"."feedback_summaries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "view_provided_feedback_responses" ON "public"."feedback_responses" FOR SELECT TO "authenticated" USING (("session_id" IN ( SELECT "feedback_sessions"."id"
   FROM "public"."feedback_sessions"
  WHERE ("feedback_sessions"."provider_id" = "auth"."uid"()))));



CREATE POLICY "view_received_feedback_responses" ON "public"."feedback_responses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."feedback_recipients" "fr"
     JOIN "public"."feedback_user_identities" "fui" ON (("fr"."recipient_id" = "fui"."id")))
  WHERE (("feedback_responses"."recipient_id" = "fr"."id") AND ("fui"."id" = "auth"."uid"())))));



CREATE POLICY "view_user_profiles" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";












































































































































































































GRANT ALL ON FUNCTION "public"."admin_create_user_profiles"("admin_id" "uuid", "company_id" "uuid", "users_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_create_user_profiles"("admin_id" "uuid", "company_id" "uuid", "users_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_create_user_profiles"("admin_id" "uuid", "company_id" "uuid", "users_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_team_member"("member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_team_member"("member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_team_member"("member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_feedback_response"("response_recipient_id" "uuid", "viewer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_feedback_response"("response_recipient_id" "uuid", "viewer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_feedback_response"("response_recipient_id" "uuid", "viewer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_account_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_account_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_account_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_company_member_after_verification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_company_member_after_verification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_company_member_after_verification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_initial_occurrence"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_initial_occurrence"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_initial_occurrence"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_next_occurrence"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_next_occurrence"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_next_occurrence"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_profile"("user_id" "uuid", "user_email" "text", "user_name" "text", "user_job_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_profile"("user_id" "uuid", "user_email" "text", "user_name" "text", "user_job_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_profile"("user_id" "uuid", "user_email" "text", "user_name" "text", "user_job_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."deactivate_team_member"("member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."deactivate_team_member"("member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deactivate_team_member"("member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_manager_assignment"("manager_id_param" "uuid", "member_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."debug_manager_assignment"("manager_id_param" "uuid", "member_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_manager_assignment"("manager_id_param" "uuid", "member_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_company"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_company"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_company"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_functions"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_functions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_functions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_deactivated_users_by_emails"("p_company_id" "uuid", "p_emails" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_deactivated_users_by_emails"("p_company_id" "uuid", "p_emails" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_deactivated_users_by_emails"("p_company_id" "uuid", "p_emails" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_member_status_enum"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_member_status_enum"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_member_status_enum"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_nominee_name"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_nominee_name"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nominee_name"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_top_value_nominees"("company_value_id_param" "uuid", "limit_param" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_top_value_nominees"("company_value_id_param" "uuid", "limit_param" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top_value_nominees"("company_value_id_param" "uuid", "limit_param" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_company_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_company_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_company_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_confirmed_registration"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_confirmed_registration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_confirmed_registration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_with_rls_bypass"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_with_rls_bypass"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_with_rls_bypass"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_user_email_verification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_email_verification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_email_verification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_user_profile_merge"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_profile_merge"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_profile_merge"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("company_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("company_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("company_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_manager_of"("member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_manager_of"("member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_manager_of"("member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_user"("user_id" "uuid", "company_id" "uuid", "user_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."link_user"("user_id" "uuid", "company_id" "uuid", "user_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_user"("user_id" "uuid", "company_id" "uuid", "user_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_user_to_company"("user_id" "uuid", "company_id" "uuid", "user_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."link_user_to_company"("user_id" "uuid", "company_id" "uuid", "user_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_user_to_company"("user_id" "uuid", "company_id" "uuid", "user_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."maintain_manager_relationships"() TO "anon";
GRANT ALL ON FUNCTION "public"."maintain_manager_relationships"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."maintain_manager_relationships"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_invited_user_feedback"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_invited_user_feedback"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_invited_user_feedback"() TO "service_role";



GRANT ALL ON PROCEDURE "public"."setup_standard_rls"(IN "table_name" "text") TO "anon";
GRANT ALL ON PROCEDURE "public"."setup_standard_rls"(IN "table_name" "text") TO "authenticated";
GRANT ALL ON PROCEDURE "public"."setup_standard_rls"(IN "table_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_manager_relationships"("invited_user_id" "uuid", "auth_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_manager_relationships"("invited_user_id" "uuid", "auth_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_manager_relationships"("invited_user_id" "uuid", "auth_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_user_profile_info"("invited_user_id" "uuid", "auth_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_user_profile_info"("invited_user_id" "uuid", "auth_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_user_profile_info"("invited_user_id" "uuid", "auth_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;


















GRANT ALL ON TABLE "public"."auth_tokens" TO "anon";
GRANT ALL ON TABLE "public"."auth_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_members" TO "anon";
GRANT ALL ON TABLE "public"."company_members" TO "authenticated";
GRANT ALL ON TABLE "public"."company_members" TO "service_role";



GRANT ALL ON TABLE "public"."company_values" TO "anon";
GRANT ALL ON TABLE "public"."company_values" TO "authenticated";
GRANT ALL ON TABLE "public"."company_values" TO "service_role";



GRANT ALL ON TABLE "public"."debug_logs" TO "anon";
GRANT ALL ON TABLE "public"."debug_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."debug_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."debug_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."debug_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."debug_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."demo_leads" TO "anon";
GRANT ALL ON TABLE "public"."demo_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."demo_leads" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_cycle_occurrences" TO "anon";
GRANT ALL ON TABLE "public"."feedback_cycle_occurrences" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_cycle_occurrences" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_cycles" TO "anon";
GRANT ALL ON TABLE "public"."feedback_cycles" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_cycles" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_questions" TO "anon";
GRANT ALL ON TABLE "public"."feedback_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_questions" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_recipients" TO "anon";
GRANT ALL ON TABLE "public"."feedback_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_recipients" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_responses" TO "anon";
GRANT ALL ON TABLE "public"."feedback_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_responses" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_sessions" TO "anon";
GRANT ALL ON TABLE "public"."feedback_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_summaries" TO "anon";
GRANT ALL ON TABLE "public"."feedback_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_summaries_view" TO "anon";
GRANT ALL ON TABLE "public"."feedback_summaries_view" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_summaries_view" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_user_identities" TO "anon";
GRANT ALL ON TABLE "public"."feedback_user_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_user_identities" TO "service_role";



GRANT ALL ON TABLE "public"."invited_users" TO "anon";
GRANT ALL ON TABLE "public"."invited_users" TO "authenticated";
GRANT ALL ON TABLE "public"."invited_users" TO "service_role";



GRANT ALL ON TABLE "public"."logs" TO "anon";
GRANT ALL ON TABLE "public"."logs" TO "authenticated";
GRANT ALL ON TABLE "public"."logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."manager_feedback_summaries" TO "anon";
GRANT ALL ON TABLE "public"."manager_feedback_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."manager_feedback_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."manager_relationships" TO "anon";
GRANT ALL ON TABLE "public"."manager_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."manager_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."pending_registrations" TO "anon";
GRANT ALL ON TABLE "public"."pending_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."org_structure" TO "anon";
GRANT ALL ON TABLE "public"."org_structure" TO "authenticated";
GRANT ALL ON TABLE "public"."org_structure" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
