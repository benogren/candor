-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."member_status" AS ENUM('pending', 'active', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TABLE "feedback_cycles" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"company_id" uuid NOT NULL,
	"cycle_name" text,
	"status" text NOT NULL,
	"start_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"frequency" text DEFAULT 'weekly',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "feedback_cycles_frequency_check" CHECK (frequency = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text])),
	CONSTRAINT "feedback_cycles_status_check" CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'draft'::text]))
);
--> statement-breakpoint
ALTER TABLE "feedback_cycles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"additional_data" jsonb DEFAULT '{}'::jsonb,
	"avatar_url" text,
	"job_title" text
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feedback_questions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"company_id" uuid,
	"question_text" text NOT NULL,
	"question_type" text NOT NULL,
	"scope" text NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"question_description" text,
	"question_subtype" text,
	"company_value_id" uuid,
	"is_admin_manageable" boolean DEFAULT true NOT NULL,
	CONSTRAINT "feedback_questions_question_type_check" CHECK (question_type = ANY (ARRAY['rating'::text, 'text'::text, 'values'::text, 'ai'::text])),
	CONSTRAINT "feedback_questions_scope_check" CHECK (scope = ANY (ARRAY['global'::text, 'company'::text]))
);
--> statement-breakpoint
ALTER TABLE "feedback_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feedback_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"status" text DEFAULT 'pending',
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"occurrence_id" uuid,
	CONSTRAINT "feedback_sessions_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text]))
);
--> statement-breakpoint
ALTER TABLE "feedback_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feedback_responses" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"rating_value" integer,
	"text_response" text,
	"has_comment" boolean DEFAULT false,
	"comment_text" text,
	"skipped" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"session_id" uuid NOT NULL,
	"nominated_user_id" uuid,
	"nomination_date" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "feedback_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feedback_recipients" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"session_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"status" text DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "feedback_recipients_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text]))
);
--> statement-breakpoint
ALTER TABLE "feedback_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invited_users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"company_id" uuid,
	"invite_code" text,
	"status" text DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now(),
	"used_at" timestamp with time zone,
	"created_by" uuid,
	"job_title" text,
	CONSTRAINT "invited_users_email_key" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "invited_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "auth_tokens_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "feedback_summaries" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"timeframe" text NOT NULL,
	"summary" text NOT NULL,
	"feedback_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"type" text
);
--> statement-breakpoint
ALTER TABLE "feedback_summaries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pending_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"company_id" uuid,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now(),
	"processed_at" timestamp with time zone,
	CONSTRAINT "pending_registrations_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "pending_registrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feedback_user_identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identity_type" text NOT NULL,
	"company_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text
);
--> statement-breakpoint
ALTER TABLE "feedback_user_identities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "manager_feedback_summaries" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"manager_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"timeframe" text NOT NULL,
	"summary" text NOT NULL,
	"feedback_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"domains" text[] DEFAULT '{""}',
	"industry" text,
	"stripe_customer_id" text,
	"subscription_id" text,
	"subscription_interval" text,
	"subscription_status" text,
	"user_count" smallint,
	"trial_end" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "company_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"status" "member_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "manager_relationships" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"member_id" uuid,
	"manager_id" uuid,
	"relationship_type" varchar(20) DEFAULT 'direct',
	"company_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"invited_member_id" uuid,
	"invited_manager_id" uuid,
	CONSTRAINT "check_at_least_one_member" CHECK (((member_id IS NOT NULL) AND (invited_member_id IS NULL)) OR ((member_id IS NULL) AND (invited_member_id IS NOT NULL))),
	CONSTRAINT "check_manager_consistency" CHECK (((manager_id IS NOT NULL) AND (invited_manager_id IS NULL)) OR ((manager_id IS NULL) AND (invited_manager_id IS NOT NULL)) OR ((manager_id IS NULL) AND (invited_manager_id IS NULL)))
);
--> statement-breakpoint
ALTER TABLE "manager_relationships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feedback_cycle_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"occurrence_number" integer NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"emails_sent_count" integer DEFAULT 0 NOT NULL,
	"responses_count" integer DEFAULT 0 NOT NULL,
	"emails_sent_at" timestamp with time zone,
	"reminders_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "feedback_cycle_occurrences_status_check" CHECK (status = ANY (ARRAY['active'::text, 'completed'::text]))
);
--> statement-breakpoint
ALTER TABLE "feedback_cycle_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "demo_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text NOT NULL,
	"company_size" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"notes" text,
	"status" text DEFAULT 'pending'
);
--> statement-breakpoint
ALTER TABLE "demo_leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "company_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "company_values" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "debug_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text,
	"user_id" uuid,
	"user_email" text,
	"details" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "debug_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "feedback_cycles" ADD CONSTRAINT "feedback_cycles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_questions" ADD CONSTRAINT "feedback_questions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_questions" ADD CONSTRAINT "feedback_questions_company_value_id_fkey" FOREIGN KEY ("company_value_id") REFERENCES "public"."company_values"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_sessions" ADD CONSTRAINT "feedback_sessions_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."feedback_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_sessions" ADD CONSTRAINT "feedback_sessions_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "public"."feedback_cycle_occurrences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_sessions" ADD CONSTRAINT "feedback_sessions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."company_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_nominated_user_id_fkey" FOREIGN KEY ("nominated_user_id") REFERENCES "public"."feedback_user_identities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."feedback_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."feedback_recipients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."feedback_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_recipients" ADD CONSTRAINT "feedback_recipients_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."feedback_user_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_recipients" ADD CONSTRAINT "feedback_recipients_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."feedback_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invited_users" ADD CONSTRAINT "invited_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."feedback_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."company_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_summaries" ADD CONSTRAINT "feedback_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."company_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_registrations" ADD CONSTRAINT "pending_registrations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_feedback_summaries" ADD CONSTRAINT "manager_feedback_summaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."company_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_feedback_summaries" ADD CONSTRAINT "manager_feedback_summaries_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."company_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_id_fkey1" FOREIGN KEY ("id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_relationships" ADD CONSTRAINT "manager_relationships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_relationships" ADD CONSTRAINT "manager_relationships_invited_manager_id_fkey" FOREIGN KEY ("invited_manager_id") REFERENCES "public"."invited_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_relationships" ADD CONSTRAINT "manager_relationships_invited_member_id_fkey" FOREIGN KEY ("invited_member_id") REFERENCES "public"."invited_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_relationships" ADD CONSTRAINT "manager_relationships_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_relationships" ADD CONSTRAINT "manager_relationships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_cycle_occurrences" ADD CONSTRAINT "feedback_cycle_occurrences_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."feedback_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_values" ADD CONSTRAINT "company_values_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_feedback_cycles_company_id" ON "feedback_cycles" USING btree ("company_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "user_profiles_email_idx" ON "user_profiles" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_feedback_questions_company_value_id" ON "feedback_questions" USING btree ("company_value_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_feedback_sessions_occurrence_id" ON "feedback_sessions" USING btree ("occurrence_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_feedback_sessions_provider_id" ON "feedback_sessions" USING btree ("provider_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_feedback_responses_nominated_user_id" ON "feedback_responses" USING btree ("nominated_user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_feedback_recipients_session_id" ON "feedback_recipients" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "auth_tokens_token_idx" ON "auth_tokens" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "idx_feedback_summaries_timeframe" ON "feedback_summaries" USING btree ("timeframe" text_ops);--> statement-breakpoint
CREATE INDEX "idx_feedback_summaries_user_id" ON "feedback_summaries" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_manager_feedback_summaries_employee_id" ON "manager_feedback_summaries" USING btree ("employee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_manager_feedback_summaries_manager_id" ON "manager_feedback_summaries" USING btree ("manager_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_manager_feedback_summaries_timeframe" ON "manager_feedback_summaries" USING btree ("timeframe" text_ops);--> statement-breakpoint
CREATE INDEX "idx_manager_feedback_summaries_type" ON "manager_feedback_summaries" USING btree ("type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_companies_domains" ON "companies" USING gin ("domains" array_ops);--> statement-breakpoint
CREATE INDEX "idx_company_members_company_id" ON "company_members" USING btree ("company_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_manager_relationships_combined" ON "manager_relationships" USING btree ("company_id" uuid_ops,"member_id" uuid_ops,"manager_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_manager_relationships_company_id" ON "manager_relationships" USING btree ("company_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_manager_relationships_manager_id" ON "manager_relationships" USING btree ("manager_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_manager_relationships_member_id" ON "manager_relationships" USING btree ("member_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_feedback_cycle_occurrences_cycle_id" ON "feedback_cycle_occurrences" USING btree ("cycle_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_feedback_cycle_occurrences_status" ON "feedback_cycle_occurrences" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "demo_leads_email_idx" ON "demo_leads" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_company_values_company_id" ON "company_values" USING btree ("company_id" uuid_ops);--> statement-breakpoint
CREATE VIEW "public"."feedback_summaries_view" AS (SELECT fs.id, fs.user_id, fs.timeframe, fs.summary, fs.created_at, up.name AS user_name, up.email AS user_email, cm.company_id FROM feedback_summaries fs JOIN user_profiles up ON fs.user_id = up.id JOIN company_members cm ON fs.user_id = cm.id);--> statement-breakpoint
CREATE VIEW "public"."org_structure" AS (SELECT u.id, cm.role, p.email::character varying AS email, cm.company_id, false AS is_invited, false AS is_pending, COALESCE(mr.manager_id, imr.id) AS manager_id, COALESCE(mr.relationship_type, 'direct'::character varying) AS relationship_type FROM auth.users u JOIN company_members cm ON u.id = cm.id LEFT JOIN user_profiles p ON u.id = p.id LEFT JOIN ( SELECT DISTINCT ON (manager_relationships.member_id, manager_relationships.company_id) manager_relationships.member_id, manager_relationships.manager_id, manager_relationships.company_id, manager_relationships.relationship_type, manager_relationships.invited_manager_id FROM manager_relationships ORDER BY manager_relationships.member_id, manager_relationships.company_id, manager_relationships.updated_at DESC) mr ON u.id = mr.member_id AND cm.company_id = mr.company_id LEFT JOIN invited_users imr ON mr.invited_manager_id = imr.id WHERE cm.status = 'active'::member_status UNION ALL SELECT iu.id, iu.role, iu.email::character varying AS email, iu.company_id, true AS is_invited, false AS is_pending, COALESCE(mr.manager_id, imr.id) AS manager_id, COALESCE(mr.relationship_type, 'direct'::character varying) AS relationship_type FROM invited_users iu LEFT JOIN ( SELECT DISTINCT ON (manager_relationships.invited_member_id, manager_relationships.company_id) manager_relationships.invited_member_id, manager_relationships.manager_id, manager_relationships.company_id, manager_relationships.relationship_type, manager_relationships.invited_manager_id FROM manager_relationships ORDER BY manager_relationships.invited_member_id, manager_relationships.company_id, manager_relationships.updated_at DESC) mr ON iu.id = mr.invited_member_id AND iu.company_id = mr.company_id LEFT JOIN invited_users imr ON mr.invited_manager_id = imr.id WHERE iu.status = 'pending'::text AND NOT (EXISTS ( SELECT 1 FROM company_members cm JOIN user_profiles p ON cm.id = p.id WHERE lower(p.email) = lower(iu.email) AND cm.company_id = iu.company_id)) UNION ALL SELECT pr.user_id AS id, pr.role, pr.email::character varying AS email, pr.company_id, false AS is_invited, true AS is_pending, COALESCE(mr.manager_id, imr.id) AS manager_id, COALESCE(mr.relationship_type, 'direct'::character varying) AS relationship_type FROM pending_registrations pr LEFT JOIN ( SELECT DISTINCT ON (manager_relationships.member_id, manager_relationships.company_id) manager_relationships.member_id, manager_relationships.manager_id, manager_relationships.company_id, manager_relationships.relationship_type, manager_relationships.invited_manager_id FROM manager_relationships ORDER BY manager_relationships.member_id, manager_relationships.company_id, manager_relationships.updated_at DESC) mr ON pr.user_id = mr.member_id AND pr.company_id = mr.company_id LEFT JOIN invited_users imr ON mr.invited_manager_id = imr.id WHERE pr.status = 'pending'::text AND pr.processed_at IS NULL AND NOT (EXISTS ( SELECT 1 FROM company_members cm WHERE cm.id = pr.user_id AND cm.company_id = pr.company_id)) AND NOT (EXISTS ( SELECT 1 FROM invited_users iu WHERE lower(iu.email) = lower(pr.email) AND iu.company_id = pr.company_id)));--> statement-breakpoint
CREATE POLICY "View cycles in company" ON "feedback_cycles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((company_id = ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "Admins can insert feedback cycles" ON "feedback_cycles" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Admins can update feedback cycles" ON "feedback_cycles" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Admins can delete feedback cycles" ON "feedback_cycles" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "view_user_profiles" ON "user_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "update_own_profile" ON "user_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "insert_own_profile" ON "user_profiles" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "View feedback questions" ON "feedback_questions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((scope = 'global'::text) OR ((scope = 'company'::text) AND (company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status)))))));--> statement-breakpoint
CREATE POLICY "Admins manage feedback questions" ON "feedback_questions" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Admins update feedback questions" ON "feedback_questions" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Admins delete feedback questions" ON "feedback_questions" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_bypass" ON "feedback_questions" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "Authenticated users can create feedback questions of type 'ai'" ON "feedback_questions" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "view_feedback_sessions" ON "feedback_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((cycle_id IN ( SELECT fc.id
   FROM (feedback_cycles fc
     JOIN company_members cm ON ((fc.company_id = cm.company_id)))
  WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status)))));--> statement-breakpoint
CREATE POLICY "insert_feedback_sessions" ON "feedback_sessions" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "update_feedback_sessions" ON "feedback_sessions" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "admin_feedback_sessions" ON "feedback_sessions" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "Create/update responses" ON "feedback_responses" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM feedback_sessions fs
  WHERE ((feedback_responses.session_id = fs.id) AND (fs.provider_id = ( SELECT auth.uid() AS uid))))));--> statement-breakpoint
CREATE POLICY "View own provided responses" ON "feedback_responses" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "manager_view_team_feedback_responses" ON "feedback_responses" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "View feedback provided" ON "feedback_responses" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "view_provided_feedback_responses" ON "feedback_responses" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "view_received_feedback_responses" ON "feedback_responses" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "manage_own_feedback_responses" ON "feedback_responses" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "admin_feedback_responses" ON "feedback_responses" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "View self as recipient" ON "feedback_recipients" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM feedback_user_identities fui
  WHERE ((feedback_recipients.recipient_id = fui.id) AND (fui.id = ( SELECT auth.uid() AS uid))))));--> statement-breakpoint
CREATE POLICY "View assigned feedback tasks" ON "feedback_recipients" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Managers view direct reports as recipients" ON "feedback_recipients" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "manager_view_team_feedback_recipients" ON "feedback_recipients" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "view_feedback_recipients" ON "feedback_recipients" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "manage_own_feedback_recipients" ON "feedback_recipients" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "admin_feedback_recipients" ON "feedback_recipients" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_bypass" ON "invited_users" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Verify invite code" ON "invited_users" AS PERMISSIVE FOR SELECT TO "anon";--> statement-breakpoint
CREATE POLICY "View invited users" ON "invited_users" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "view_own_summaries" ON "feedback_summaries" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "insert_own_summaries" ON "feedback_summaries" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "service_role_bypass" ON "pending_registrations" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_bypass" ON "feedback_user_identities" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "View identities in company" ON "feedback_user_identities" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "view_feedback_user_identities" ON "feedback_user_identities" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "create_feedback_user_identities" ON "feedback_user_identities" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "admin_feedback_user_identities" ON "feedback_user_identities" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "admin_delete_feedback_user_identities" ON "feedback_user_identities" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Allow updating companies during registration flow" ON "companies" AS PERMISSIVE FOR UPDATE TO "anon", "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Users can view their company" ON "companies" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Allow unregistered users to create companies" ON "companies" AS PERMISSIVE FOR INSERT TO "anon";--> statement-breakpoint
CREATE POLICY "Allow users to create companies during registration" ON "companies" AS PERMISSIVE FOR INSERT TO "anon", "authenticated";--> statement-breakpoint
CREATE POLICY "Admins can manage company" ON "companies" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "Allow users to check company domains" ON "companies" AS PERMISSIVE FOR SELECT TO "anon", "authenticated";--> statement-breakpoint
CREATE POLICY "View own company member record" ON "company_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((id = auth.uid()));--> statement-breakpoint
CREATE POLICY "View company members" ON "company_members" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Admins can update any member status" ON "company_members" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "manage_manager_relationships" ON "manager_relationships" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = manager_relationships.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = manager_relationships.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));--> statement-breakpoint
CREATE POLICY "Admins manage manager relationships" ON "manager_relationships" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "View relationships" ON "manager_relationships" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "View feedback cycle occurrences" ON "feedback_cycle_occurrences" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (feedback_cycles fc
     JOIN company_members cm ON ((fc.company_id = cm.company_id)))
  WHERE ((feedback_cycle_occurrences.cycle_id = fc.id) AND (cm.id = auth.uid()) AND (cm.status = 'active'::member_status)))));--> statement-breakpoint
CREATE POLICY "Admins manage feedback cycle occurrences" ON "feedback_cycle_occurrences" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "Anyone can insert a demo lead" ON "demo_leads" AS PERMISSIVE FOR INSERT TO "anon" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_bypass" ON "company_values" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "View company values" ON "company_values" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Admins create company values" ON "company_values" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Admins update company values" ON "company_values" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Admins delete company values" ON "company_values" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated users can view logs" ON "logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
*/