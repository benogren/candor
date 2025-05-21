-- PART 1: Enable Row Level Security on all tables

ALTER TABLE public.feedback_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invited_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron.job_run_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron.job ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_user_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_cycle_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

-- PART 2: Create Policies

-- Create policies for cron.job
CREATE POLICY "cron_job_policy" ON cron.job 
FOR ALL TO authenticated 
USING (username = CURRENT_USER);

-- Create policies for cron.job_run_details
CREATE POLICY "cron_job_run_details_policy" ON cron.job_run_details 
FOR ALL TO authenticated 
USING (username = CURRENT_USER);

-- Create policies for public.companies
CREATE POLICY "Admins can manage company" ON public.companies 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.company_id = companies.id) AND (cm.role = 'admin'::user_role)))) 
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.company_id = companies.id) AND (cm.role = 'admin'::user_role))));

CREATE POLICY "Allow unregistered users to create companies" ON public.companies 
FOR INSERT TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow updating companies during registration flow" ON public.companies 
FOR UPDATE TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow users to check company domains" ON public.companies 
FOR SELECT TO authenticated 
USING (true);

CREATE POLICY "Allow users to create companies during registration" ON public.companies 
FOR INSERT TO authenticated 
WITH CHECK (true);

CREATE POLICY "Users can view their company" ON public.companies 
FOR SELECT TO authenticated 
USING (id IN (SELECT company_members.company_id FROM company_members WHERE (company_members.id = auth.uid())));

-- Create policies for public.company_members
CREATE POLICY "Admins can update any member status" ON public.company_members 
FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM company_members admin_check WHERE ((admin_check.id = auth.uid()) AND (admin_check.company_id = company_members.company_id) AND (admin_check.role = 'admin'::user_role)))) 
WITH CHECK (EXISTS (SELECT 1 FROM company_members admin_check WHERE ((admin_check.id = auth.uid()) AND (admin_check.company_id = company_members.company_id) AND (admin_check.role = 'admin'::user_role))));

CREATE POLICY "View company members" ON public.company_members 
FOR SELECT TO authenticated 
USING (company_id = (SELECT get_user_company_id() AS get_user_company_id));

CREATE POLICY "View own company member record" ON public.company_members 
FOR SELECT TO authenticated 
USING (id = auth.uid());

-- Create policies for public.company_values
CREATE POLICY "Admins create company values" ON public.company_values 
FOR INSERT TO authenticated 
WITH CHECK (company_id IN (SELECT cm.company_id FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))));

CREATE POLICY "Admins delete company values" ON public.company_values 
FOR DELETE TO authenticated 
USING (company_id IN (SELECT cm.company_id FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))));

CREATE POLICY "Admins update company values" ON public.company_values 
FOR UPDATE TO authenticated 
USING (company_id IN (SELECT cm.company_id FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))) 
WITH CHECK (company_id IN (SELECT cm.company_id FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))));

CREATE POLICY "View company values" ON public.company_values 
FOR SELECT TO authenticated 
USING (company_id IN (SELECT cm.company_id FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status))));

CREATE POLICY "service_role_bypass" ON public.company_values 
FOR ALL TO service_role 
USING (true) 
WITH CHECK (true);

-- Create policies for public.demo_leads
CREATE POLICY "Anyone can insert a demo lead" ON public.demo_leads 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- Create policies for public.feedback_cycle_occurrences
CREATE POLICY "Admins manage feedback cycle occurrences" ON public.feedback_cycle_occurrences 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM (feedback_cycles fc JOIN company_members cm ON ((fc.company_id = cm.company_id))) WHERE ((feedback_cycle_occurrences.cycle_id = fc.id) AND (cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))) 
WITH CHECK (EXISTS (SELECT 1 FROM (feedback_cycles fc JOIN company_members cm ON ((fc.company_id = cm.company_id))) WHERE ((feedback_cycle_occurrences.cycle_id = fc.id) AND (cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))));

CREATE POLICY "View feedback cycle occurrences" ON public.feedback_cycle_occurrences 
FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM (feedback_cycles fc JOIN company_members cm ON ((fc.company_id = cm.company_id))) WHERE ((feedback_cycle_occurrences.cycle_id = fc.id) AND (cm.id = auth.uid()) AND (cm.status = 'active'::member_status))));

-- Create policies for public.feedback_cycles
CREATE POLICY "Admins can delete feedback cycles" ON public.feedback_cycles 
FOR DELETE TO authenticated 
USING (EXISTS (SELECT 1 FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.company_id = feedback_cycles.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))));

CREATE POLICY "Admins can insert feedback cycles" ON public.feedback_cycles 
FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.company_id = feedback_cycles.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))));

CREATE POLICY "Admins can update feedback cycles" ON public.feedback_cycles 
FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.company_id = feedback_cycles.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))) 
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.company_id = feedback_cycles.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))));

CREATE POLICY "View cycles in company" ON public.feedback_cycles 
FOR SELECT TO authenticated 
USING (company_id = (SELECT cm.company_id FROM company_members cm WHERE (cm.id = auth.uid())));

-- Create policies for public.feedback_questions
CREATE POLICY "Admins delete feedback questions" ON public.feedback_questions 
FOR DELETE TO authenticated 
USING ((scope = 'company'::text) AND (company_id IN (SELECT cm.company_id FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));

CREATE POLICY "Admins manage feedback questions" ON public.feedback_questions 
FOR INSERT TO authenticated 
WITH CHECK ((scope = 'company'::text) AND (company_id IN (SELECT cm.company_id FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));

CREATE POLICY "Admins update feedback questions" ON public.feedback_questions 
FOR UPDATE TO authenticated 
USING ((scope = 'company'::text) AND (company_id IN (SELECT cm.company_id FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))))) 
WITH CHECK ((scope = 'company'::text) AND (company_id IN (SELECT cm.company_id FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));

CREATE POLICY "Authenticated users can create feedback questions of type 'ai'" ON public.feedback_questions 
FOR INSERT TO authenticated 
WITH CHECK (question_type = 'ai'::text);

CREATE POLICY "View feedback questions" ON public.feedback_questions 
FOR SELECT TO authenticated 
USING ((scope = 'global'::text) OR ((scope = 'company'::text) AND (company_id IN (SELECT cm.company_id FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status))))));

CREATE POLICY "service_role_bypass" ON public.feedback_questions 
FOR ALL TO service_role 
USING (true) 
WITH CHECK (true);

-- Create policies for public.feedback_recipients
CREATE POLICY "Managers view direct reports as recipients" ON public.feedback_recipients 
FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM (feedback_user_identities fui JOIN manager_relationships mr ON ((fui.id = mr.member_id))) WHERE ((feedback_recipients.recipient_id = fui.id) AND (mr.manager_id = (SELECT auth.uid() AS uid)))));

CREATE POLICY "View assigned feedback tasks" ON public.feedback_recipients 
FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM feedback_sessions fs WHERE ((feedback_recipients.session_id = fs.id) AND (fs.provider_id = (SELECT auth.uid() AS uid)))));

CREATE POLICY "View self as recipient" ON public.feedback_recipients 
FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM feedback_user_identities fui WHERE ((feedback_recipients.recipient_id = fui.id) AND (fui.id = (SELECT auth.uid() AS uid)))));

CREATE POLICY "admin_feedback_recipients" ON public.feedback_recipients 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM ((feedback_sessions fs JOIN feedback_cycles fc ON ((fs.cycle_id = fc.id))) JOIN company_members cm ON ((fc.company_id = cm.company_id))) WHERE ((feedback_recipients.session_id = fs.id) AND (cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))));

CREATE POLICY "manage_own_feedback_recipients" ON public.feedback_recipients 
FOR ALL TO authenticated 
USING (session_id IN (SELECT feedback_sessions.id FROM feedback_sessions WHERE (feedback_sessions.provider_id = auth.uid()))) 
WITH CHECK (session_id IN (SELECT feedback_sessions.id FROM feedback_sessions WHERE (feedback_sessions.provider_id = auth.uid())));

CREATE POLICY "manager_view_team_feedback_recipients" ON public.feedback_recipients 
FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM (feedback_user_identities fui JOIN manager_relationships mr ON ((fui.id = mr.member_id))) WHERE ((feedback_recipients.recipient_id = fui.id) AND (mr.manager_id = auth.uid()) AND ((mr.relationship_type)::text = 'direct'::text))));

CREATE POLICY "view_feedback_recipients" ON public.feedback_recipients 
FOR SELECT TO authenticated 
USING (session_id IN (SELECT fs.id FROM ((feedback_sessions fs JOIN feedback_cycles fc ON ((fs.cycle_id = fc.id))) JOIN company_members cm ON ((fc.company_id = cm.company_id))) WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status))));

-- Create policies for public.feedback_responses
CREATE POLICY "Create/update responses" ON public.feedback_responses 
FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM feedback_sessions fs WHERE ((feedback_responses.session_id = fs.id) AND (fs.provider_id = (SELECT auth.uid() AS uid)))));

CREATE POLICY "View feedback provided" ON public.feedback_responses 
FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM feedback_sessions fs WHERE ((feedback_responses.session_id = fs.id) AND (fs.provider_id = (SELECT auth.uid() AS uid)))));

CREATE POLICY "View own provided responses" ON public.feedback_responses 
FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM feedback_sessions fs WHERE ((feedback_responses.session_id = fs.id) AND (fs.provider_id = (SELECT auth.uid() AS uid)))));

CREATE POLICY "admin_feedback_responses" ON public.feedback_responses 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM ((feedback_sessions fs JOIN feedback_cycles fc ON ((fs.cycle_id = fc.id))) JOIN company_members cm ON ((fc.company_id = cm.company_id))) WHERE ((feedback_responses.session_id = fs.id) AND (cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))));

CREATE POLICY "manage_own_feedback_responses" ON public.feedback_responses 
FOR ALL TO authenticated 
USING (session_id IN (SELECT feedback_sessions.id FROM feedback_sessions WHERE (feedback_sessions.provider_id = auth.uid()))) 
WITH CHECK (session_id IN (SELECT feedback_sessions.id FROM feedback_sessions WHERE (feedback_sessions.provider_id = auth.uid())));

CREATE POLICY "manager_view_team_feedback_responses" ON public.feedback_responses 
FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM ((feedback_recipients fr JOIN feedback_user_identities fui ON ((fr.recipient_id = fui.id))) JOIN manager_relationships mr ON ((fui.id = mr.member_id))) WHERE ((feedback_responses.recipient_id = fr.id) AND (mr.manager_id = auth.uid()) AND ((mr.relationship_type)::text = 'direct'::text))));

CREATE POLICY "view_provided_feedback_responses" ON public.feedback_responses 
FOR SELECT TO authenticated 
USING (session_id IN (SELECT feedback_sessions.id FROM feedback_sessions WHERE (feedback_sessions.provider_id = auth.uid())));

CREATE POLICY "view_received_feedback_responses" ON public.feedback_responses 
FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM (feedback_recipients fr JOIN feedback_user_identities fui ON ((fr.recipient_id = fui.id))) WHERE ((feedback_responses.recipient_id = fr.id) AND (fui.id = auth.uid()))));

-- Create policies for public.feedback_sessions
CREATE POLICY "admin_feedback_sessions" ON public.feedback_sessions 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM (feedback_cycles fc JOIN company_members cm ON ((fc.company_id = cm.company_id))) WHERE ((feedback_sessions.cycle_id = fc.id) AND (cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))));

CREATE POLICY "insert_feedback_sessions" ON public.feedback_sessions 
FOR INSERT TO authenticated 
WITH CHECK ((provider_id = auth.uid()) AND (cycle_id IN (SELECT fc.id FROM (feedback_cycles fc JOIN company_members cm ON ((fc.company_id = cm.company_id))) WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status)))));

CREATE POLICY "update_feedback_sessions" ON public.feedback_sessions 
FOR UPDATE TO authenticated 
USING (provider_id = auth.uid()) 
WITH CHECK (provider_id = auth.uid());

CREATE POLICY "view_feedback_sessions" ON public.feedback_sessions 
FOR SELECT TO authenticated 
USING (cycle_id IN (SELECT fc.id FROM (feedback_cycles fc JOIN company_members cm ON ((fc.company_id = cm.company_id))) WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status))));

-- Create policies for public.feedback_summaries
CREATE POLICY "insert_own_summaries" ON public.feedback_summaries 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "view_own_summaries" ON public.feedback_summaries 
FOR SELECT TO authenticated 
USING (auth.uid() = user_id);

-- Create policies for public.feedback_user_identities
CREATE POLICY "View identities in company" ON public.feedback_user_identities 
FOR SELECT TO authenticated 
USING (company_id = (SELECT cm.company_id FROM company_members cm WHERE (cm.id = auth.uid())));

CREATE POLICY "admin_delete_feedback_user_identities" ON public.feedback_user_identities 
FOR DELETE TO authenticated 
USING (EXISTS (SELECT 1 FROM company_members WHERE ((company_members.id = auth.uid()) AND (company_members.company_id = feedback_user_identities.company_id) AND (company_members.role = 'admin'::user_role) AND (company_members.status = 'active'::member_status))));

CREATE POLICY "admin_feedback_user_identities" ON public.feedback_user_identities 
FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM company_members WHERE ((company_members.id = auth.uid()) AND (company_members.company_id = feedback_user_identities.company_id) AND (company_members.role = 'admin'::user_role) AND (company_members.status = 'active'::member_status)))) 
WITH CHECK (EXISTS (SELECT 1 FROM company_members WHERE ((company_members.id = auth.uid()) AND (company_members.company_id = feedback_user_identities.company_id) AND (company_members.role = 'admin'::user_role) AND (company_members.status = 'active'::member_status))));

CREATE POLICY "create_feedback_user_identities" ON public.feedback_user_identities 
FOR INSERT TO authenticated 
WITH CHECK (company_id IN (SELECT company_members.company_id FROM company_members WHERE ((company_members.id = auth.uid()) AND (company_members.status = 'active'::member_status))));

CREATE POLICY "service_role_bypass" ON public.feedback_user_identities 
FOR ALL TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "view_feedback_user_identities" ON public.feedback_user_identities 
FOR SELECT TO authenticated 
USING (company_id IN (SELECT company_members.company_id FROM company_members WHERE ((company_members.id = auth.uid()) AND (company_members.status = 'active'::member_status))));

-- Create policies for public.invited_users
CREATE POLICY "Verify invite code" ON public.invited_users 
FOR SELECT TO authenticated 
USING (invite_code IS NOT NULL);

CREATE POLICY "View invited users" ON public.invited_users 
FOR SELECT TO authenticated 
USING (company_id = (SELECT get_user_company_id() AS get_user_company_id));

CREATE POLICY "service_role_bypass" ON public.invited_users 
FOR ALL TO service_role 
USING (true) 
WITH CHECK (true);

-- Create policies for public.logs
CREATE POLICY "Authenticated users can view logs" ON public.logs 
FOR SELECT TO authenticated 
USING (true);

-- Create policies for public.manager_relationships
CREATE POLICY "Admins manage manager relationships" ON public.manager_relationships 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.company_id = manager_relationships.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))) 
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.company_id = manager_relationships.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))));

CREATE POLICY "View relationships" ON public.manager_relationships 
FOR SELECT TO authenticated 
USING (company_id = (SELECT get_user_company_id() AS get_user_company_id));

CREATE POLICY "manage_manager_relationships" ON public.manager_relationships 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.company_id = manager_relationships.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))) 
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE ((cm.id = auth.uid()) AND (cm.company_id = manager_relationships.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))));

-- Create policies for public.notes
CREATE POLICY "Users can delete their own notes" ON public.notes 
FOR DELETE TO authenticated 
USING (creator_id = auth.uid());

CREATE POLICY "Users can insert their own notes" ON public.notes 
FOR INSERT TO authenticated 
WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Users can update notes they created" ON public.notes 
FOR UPDATE TO authenticated 
USING (creator_id = auth.uid());

CREATE POLICY "Users can view notes they created or are about them" ON public.notes 
FOR SELECT TO authenticated 
USING ((creator_id = auth.uid()) OR (subject_member_id = auth.uid()));

-- Create policies for public.pending_registrations
CREATE POLICY "service_role_bypass" ON public.pending_registrations 
FOR ALL TO service_role 
USING (true) 
WITH CHECK (true);

-- Create policies for public.user_profiles
CREATE POLICY "insert_own_profile" ON public.user_profiles 
FOR INSERT TO authenticated 
WITH CHECK (id = auth.uid());

CREATE POLICY "update_own_profile" ON public.user_profiles 
FOR UPDATE TO authenticated 
USING (id = auth.uid()) 
WITH CHECK (id = auth.uid());

CREATE POLICY "view_user_profiles" ON public.user_profiles 
FOR SELECT TO authenticated 
USING (true);