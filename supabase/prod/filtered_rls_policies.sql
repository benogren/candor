  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('CREATE POLICY "admins_full_access" ON %I FOR ALL USING (
  EXECUTE format('CREATE POLICY "service_role_bypass" ON %I USING (true) WITH CHECK (true)', table_name);
CREATE POLICY "Admins can delete feedback cycles" ON "public"."feedback_cycles" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "Admins can insert feedback cycles" ON "public"."feedback_cycles" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
CREATE POLICY "Admins can manage company" ON "public"."companies" TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "Admins can update any member status" ON "public"."company_members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "Admins can update feedback cycles" ON "public"."feedback_cycles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "Admins create company values" ON "public"."company_values" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "cm"."company_id"
CREATE POLICY "Admins delete company values" ON "public"."company_values" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "cm"."company_id"
CREATE POLICY "Admins delete feedback questions" ON "public"."feedback_questions" FOR DELETE TO "authenticated" USING ((("scope" = 'company'::"text") AND ("company_id" IN ( SELECT "cm"."company_id"
CREATE POLICY "Admins manage feedback cycle occurrences" ON "public"."feedback_cycle_occurrences" TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "Admins manage feedback questions" ON "public"."feedback_questions" FOR INSERT TO "authenticated" WITH CHECK ((("scope" = 'company'::"text") AND ("company_id" IN ( SELECT "cm"."company_id"
CREATE POLICY "Admins manage manager relationships" ON "public"."manager_relationships" TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "Admins update company values" ON "public"."company_values" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "cm"."company_id"
CREATE POLICY "Admins update feedback questions" ON "public"."feedback_questions" FOR UPDATE TO "authenticated" USING ((("scope" = 'company'::"text") AND ("company_id" IN ( SELECT "cm"."company_id"
CREATE POLICY "Allow unregistered users to create companies" ON "public"."companies" FOR INSERT TO "anon" WITH CHECK (true);
CREATE POLICY "Allow updating companies during registration flow" ON "public"."companies" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);
CREATE POLICY "Allow users to check company domains" ON "public"."companies" FOR SELECT TO "authenticated", "anon" USING (true);
CREATE POLICY "Allow users to create companies during registration" ON "public"."companies" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);
CREATE POLICY "Anyone can insert a demo lead" ON "public"."demo_leads" FOR INSERT TO "anon" WITH CHECK (true);
CREATE POLICY "Authenticated users can create feedback questions of type 'ai'" ON "public"."feedback_questions" FOR INSERT TO "authenticated" WITH CHECK (("question_type" = 'ai'::"text"));
CREATE POLICY "Authenticated users can view logs" ON "public"."logs" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Create/update responses" ON "public"."feedback_responses" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
CREATE POLICY "Managers view direct reports as recipients" ON "public"."feedback_recipients" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "Users can delete their own notes" ON "public"."notes" FOR DELETE USING (("creator_id" = "auth"."uid"()));
CREATE POLICY "Users can insert their own notes" ON "public"."notes" FOR INSERT WITH CHECK (("creator_id" = "auth"."uid"()));
CREATE POLICY "Users can update notes they created" ON "public"."notes" FOR UPDATE USING (("creator_id" = "auth"."uid"()));
CREATE POLICY "Users can view notes they created or are about them" ON "public"."notes" FOR SELECT USING ((("creator_id" = "auth"."uid"()) OR ("subject_member_id" = "auth"."uid"())));
CREATE POLICY "Users can view their company" ON "public"."companies" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "company_members"."company_id"
CREATE POLICY "Verify invite code" ON "public"."invited_users" FOR SELECT TO "anon" USING (("invite_code" IS NOT NULL));
CREATE POLICY "View assigned feedback tasks" ON "public"."feedback_recipients" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "View company members" ON "public"."company_members" FOR SELECT TO "authenticated" USING (("company_id" = ( SELECT "public"."get_user_company_id"() AS "get_user_company_id")));
CREATE POLICY "View company values" ON "public"."company_values" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "cm"."company_id"
CREATE POLICY "View cycles in company" ON "public"."feedback_cycles" FOR SELECT TO "authenticated" USING (("company_id" = ( SELECT "cm"."company_id"
CREATE POLICY "View feedback cycle occurrences" ON "public"."feedback_cycle_occurrences" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "View feedback provided" ON "public"."feedback_responses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "View feedback questions" ON "public"."feedback_questions" FOR SELECT TO "authenticated" USING ((("scope" = 'global'::"text") OR (("scope" = 'company'::"text") AND ("company_id" IN ( SELECT "cm"."company_id"
CREATE POLICY "View identities in company" ON "public"."feedback_user_identities" FOR SELECT TO "authenticated" USING (("company_id" = ( SELECT "cm"."company_id"
CREATE POLICY "View invited users" ON "public"."invited_users" FOR SELECT TO "authenticated" USING (("company_id" = ( SELECT "public"."get_user_company_id"() AS "get_user_company_id")));
CREATE POLICY "View own company member record" ON "public"."company_members" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));
CREATE POLICY "View own provided responses" ON "public"."feedback_responses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "View relationships" ON "public"."manager_relationships" FOR SELECT TO "authenticated" USING (("company_id" = ( SELECT "public"."get_user_company_id"() AS "get_user_company_id")));
CREATE POLICY "View self as recipient" ON "public"."feedback_recipients" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "admin_delete_feedback_user_identities" ON "public"."feedback_user_identities" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "admin_feedback_recipients" ON "public"."feedback_recipients" TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "admin_feedback_responses" ON "public"."feedback_responses" TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "admin_feedback_sessions" ON "public"."feedback_sessions" TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "admin_feedback_user_identities" ON "public"."feedback_user_identities" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."company_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."company_values" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "create_feedback_user_identities" ON "public"."feedback_user_identities" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "company_members"."company_id"
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
CREATE POLICY "insert_own_profile" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));
CREATE POLICY "insert_own_summaries" ON "public"."feedback_summaries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."invited_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage_manager_relationships" ON "public"."manager_relationships" TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "manage_own_feedback_recipients" ON "public"."feedback_recipients" TO "authenticated" USING (("session_id" IN ( SELECT "feedback_sessions"."id"
CREATE POLICY "manage_own_feedback_responses" ON "public"."feedback_responses" TO "authenticated" USING (("session_id" IN ( SELECT "feedback_sessions"."id"
ALTER TABLE "public"."manager_relationships" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_view_team_feedback_recipients" ON "public"."feedback_recipients" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "manager_view_team_feedback_responses" ON "public"."feedback_responses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "view_feedback_sessions" ON "public"."feedback_sessions" FOR SELECT TO "authenticated" USING (("cycle_id" IN ( SELECT "fc"."id"
CREATE POLICY "view_feedback_user_identities" ON "public"."feedback_user_identities" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "company_members"."company_id"
CREATE POLICY "view_own_summaries" ON "public"."feedback_summaries" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "view_provided_feedback_responses" ON "public"."feedback_responses" FOR SELECT TO "authenticated" USING (("session_id" IN ( SELECT "feedback_sessions"."id"
CREATE POLICY "view_received_feedback_responses" ON "public"."feedback_responses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "view_user_profiles" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);
