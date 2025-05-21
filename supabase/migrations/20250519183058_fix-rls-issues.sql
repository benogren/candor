-- Fix the get_user_company_id function to prevent recursion
CREATE OR REPLACE FUNCTION public.get_user_company_id()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  company_id_val uuid;
BEGIN
  SELECT cm.company_id INTO company_id_val
  FROM company_members cm
  WHERE cm.id = auth.uid()
  AND cm.status = 'active';
  
  -- Return NULL instead of raising an exception
  RETURN company_id_val;
END;
$function$;

-- Add missing service_role_bypass policy for company_members
DROP POLICY IF EXISTS "service_role_bypass" ON public.company_members;
CREATE POLICY "service_role_bypass" 
ON public.company_members
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);