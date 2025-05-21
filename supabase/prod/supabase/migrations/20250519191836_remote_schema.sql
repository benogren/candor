create extension if not exists "pg_net" with schema "public" version '0.14.0';

create type "public"."member_status" as enum ('pending', 'active', 'deactivated');

create type "public"."user_role" as enum ('admin', 'member');

create sequence "public"."debug_logs_id_seq";

create sequence "public"."function_debug_logs_id_seq";

create sequence "public"."logs_id_seq";

create table "public"."auth_tokens" (
    "id" uuid not null default uuid_generate_v4(),
    "token" text not null,
    "user_id" uuid not null,
    "type" text not null,
    "expires_at" timestamp with time zone not null,
    "used_at" timestamp with time zone,
    "session_id" uuid,
    "created_at" timestamp with time zone default now()
);


create table "public"."companies" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "domains" text[] default '{}'::text[],
    "industry" text,
    "stripe_customer_id" text,
    "subscription_id" text,
    "subscription_interval" text,
    "subscription_status" text,
    "user_count" smallint,
    "trial_end" timestamp with time zone
);


alter table "public"."companies" enable row level security;

create table "public"."company_members" (
    "id" uuid not null,
    "company_id" uuid,
    "role" user_role not null default 'member'::user_role,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "status" member_status not null default 'pending'::member_status
);


alter table "public"."company_members" enable row level security;

create table "public"."company_values" (
    "id" uuid not null default gen_random_uuid(),
    "company_id" uuid not null,
    "name" text not null,
    "description" text not null,
    "icon" text,
    "active" boolean not null default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."company_values" enable row level security;

create table "public"."debug_logs" (
    "id" integer not null default nextval('debug_logs_id_seq'::regclass),
    "event_type" text,
    "user_id" uuid,
    "user_email" text,
    "details" text,
    "metadata" jsonb,
    "created_at" timestamp with time zone default now()
);


alter table "public"."debug_logs" enable row level security;

create table "public"."demo_leads" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "email" text not null,
    "company" text not null,
    "company_size" text not null,
    "created_at" timestamp with time zone default now(),
    "notes" text,
    "status" text default 'pending'::text
);


alter table "public"."demo_leads" enable row level security;

create table "public"."feedback_cycle_occurrences" (
    "id" uuid not null default uuid_generate_v4(),
    "cycle_id" uuid not null,
    "occurrence_number" integer not null,
    "start_date" timestamp with time zone not null,
    "end_date" timestamp with time zone not null,
    "status" text not null default 'active'::text,
    "emails_sent_count" integer not null default 0,
    "responses_count" integer not null default 0,
    "emails_sent_at" timestamp with time zone,
    "reminders_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."feedback_cycle_occurrences" enable row level security;

create table "public"."feedback_cycles" (
    "id" uuid not null default uuid_generate_v4(),
    "company_id" uuid not null,
    "cycle_name" text,
    "status" text not null,
    "start_date" timestamp with time zone,
    "due_date" timestamp with time zone,
    "frequency" text default 'weekly'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."feedback_cycles" enable row level security;

create table "public"."feedback_questions" (
    "id" uuid not null default uuid_generate_v4(),
    "company_id" uuid,
    "question_text" text not null,
    "question_type" text not null,
    "scope" text not null,
    "active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "question_description" text,
    "question_subtype" text,
    "company_value_id" uuid,
    "is_admin_manageable" boolean not null default true
);


alter table "public"."feedback_questions" enable row level security;

create table "public"."feedback_recipients" (
    "id" uuid not null default uuid_generate_v4(),
    "session_id" uuid not null,
    "recipient_id" uuid not null,
    "status" text default 'pending'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."feedback_recipients" enable row level security;

create table "public"."feedback_responses" (
    "id" uuid not null default uuid_generate_v4(),
    "recipient_id" uuid not null,
    "question_id" uuid not null,
    "rating_value" integer,
    "text_response" text,
    "has_comment" boolean default false,
    "comment_text" text,
    "skipped" boolean default false,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "session_id" uuid not null,
    "nominated_user_id" uuid,
    "nomination_date" timestamp with time zone
);


alter table "public"."feedback_responses" enable row level security;

create table "public"."feedback_sessions" (
    "id" uuid not null default uuid_generate_v4(),
    "cycle_id" uuid not null,
    "provider_id" uuid not null,
    "status" text default 'pending'::text,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "reminder_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "occurrence_id" uuid
);


alter table "public"."feedback_sessions" enable row level security;

create table "public"."feedback_summaries" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "timeframe" text not null,
    "summary" text not null,
    "feedback_data" jsonb,
    "created_at" timestamp with time zone default now(),
    "type" text
);


alter table "public"."feedback_summaries" enable row level security;

create table "public"."feedback_user_identities" (
    "id" uuid not null,
    "identity_type" text not null,
    "company_id" uuid not null,
    "email" text not null,
    "name" text
);


alter table "public"."feedback_user_identities" enable row level security;

create table "public"."function_debug_logs" (
    "id" integer not null default nextval('function_debug_logs_id_seq'::regclass),
    "function_name" text,
    "called_at" timestamp with time zone default now(),
    "user_role" text,
    "parameters" jsonb,
    "result" text
);


create table "public"."invited_users" (
    "id" uuid not null,
    "email" text not null,
    "name" text,
    "role" user_role not null default 'member'::user_role,
    "company_id" uuid,
    "invite_code" text,
    "status" text default 'pending'::text,
    "created_at" timestamp with time zone default now(),
    "used_at" timestamp with time zone,
    "created_by" uuid,
    "job_title" text
);


alter table "public"."invited_users" enable row level security;

create table "public"."logs" (
    "id" integer not null default nextval('logs_id_seq'::regclass),
    "action" text not null,
    "details" jsonb,
    "created_at" timestamp with time zone default now()
);


alter table "public"."logs" enable row level security;

create table "public"."manager_feedback_summaries" (
    "id" uuid not null default uuid_generate_v4(),
    "manager_id" uuid not null,
    "employee_id" uuid not null,
    "timeframe" text not null,
    "summary" text not null,
    "feedback_data" jsonb,
    "created_at" timestamp with time zone default now(),
    "type" text not null
);


create table "public"."manager_relationships" (
    "id" uuid not null default uuid_generate_v4(),
    "member_id" uuid,
    "manager_id" uuid,
    "relationship_type" character varying(20) default 'direct'::character varying,
    "company_id" uuid not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "invited_member_id" uuid,
    "invited_manager_id" uuid
);


alter table "public"."manager_relationships" enable row level security;

create table "public"."notes" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "content" text not null,
    "content_type" text not null,
    "creator_id" uuid not null,
    "subject_member_id" uuid,
    "subject_invited_id" uuid,
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "is_generating" boolean not null default false
);


alter table "public"."notes" enable row level security;

create table "public"."pending_registrations" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "email" text not null,
    "name" text,
    "company_id" uuid,
    "role" user_role not null default 'member'::user_role,
    "status" text default 'pending'::text,
    "created_at" timestamp with time zone default now(),
    "processed_at" timestamp with time zone
);


alter table "public"."pending_registrations" enable row level security;

create table "public"."user_profiles" (
    "id" uuid not null,
    "email" text not null,
    "name" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "additional_data" jsonb default '{}'::jsonb,
    "avatar_url" text,
    "job_title" text
);


alter table "public"."user_profiles" enable row level security;

alter sequence "public"."debug_logs_id_seq" owned by "public"."debug_logs"."id";

alter sequence "public"."function_debug_logs_id_seq" owned by "public"."function_debug_logs"."id";

alter sequence "public"."logs_id_seq" owned by "public"."logs"."id";

CREATE UNIQUE INDEX auth_tokens_pkey ON public.auth_tokens USING btree (id);

CREATE INDEX auth_tokens_token_idx ON public.auth_tokens USING btree (token);

CREATE UNIQUE INDEX auth_tokens_token_key ON public.auth_tokens USING btree (token);

CREATE UNIQUE INDEX companies_pkey ON public.companies USING btree (id);

CREATE UNIQUE INDEX company_values_pkey ON public.company_values USING btree (id);

CREATE UNIQUE INDEX debug_logs_pkey ON public.debug_logs USING btree (id);

CREATE INDEX demo_leads_email_idx ON public.demo_leads USING btree (email);

CREATE UNIQUE INDEX demo_leads_pkey ON public.demo_leads USING btree (id);

CREATE UNIQUE INDEX feedback_cycle_occurrences_pkey ON public.feedback_cycle_occurrences USING btree (id);

CREATE UNIQUE INDEX feedback_cycles_pkey ON public.feedback_cycles USING btree (id);

CREATE UNIQUE INDEX feedback_questions_pkey ON public.feedback_questions USING btree (id);

CREATE UNIQUE INDEX feedback_recipients_pkey ON public.feedback_recipients USING btree (id);

CREATE UNIQUE INDEX feedback_responses_pkey ON public.feedback_responses USING btree (id);

CREATE UNIQUE INDEX feedback_sessions_pkey ON public.feedback_sessions USING btree (id);

CREATE UNIQUE INDEX feedback_summaries_pkey ON public.feedback_summaries USING btree (id);

CREATE UNIQUE INDEX feedback_user_identities_pkey ON public.feedback_user_identities USING btree (id);

CREATE UNIQUE INDEX function_debug_logs_pkey ON public.function_debug_logs USING btree (id);

CREATE INDEX idx_companies_domains ON public.companies USING gin (domains);

CREATE INDEX idx_company_members_company_id ON public.company_members USING btree (company_id);

CREATE INDEX idx_company_values_company_id ON public.company_values USING btree (company_id);

CREATE INDEX idx_feedback_cycle_occurrences_cycle_id ON public.feedback_cycle_occurrences USING btree (cycle_id);

CREATE INDEX idx_feedback_cycle_occurrences_status ON public.feedback_cycle_occurrences USING btree (status);

CREATE INDEX idx_feedback_cycles_company_id ON public.feedback_cycles USING btree (company_id);

CREATE INDEX idx_feedback_questions_company_value_id ON public.feedback_questions USING btree (company_value_id);

CREATE INDEX idx_feedback_recipients_session_id ON public.feedback_recipients USING btree (session_id);

CREATE INDEX idx_feedback_responses_nominated_user_id ON public.feedback_responses USING btree (nominated_user_id);

CREATE INDEX idx_feedback_sessions_occurrence_id ON public.feedback_sessions USING btree (occurrence_id);

CREATE INDEX idx_feedback_sessions_provider_id ON public.feedback_sessions USING btree (provider_id);

CREATE INDEX idx_feedback_summaries_timeframe ON public.feedback_summaries USING btree (timeframe);

CREATE INDEX idx_feedback_summaries_user_id ON public.feedback_summaries USING btree (user_id);

CREATE INDEX idx_manager_feedback_summaries_employee_id ON public.manager_feedback_summaries USING btree (employee_id);

CREATE INDEX idx_manager_feedback_summaries_manager_id ON public.manager_feedback_summaries USING btree (manager_id);

CREATE INDEX idx_manager_feedback_summaries_timeframe ON public.manager_feedback_summaries USING btree (timeframe);

CREATE INDEX idx_manager_feedback_summaries_type ON public.manager_feedback_summaries USING btree (type);

CREATE INDEX idx_manager_relationships_combined ON public.manager_relationships USING btree (company_id, member_id, manager_id);

CREATE INDEX idx_manager_relationships_company_id ON public.manager_relationships USING btree (company_id);

CREATE INDEX idx_manager_relationships_manager_id ON public.manager_relationships USING btree (manager_id);

CREATE INDEX idx_manager_relationships_member_id ON public.manager_relationships USING btree (member_id);

CREATE UNIQUE INDEX invited_users_email_key ON public.invited_users USING btree (email);

CREATE UNIQUE INDEX invited_users_pkey ON public.invited_users USING btree (id);

CREATE UNIQUE INDEX logs_pkey ON public.logs USING btree (id);

CREATE UNIQUE INDEX manager_feedback_summaries_pkey ON public.manager_feedback_summaries USING btree (id);

CREATE UNIQUE INDEX manager_relationships_pkey ON public.manager_relationships USING btree (id);

CREATE UNIQUE INDEX notes_pkey ON public.notes USING btree (id);

CREATE UNIQUE INDEX one_company_per_user ON public.company_members USING btree (id);

CREATE UNIQUE INDEX pending_registrations_pkey ON public.pending_registrations USING btree (id);

CREATE UNIQUE INDEX pending_registrations_user_id_key ON public.pending_registrations USING btree (user_id);

CREATE INDEX user_profiles_email_idx ON public.user_profiles USING btree (email);

CREATE UNIQUE INDEX user_profiles_pkey ON public.user_profiles USING btree (id);

alter table "public"."auth_tokens" add constraint "auth_tokens_pkey" PRIMARY KEY using index "auth_tokens_pkey";

alter table "public"."companies" add constraint "companies_pkey" PRIMARY KEY using index "companies_pkey";

alter table "public"."company_members" add constraint "one_company_per_user" PRIMARY KEY using index "one_company_per_user";

alter table "public"."company_values" add constraint "company_values_pkey" PRIMARY KEY using index "company_values_pkey";

alter table "public"."debug_logs" add constraint "debug_logs_pkey" PRIMARY KEY using index "debug_logs_pkey";

alter table "public"."demo_leads" add constraint "demo_leads_pkey" PRIMARY KEY using index "demo_leads_pkey";

alter table "public"."feedback_cycle_occurrences" add constraint "feedback_cycle_occurrences_pkey" PRIMARY KEY using index "feedback_cycle_occurrences_pkey";

alter table "public"."feedback_cycles" add constraint "feedback_cycles_pkey" PRIMARY KEY using index "feedback_cycles_pkey";

alter table "public"."feedback_questions" add constraint "feedback_questions_pkey" PRIMARY KEY using index "feedback_questions_pkey";

alter table "public"."feedback_recipients" add constraint "feedback_recipients_pkey" PRIMARY KEY using index "feedback_recipients_pkey";

alter table "public"."feedback_responses" add constraint "feedback_responses_pkey" PRIMARY KEY using index "feedback_responses_pkey";

alter table "public"."feedback_sessions" add constraint "feedback_sessions_pkey" PRIMARY KEY using index "feedback_sessions_pkey";

alter table "public"."feedback_summaries" add constraint "feedback_summaries_pkey" PRIMARY KEY using index "feedback_summaries_pkey";

alter table "public"."feedback_user_identities" add constraint "feedback_user_identities_pkey" PRIMARY KEY using index "feedback_user_identities_pkey";

alter table "public"."function_debug_logs" add constraint "function_debug_logs_pkey" PRIMARY KEY using index "function_debug_logs_pkey";

alter table "public"."invited_users" add constraint "invited_users_pkey" PRIMARY KEY using index "invited_users_pkey";

alter table "public"."logs" add constraint "logs_pkey" PRIMARY KEY using index "logs_pkey";

alter table "public"."manager_feedback_summaries" add constraint "manager_feedback_summaries_pkey" PRIMARY KEY using index "manager_feedback_summaries_pkey";

alter table "public"."manager_relationships" add constraint "manager_relationships_pkey" PRIMARY KEY using index "manager_relationships_pkey";

alter table "public"."notes" add constraint "notes_pkey" PRIMARY KEY using index "notes_pkey";

alter table "public"."pending_registrations" add constraint "pending_registrations_pkey" PRIMARY KEY using index "pending_registrations_pkey";

alter table "public"."user_profiles" add constraint "user_profiles_pkey" PRIMARY KEY using index "user_profiles_pkey";

alter table "public"."auth_tokens" add constraint "auth_tokens_session_id_fkey" FOREIGN KEY (session_id) REFERENCES feedback_sessions(id) not valid;

alter table "public"."auth_tokens" validate constraint "auth_tokens_session_id_fkey";

alter table "public"."auth_tokens" add constraint "auth_tokens_token_key" UNIQUE using index "auth_tokens_token_key";

alter table "public"."auth_tokens" add constraint "auth_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES company_members(id) not valid;

alter table "public"."auth_tokens" validate constraint "auth_tokens_user_id_fkey";

alter table "public"."company_members" add constraint "company_members_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE not valid;

alter table "public"."company_members" validate constraint "company_members_company_id_fkey";

alter table "public"."company_members" add constraint "company_members_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."company_members" validate constraint "company_members_id_fkey";

alter table "public"."company_members" add constraint "company_members_id_fkey1" FOREIGN KEY (id) REFERENCES user_profiles(id) ON DELETE CASCADE not valid;

alter table "public"."company_members" validate constraint "company_members_id_fkey1";

alter table "public"."company_values" add constraint "company_values_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE not valid;

alter table "public"."company_values" validate constraint "company_values_company_id_fkey";

alter table "public"."feedback_cycle_occurrences" add constraint "feedback_cycle_occurrences_cycle_id_fkey" FOREIGN KEY (cycle_id) REFERENCES feedback_cycles(id) ON DELETE CASCADE not valid;

alter table "public"."feedback_cycle_occurrences" validate constraint "feedback_cycle_occurrences_cycle_id_fkey";

alter table "public"."feedback_cycle_occurrences" add constraint "feedback_cycle_occurrences_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text]))) not valid;

alter table "public"."feedback_cycle_occurrences" validate constraint "feedback_cycle_occurrences_status_check";

alter table "public"."feedback_cycles" add constraint "feedback_cycles_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) not valid;

alter table "public"."feedback_cycles" validate constraint "feedback_cycles_company_id_fkey";

alter table "public"."feedback_cycles" add constraint "feedback_cycles_frequency_check" CHECK ((frequency = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text]))) not valid;

alter table "public"."feedback_cycles" validate constraint "feedback_cycles_frequency_check";

alter table "public"."feedback_cycles" add constraint "feedback_cycles_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'draft'::text]))) not valid;

alter table "public"."feedback_cycles" validate constraint "feedback_cycles_status_check";

alter table "public"."feedback_questions" add constraint "feedback_questions_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) not valid;

alter table "public"."feedback_questions" validate constraint "feedback_questions_company_id_fkey";

alter table "public"."feedback_questions" add constraint "feedback_questions_company_value_id_fkey" FOREIGN KEY (company_value_id) REFERENCES company_values(id) ON DELETE SET NULL not valid;

alter table "public"."feedback_questions" validate constraint "feedback_questions_company_value_id_fkey";

alter table "public"."feedback_questions" add constraint "feedback_questions_question_type_check" CHECK ((question_type = ANY (ARRAY['rating'::text, 'text'::text, 'values'::text, 'ai'::text]))) not valid;

alter table "public"."feedback_questions" validate constraint "feedback_questions_question_type_check";

alter table "public"."feedback_questions" add constraint "feedback_questions_scope_check" CHECK ((scope = ANY (ARRAY['global'::text, 'company'::text]))) not valid;

alter table "public"."feedback_questions" validate constraint "feedback_questions_scope_check";

alter table "public"."feedback_recipients" add constraint "feedback_recipients_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES feedback_user_identities(id) not valid;

alter table "public"."feedback_recipients" validate constraint "feedback_recipients_recipient_id_fkey";

alter table "public"."feedback_recipients" add constraint "feedback_recipients_session_id_fkey" FOREIGN KEY (session_id) REFERENCES feedback_sessions(id) not valid;

alter table "public"."feedback_recipients" validate constraint "feedback_recipients_session_id_fkey";

alter table "public"."feedback_recipients" add constraint "feedback_recipients_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text]))) not valid;

alter table "public"."feedback_recipients" validate constraint "feedback_recipients_status_check";

alter table "public"."feedback_responses" add constraint "feedback_responses_nominated_user_id_fkey" FOREIGN KEY (nominated_user_id) REFERENCES feedback_user_identities(id) ON DELETE SET NULL not valid;

alter table "public"."feedback_responses" validate constraint "feedback_responses_nominated_user_id_fkey";

alter table "public"."feedback_responses" add constraint "feedback_responses_question_id_fkey" FOREIGN KEY (question_id) REFERENCES feedback_questions(id) not valid;

alter table "public"."feedback_responses" validate constraint "feedback_responses_question_id_fkey";

alter table "public"."feedback_responses" add constraint "feedback_responses_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES feedback_recipients(id) not valid;

alter table "public"."feedback_responses" validate constraint "feedback_responses_recipient_id_fkey";

alter table "public"."feedback_responses" add constraint "feedback_responses_session_id_fkey" FOREIGN KEY (session_id) REFERENCES feedback_sessions(id) not valid;

alter table "public"."feedback_responses" validate constraint "feedback_responses_session_id_fkey";

alter table "public"."feedback_sessions" add constraint "feedback_sessions_cycle_id_fkey" FOREIGN KEY (cycle_id) REFERENCES feedback_cycles(id) not valid;

alter table "public"."feedback_sessions" validate constraint "feedback_sessions_cycle_id_fkey";

alter table "public"."feedback_sessions" add constraint "feedback_sessions_occurrence_id_fkey" FOREIGN KEY (occurrence_id) REFERENCES feedback_cycle_occurrences(id) not valid;

alter table "public"."feedback_sessions" validate constraint "feedback_sessions_occurrence_id_fkey";

alter table "public"."feedback_sessions" add constraint "feedback_sessions_provider_id_fkey" FOREIGN KEY (provider_id) REFERENCES company_members(id) not valid;

alter table "public"."feedback_sessions" validate constraint "feedback_sessions_provider_id_fkey";

alter table "public"."feedback_sessions" add constraint "feedback_sessions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text]))) not valid;

alter table "public"."feedback_sessions" validate constraint "feedback_sessions_status_check";

alter table "public"."feedback_summaries" add constraint "feedback_summaries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES company_members(id) ON DELETE CASCADE not valid;

alter table "public"."feedback_summaries" validate constraint "feedback_summaries_user_id_fkey";

alter table "public"."invited_users" add constraint "invited_users_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE not valid;

alter table "public"."invited_users" validate constraint "invited_users_company_id_fkey";

alter table "public"."invited_users" add constraint "invited_users_email_key" UNIQUE using index "invited_users_email_key";

alter table "public"."manager_feedback_summaries" add constraint "manager_feedback_summaries_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES company_members(id) ON DELETE CASCADE not valid;

alter table "public"."manager_feedback_summaries" validate constraint "manager_feedback_summaries_employee_id_fkey";

alter table "public"."manager_feedback_summaries" add constraint "manager_feedback_summaries_manager_id_fkey" FOREIGN KEY (manager_id) REFERENCES company_members(id) ON DELETE CASCADE not valid;

alter table "public"."manager_feedback_summaries" validate constraint "manager_feedback_summaries_manager_id_fkey";

alter table "public"."manager_relationships" add constraint "check_at_least_one_member" CHECK ((((member_id IS NOT NULL) AND (invited_member_id IS NULL)) OR ((member_id IS NULL) AND (invited_member_id IS NOT NULL)))) not valid;

alter table "public"."manager_relationships" validate constraint "check_at_least_one_member";

alter table "public"."manager_relationships" add constraint "check_manager_consistency" CHECK ((((manager_id IS NOT NULL) AND (invited_manager_id IS NULL)) OR ((manager_id IS NULL) AND (invited_manager_id IS NOT NULL)) OR ((manager_id IS NULL) AND (invited_manager_id IS NULL)))) not valid;

alter table "public"."manager_relationships" validate constraint "check_manager_consistency";

alter table "public"."manager_relationships" add constraint "manager_relationships_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE not valid;

alter table "public"."manager_relationships" validate constraint "manager_relationships_company_id_fkey";

alter table "public"."manager_relationships" add constraint "manager_relationships_invited_manager_id_fkey" FOREIGN KEY (invited_manager_id) REFERENCES invited_users(id) ON DELETE SET NULL not valid;

alter table "public"."manager_relationships" validate constraint "manager_relationships_invited_manager_id_fkey";

alter table "public"."manager_relationships" add constraint "manager_relationships_invited_member_id_fkey" FOREIGN KEY (invited_member_id) REFERENCES invited_users(id) ON DELETE CASCADE not valid;

alter table "public"."manager_relationships" validate constraint "manager_relationships_invited_member_id_fkey";

alter table "public"."manager_relationships" add constraint "manager_relationships_manager_id_fkey" FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."manager_relationships" validate constraint "manager_relationships_manager_id_fkey";

alter table "public"."manager_relationships" add constraint "manager_relationships_member_id_fkey" FOREIGN KEY (member_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."manager_relationships" validate constraint "manager_relationships_member_id_fkey";

alter table "public"."notes" add constraint "check_only_one_subject" CHECK ((((subject_member_id IS NULL) AND (subject_invited_id IS NOT NULL)) OR ((subject_member_id IS NOT NULL) AND (subject_invited_id IS NULL)) OR ((subject_member_id IS NULL) AND (subject_invited_id IS NULL)))) not valid;

alter table "public"."notes" validate constraint "check_only_one_subject";

alter table "public"."notes" add constraint "notes_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES company_members(id) not valid;

alter table "public"."notes" validate constraint "notes_creator_id_fkey";

alter table "public"."notes" add constraint "notes_subject_invited_id_fkey" FOREIGN KEY (subject_invited_id) REFERENCES invited_users(id) not valid;

alter table "public"."notes" validate constraint "notes_subject_invited_id_fkey";

alter table "public"."notes" add constraint "notes_subject_member_id_fkey" FOREIGN KEY (subject_member_id) REFERENCES company_members(id) not valid;

alter table "public"."notes" validate constraint "notes_subject_member_id_fkey";

alter table "public"."pending_registrations" add constraint "pending_registrations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE not valid;

alter table "public"."pending_registrations" validate constraint "pending_registrations_company_id_fkey";

alter table "public"."pending_registrations" add constraint "pending_registrations_user_id_key" UNIQUE using index "pending_registrations_user_id_key";

alter table "public"."user_profiles" add constraint "user_profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_profiles" validate constraint "user_profiles_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.admin_create_user_profiles(admin_id uuid, company_id uuid, users_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.approve_team_member(member_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.can_view_feedback_response(response_recipient_id uuid, viewer_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.check_user_account_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_company_member_after_verification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_initial_occurrence()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_next_occurrence()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_user_profile(user_id uuid, user_email text, user_name text DEFAULT NULL::text, user_job_title text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.deactivate_team_member(member_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.debug_manager_assignment(manager_id_param uuid, member_id_param uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.delete_company(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$
;

create or replace view "public"."feedback_summaries_view" as  SELECT fs.id,
    fs.user_id,
    fs.timeframe,
    fs.summary,
    fs.created_at,
    up.name AS user_name,
    up.email AS user_email,
    cm.company_id
   FROM ((feedback_summaries fs
     JOIN user_profiles up ON ((fs.user_id = up.id)))
     JOIN company_members cm ON ((fs.user_id = cm.id)));


CREATE OR REPLACE FUNCTION public.generate_invite_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_available_functions()
 RETURNS TABLE(function_name text, schema_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_deactivated_users_by_emails(p_company_id uuid, p_emails text[])
 RETURNS TABLE(id uuid, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_member_status_enum()
 RETURNS TABLE(enum_value text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT unnest(enum_range(NULL::public.member_status)::text[]);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_nominee_name(user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_top_value_nominees(company_value_id_param uuid, limit_param integer)
 RETURNS TABLE(nominee_name text, nomination_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_company_id()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_confirmed_registration()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, name)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'name'
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user_with_rls_bypass()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_user_email_verification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Update the status to 'active' in the company_members table
  UPDATE public.company_members
  SET 
    status = 'active',
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_user_profile_merge()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin(company_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM company_members cm
    WHERE cm.id = (SELECT auth.uid())
    AND cm.company_id = company_id_param
    AND cm.role = 'admin'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_manager_of(member_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM manager_relationships
    WHERE manager_id = (SELECT auth.uid())
    AND member_id = $1
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.link_user(user_id uuid, company_id uuid, user_role text DEFAULT 'member'::text)
 RETURNS boolean
 LANGUAGE sql
AS $function$
  SELECT link_user_to_company(user_id, company_id, user_role);
$function$
;

CREATE OR REPLACE FUNCTION public.link_user_to_company(user_id uuid, company_id uuid, user_role text DEFAULT 'member'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.maintain_manager_relationships()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.migrate_invited_user_feedback()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

create or replace view "public"."org_structure" as  SELECT u.id,
    cm.role,
    (p.email)::character varying AS email,
    cm.company_id,
    false AS is_invited,
    false AS is_pending,
    COALESCE(mr.manager_id, imr.id) AS manager_id,
    COALESCE(mr.relationship_type, 'direct'::character varying) AS relationship_type
   FROM ((((auth.users u
     JOIN company_members cm ON ((u.id = cm.id)))
     LEFT JOIN user_profiles p ON ((u.id = p.id)))
     LEFT JOIN ( SELECT DISTINCT ON (manager_relationships.member_id, manager_relationships.company_id) manager_relationships.member_id,
            manager_relationships.manager_id,
            manager_relationships.company_id,
            manager_relationships.relationship_type,
            manager_relationships.invited_manager_id
           FROM manager_relationships
          ORDER BY manager_relationships.member_id, manager_relationships.company_id, manager_relationships.updated_at DESC) mr ON (((u.id = mr.member_id) AND (cm.company_id = mr.company_id))))
     LEFT JOIN invited_users imr ON ((mr.invited_manager_id = imr.id)))
  WHERE (cm.status = 'active'::member_status)
UNION ALL
 SELECT iu.id,
    iu.role,
    (iu.email)::character varying AS email,
    iu.company_id,
    true AS is_invited,
    false AS is_pending,
    COALESCE(mr.manager_id, imr.id) AS manager_id,
    COALESCE(mr.relationship_type, 'direct'::character varying) AS relationship_type
   FROM ((invited_users iu
     LEFT JOIN ( SELECT DISTINCT ON (manager_relationships.invited_member_id, manager_relationships.company_id) manager_relationships.invited_member_id,
            manager_relationships.manager_id,
            manager_relationships.company_id,
            manager_relationships.relationship_type,
            manager_relationships.invited_manager_id
           FROM manager_relationships
          ORDER BY manager_relationships.invited_member_id, manager_relationships.company_id, manager_relationships.updated_at DESC) mr ON (((iu.id = mr.invited_member_id) AND (iu.company_id = mr.company_id))))
     LEFT JOIN invited_users imr ON ((mr.invited_manager_id = imr.id)))
  WHERE ((iu.status = 'pending'::text) AND (NOT (EXISTS ( SELECT 1
           FROM (company_members cm
             JOIN user_profiles p ON ((cm.id = p.id)))
          WHERE ((lower(p.email) = lower(iu.email)) AND (cm.company_id = iu.company_id))))))
UNION ALL
 SELECT pr.user_id AS id,
    pr.role,
    (pr.email)::character varying AS email,
    pr.company_id,
    false AS is_invited,
    true AS is_pending,
    COALESCE(mr.manager_id, imr.id) AS manager_id,
    COALESCE(mr.relationship_type, 'direct'::character varying) AS relationship_type
   FROM ((pending_registrations pr
     LEFT JOIN ( SELECT DISTINCT ON (manager_relationships.member_id, manager_relationships.company_id) manager_relationships.member_id,
            manager_relationships.manager_id,
            manager_relationships.company_id,
            manager_relationships.relationship_type,
            manager_relationships.invited_manager_id
           FROM manager_relationships
          ORDER BY manager_relationships.member_id, manager_relationships.company_id, manager_relationships.updated_at DESC) mr ON (((pr.user_id = mr.member_id) AND (pr.company_id = mr.company_id))))
     LEFT JOIN invited_users imr ON ((mr.invited_manager_id = imr.id)))
  WHERE ((pr.status = 'pending'::text) AND (pr.processed_at IS NULL) AND (NOT (EXISTS ( SELECT 1
           FROM company_members cm
          WHERE ((cm.id = pr.user_id) AND (cm.company_id = pr.company_id))))) AND (NOT (EXISTS ( SELECT 1
           FROM invited_users iu
          WHERE ((lower(iu.email) = lower(pr.email)) AND (iu.company_id = pr.company_id))))));


CREATE OR REPLACE PROCEDURE public.setup_standard_rls(IN table_name text)
 LANGUAGE plpgsql
AS $procedure$
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
$procedure$
;

CREATE OR REPLACE FUNCTION public.transfer_manager_relationships(invited_user_id uuid, auth_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.transfer_user_profile_info(invited_user_id uuid, auth_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$function$
;

grant delete on table "public"."auth_tokens" to "anon";

grant insert on table "public"."auth_tokens" to "anon";

grant references on table "public"."auth_tokens" to "anon";

grant select on table "public"."auth_tokens" to "anon";

grant trigger on table "public"."auth_tokens" to "anon";

grant truncate on table "public"."auth_tokens" to "anon";

grant update on table "public"."auth_tokens" to "anon";

grant delete on table "public"."auth_tokens" to "authenticated";

grant insert on table "public"."auth_tokens" to "authenticated";

grant references on table "public"."auth_tokens" to "authenticated";

grant select on table "public"."auth_tokens" to "authenticated";

grant trigger on table "public"."auth_tokens" to "authenticated";

grant truncate on table "public"."auth_tokens" to "authenticated";

grant update on table "public"."auth_tokens" to "authenticated";

grant delete on table "public"."auth_tokens" to "service_role";

grant insert on table "public"."auth_tokens" to "service_role";

grant references on table "public"."auth_tokens" to "service_role";

grant select on table "public"."auth_tokens" to "service_role";

grant trigger on table "public"."auth_tokens" to "service_role";

grant truncate on table "public"."auth_tokens" to "service_role";

grant update on table "public"."auth_tokens" to "service_role";

grant delete on table "public"."companies" to "anon";

grant insert on table "public"."companies" to "anon";

grant references on table "public"."companies" to "anon";

grant select on table "public"."companies" to "anon";

grant trigger on table "public"."companies" to "anon";

grant truncate on table "public"."companies" to "anon";

grant update on table "public"."companies" to "anon";

grant delete on table "public"."companies" to "authenticated";

grant insert on table "public"."companies" to "authenticated";

grant references on table "public"."companies" to "authenticated";

grant select on table "public"."companies" to "authenticated";

grant trigger on table "public"."companies" to "authenticated";

grant truncate on table "public"."companies" to "authenticated";

grant update on table "public"."companies" to "authenticated";

grant delete on table "public"."companies" to "service_role";

grant insert on table "public"."companies" to "service_role";

grant references on table "public"."companies" to "service_role";

grant select on table "public"."companies" to "service_role";

grant trigger on table "public"."companies" to "service_role";

grant truncate on table "public"."companies" to "service_role";

grant update on table "public"."companies" to "service_role";

grant delete on table "public"."company_members" to "anon";

grant insert on table "public"."company_members" to "anon";

grant references on table "public"."company_members" to "anon";

grant select on table "public"."company_members" to "anon";

grant trigger on table "public"."company_members" to "anon";

grant truncate on table "public"."company_members" to "anon";

grant update on table "public"."company_members" to "anon";

grant delete on table "public"."company_members" to "authenticated";

grant insert on table "public"."company_members" to "authenticated";

grant references on table "public"."company_members" to "authenticated";

grant select on table "public"."company_members" to "authenticated";

grant trigger on table "public"."company_members" to "authenticated";

grant truncate on table "public"."company_members" to "authenticated";

grant update on table "public"."company_members" to "authenticated";

grant delete on table "public"."company_members" to "service_role";

grant insert on table "public"."company_members" to "service_role";

grant references on table "public"."company_members" to "service_role";

grant select on table "public"."company_members" to "service_role";

grant trigger on table "public"."company_members" to "service_role";

grant truncate on table "public"."company_members" to "service_role";

grant update on table "public"."company_members" to "service_role";

grant delete on table "public"."company_values" to "anon";

grant insert on table "public"."company_values" to "anon";

grant references on table "public"."company_values" to "anon";

grant select on table "public"."company_values" to "anon";

grant trigger on table "public"."company_values" to "anon";

grant truncate on table "public"."company_values" to "anon";

grant update on table "public"."company_values" to "anon";

grant delete on table "public"."company_values" to "authenticated";

grant insert on table "public"."company_values" to "authenticated";

grant references on table "public"."company_values" to "authenticated";

grant select on table "public"."company_values" to "authenticated";

grant trigger on table "public"."company_values" to "authenticated";

grant truncate on table "public"."company_values" to "authenticated";

grant update on table "public"."company_values" to "authenticated";

grant delete on table "public"."company_values" to "service_role";

grant insert on table "public"."company_values" to "service_role";

grant references on table "public"."company_values" to "service_role";

grant select on table "public"."company_values" to "service_role";

grant trigger on table "public"."company_values" to "service_role";

grant truncate on table "public"."company_values" to "service_role";

grant update on table "public"."company_values" to "service_role";

grant delete on table "public"."debug_logs" to "anon";

grant insert on table "public"."debug_logs" to "anon";

grant references on table "public"."debug_logs" to "anon";

grant select on table "public"."debug_logs" to "anon";

grant trigger on table "public"."debug_logs" to "anon";

grant truncate on table "public"."debug_logs" to "anon";

grant update on table "public"."debug_logs" to "anon";

grant delete on table "public"."debug_logs" to "authenticated";

grant insert on table "public"."debug_logs" to "authenticated";

grant references on table "public"."debug_logs" to "authenticated";

grant select on table "public"."debug_logs" to "authenticated";

grant trigger on table "public"."debug_logs" to "authenticated";

grant truncate on table "public"."debug_logs" to "authenticated";

grant update on table "public"."debug_logs" to "authenticated";

grant delete on table "public"."debug_logs" to "service_role";

grant insert on table "public"."debug_logs" to "service_role";

grant references on table "public"."debug_logs" to "service_role";

grant select on table "public"."debug_logs" to "service_role";

grant trigger on table "public"."debug_logs" to "service_role";

grant truncate on table "public"."debug_logs" to "service_role";

grant update on table "public"."debug_logs" to "service_role";

grant delete on table "public"."demo_leads" to "anon";

grant insert on table "public"."demo_leads" to "anon";

grant references on table "public"."demo_leads" to "anon";

grant select on table "public"."demo_leads" to "anon";

grant trigger on table "public"."demo_leads" to "anon";

grant truncate on table "public"."demo_leads" to "anon";

grant update on table "public"."demo_leads" to "anon";

grant delete on table "public"."demo_leads" to "authenticated";

grant insert on table "public"."demo_leads" to "authenticated";

grant references on table "public"."demo_leads" to "authenticated";

grant select on table "public"."demo_leads" to "authenticated";

grant trigger on table "public"."demo_leads" to "authenticated";

grant truncate on table "public"."demo_leads" to "authenticated";

grant update on table "public"."demo_leads" to "authenticated";

grant delete on table "public"."demo_leads" to "service_role";

grant insert on table "public"."demo_leads" to "service_role";

grant references on table "public"."demo_leads" to "service_role";

grant select on table "public"."demo_leads" to "service_role";

grant trigger on table "public"."demo_leads" to "service_role";

grant truncate on table "public"."demo_leads" to "service_role";

grant update on table "public"."demo_leads" to "service_role";

grant delete on table "public"."feedback_cycle_occurrences" to "anon";

grant insert on table "public"."feedback_cycle_occurrences" to "anon";

grant references on table "public"."feedback_cycle_occurrences" to "anon";

grant select on table "public"."feedback_cycle_occurrences" to "anon";

grant trigger on table "public"."feedback_cycle_occurrences" to "anon";

grant truncate on table "public"."feedback_cycle_occurrences" to "anon";

grant update on table "public"."feedback_cycle_occurrences" to "anon";

grant delete on table "public"."feedback_cycle_occurrences" to "authenticated";

grant insert on table "public"."feedback_cycle_occurrences" to "authenticated";

grant references on table "public"."feedback_cycle_occurrences" to "authenticated";

grant select on table "public"."feedback_cycle_occurrences" to "authenticated";

grant trigger on table "public"."feedback_cycle_occurrences" to "authenticated";

grant truncate on table "public"."feedback_cycle_occurrences" to "authenticated";

grant update on table "public"."feedback_cycle_occurrences" to "authenticated";

grant delete on table "public"."feedback_cycle_occurrences" to "service_role";

grant insert on table "public"."feedback_cycle_occurrences" to "service_role";

grant references on table "public"."feedback_cycle_occurrences" to "service_role";

grant select on table "public"."feedback_cycle_occurrences" to "service_role";

grant trigger on table "public"."feedback_cycle_occurrences" to "service_role";

grant truncate on table "public"."feedback_cycle_occurrences" to "service_role";

grant update on table "public"."feedback_cycle_occurrences" to "service_role";

grant delete on table "public"."feedback_cycles" to "anon";

grant insert on table "public"."feedback_cycles" to "anon";

grant references on table "public"."feedback_cycles" to "anon";

grant select on table "public"."feedback_cycles" to "anon";

grant trigger on table "public"."feedback_cycles" to "anon";

grant truncate on table "public"."feedback_cycles" to "anon";

grant update on table "public"."feedback_cycles" to "anon";

grant delete on table "public"."feedback_cycles" to "authenticated";

grant insert on table "public"."feedback_cycles" to "authenticated";

grant references on table "public"."feedback_cycles" to "authenticated";

grant select on table "public"."feedback_cycles" to "authenticated";

grant trigger on table "public"."feedback_cycles" to "authenticated";

grant truncate on table "public"."feedback_cycles" to "authenticated";

grant update on table "public"."feedback_cycles" to "authenticated";

grant delete on table "public"."feedback_cycles" to "service_role";

grant insert on table "public"."feedback_cycles" to "service_role";

grant references on table "public"."feedback_cycles" to "service_role";

grant select on table "public"."feedback_cycles" to "service_role";

grant trigger on table "public"."feedback_cycles" to "service_role";

grant truncate on table "public"."feedback_cycles" to "service_role";

grant update on table "public"."feedback_cycles" to "service_role";

grant delete on table "public"."feedback_questions" to "anon";

grant insert on table "public"."feedback_questions" to "anon";

grant references on table "public"."feedback_questions" to "anon";

grant select on table "public"."feedback_questions" to "anon";

grant trigger on table "public"."feedback_questions" to "anon";

grant truncate on table "public"."feedback_questions" to "anon";

grant update on table "public"."feedback_questions" to "anon";

grant delete on table "public"."feedback_questions" to "authenticated";

grant insert on table "public"."feedback_questions" to "authenticated";

grant references on table "public"."feedback_questions" to "authenticated";

grant select on table "public"."feedback_questions" to "authenticated";

grant trigger on table "public"."feedback_questions" to "authenticated";

grant truncate on table "public"."feedback_questions" to "authenticated";

grant update on table "public"."feedback_questions" to "authenticated";

grant delete on table "public"."feedback_questions" to "service_role";

grant insert on table "public"."feedback_questions" to "service_role";

grant references on table "public"."feedback_questions" to "service_role";

grant select on table "public"."feedback_questions" to "service_role";

grant trigger on table "public"."feedback_questions" to "service_role";

grant truncate on table "public"."feedback_questions" to "service_role";

grant update on table "public"."feedback_questions" to "service_role";

grant delete on table "public"."feedback_recipients" to "anon";

grant insert on table "public"."feedback_recipients" to "anon";

grant references on table "public"."feedback_recipients" to "anon";

grant select on table "public"."feedback_recipients" to "anon";

grant trigger on table "public"."feedback_recipients" to "anon";

grant truncate on table "public"."feedback_recipients" to "anon";

grant update on table "public"."feedback_recipients" to "anon";

grant delete on table "public"."feedback_recipients" to "authenticated";

grant insert on table "public"."feedback_recipients" to "authenticated";

grant references on table "public"."feedback_recipients" to "authenticated";

grant select on table "public"."feedback_recipients" to "authenticated";

grant trigger on table "public"."feedback_recipients" to "authenticated";

grant truncate on table "public"."feedback_recipients" to "authenticated";

grant update on table "public"."feedback_recipients" to "authenticated";

grant delete on table "public"."feedback_recipients" to "service_role";

grant insert on table "public"."feedback_recipients" to "service_role";

grant references on table "public"."feedback_recipients" to "service_role";

grant select on table "public"."feedback_recipients" to "service_role";

grant trigger on table "public"."feedback_recipients" to "service_role";

grant truncate on table "public"."feedback_recipients" to "service_role";

grant update on table "public"."feedback_recipients" to "service_role";

grant delete on table "public"."feedback_responses" to "anon";

grant insert on table "public"."feedback_responses" to "anon";

grant references on table "public"."feedback_responses" to "anon";

grant select on table "public"."feedback_responses" to "anon";

grant trigger on table "public"."feedback_responses" to "anon";

grant truncate on table "public"."feedback_responses" to "anon";

grant update on table "public"."feedback_responses" to "anon";

grant delete on table "public"."feedback_responses" to "authenticated";

grant insert on table "public"."feedback_responses" to "authenticated";

grant references on table "public"."feedback_responses" to "authenticated";

grant select on table "public"."feedback_responses" to "authenticated";

grant trigger on table "public"."feedback_responses" to "authenticated";

grant truncate on table "public"."feedback_responses" to "authenticated";

grant update on table "public"."feedback_responses" to "authenticated";

grant delete on table "public"."feedback_responses" to "service_role";

grant insert on table "public"."feedback_responses" to "service_role";

grant references on table "public"."feedback_responses" to "service_role";

grant select on table "public"."feedback_responses" to "service_role";

grant trigger on table "public"."feedback_responses" to "service_role";

grant truncate on table "public"."feedback_responses" to "service_role";

grant update on table "public"."feedback_responses" to "service_role";

grant delete on table "public"."feedback_sessions" to "anon";

grant insert on table "public"."feedback_sessions" to "anon";

grant references on table "public"."feedback_sessions" to "anon";

grant select on table "public"."feedback_sessions" to "anon";

grant trigger on table "public"."feedback_sessions" to "anon";

grant truncate on table "public"."feedback_sessions" to "anon";

grant update on table "public"."feedback_sessions" to "anon";

grant delete on table "public"."feedback_sessions" to "authenticated";

grant insert on table "public"."feedback_sessions" to "authenticated";

grant references on table "public"."feedback_sessions" to "authenticated";

grant select on table "public"."feedback_sessions" to "authenticated";

grant trigger on table "public"."feedback_sessions" to "authenticated";

grant truncate on table "public"."feedback_sessions" to "authenticated";

grant update on table "public"."feedback_sessions" to "authenticated";

grant delete on table "public"."feedback_sessions" to "service_role";

grant insert on table "public"."feedback_sessions" to "service_role";

grant references on table "public"."feedback_sessions" to "service_role";

grant select on table "public"."feedback_sessions" to "service_role";

grant trigger on table "public"."feedback_sessions" to "service_role";

grant truncate on table "public"."feedback_sessions" to "service_role";

grant update on table "public"."feedback_sessions" to "service_role";

grant delete on table "public"."feedback_summaries" to "anon";

grant insert on table "public"."feedback_summaries" to "anon";

grant references on table "public"."feedback_summaries" to "anon";

grant select on table "public"."feedback_summaries" to "anon";

grant trigger on table "public"."feedback_summaries" to "anon";

grant truncate on table "public"."feedback_summaries" to "anon";

grant update on table "public"."feedback_summaries" to "anon";

grant delete on table "public"."feedback_summaries" to "authenticated";

grant insert on table "public"."feedback_summaries" to "authenticated";

grant references on table "public"."feedback_summaries" to "authenticated";

grant select on table "public"."feedback_summaries" to "authenticated";

grant trigger on table "public"."feedback_summaries" to "authenticated";

grant truncate on table "public"."feedback_summaries" to "authenticated";

grant update on table "public"."feedback_summaries" to "authenticated";

grant delete on table "public"."feedback_summaries" to "service_role";

grant insert on table "public"."feedback_summaries" to "service_role";

grant references on table "public"."feedback_summaries" to "service_role";

grant select on table "public"."feedback_summaries" to "service_role";

grant trigger on table "public"."feedback_summaries" to "service_role";

grant truncate on table "public"."feedback_summaries" to "service_role";

grant update on table "public"."feedback_summaries" to "service_role";

grant delete on table "public"."feedback_user_identities" to "anon";

grant insert on table "public"."feedback_user_identities" to "anon";

grant references on table "public"."feedback_user_identities" to "anon";

grant select on table "public"."feedback_user_identities" to "anon";

grant trigger on table "public"."feedback_user_identities" to "anon";

grant truncate on table "public"."feedback_user_identities" to "anon";

grant update on table "public"."feedback_user_identities" to "anon";

grant delete on table "public"."feedback_user_identities" to "authenticated";

grant insert on table "public"."feedback_user_identities" to "authenticated";

grant references on table "public"."feedback_user_identities" to "authenticated";

grant select on table "public"."feedback_user_identities" to "authenticated";

grant trigger on table "public"."feedback_user_identities" to "authenticated";

grant truncate on table "public"."feedback_user_identities" to "authenticated";

grant update on table "public"."feedback_user_identities" to "authenticated";

grant delete on table "public"."feedback_user_identities" to "service_role";

grant insert on table "public"."feedback_user_identities" to "service_role";

grant references on table "public"."feedback_user_identities" to "service_role";

grant select on table "public"."feedback_user_identities" to "service_role";

grant trigger on table "public"."feedback_user_identities" to "service_role";

grant truncate on table "public"."feedback_user_identities" to "service_role";

grant update on table "public"."feedback_user_identities" to "service_role";

grant delete on table "public"."function_debug_logs" to "anon";

grant insert on table "public"."function_debug_logs" to "anon";

grant references on table "public"."function_debug_logs" to "anon";

grant select on table "public"."function_debug_logs" to "anon";

grant trigger on table "public"."function_debug_logs" to "anon";

grant truncate on table "public"."function_debug_logs" to "anon";

grant update on table "public"."function_debug_logs" to "anon";

grant delete on table "public"."function_debug_logs" to "authenticated";

grant insert on table "public"."function_debug_logs" to "authenticated";

grant references on table "public"."function_debug_logs" to "authenticated";

grant select on table "public"."function_debug_logs" to "authenticated";

grant trigger on table "public"."function_debug_logs" to "authenticated";

grant truncate on table "public"."function_debug_logs" to "authenticated";

grant update on table "public"."function_debug_logs" to "authenticated";

grant delete on table "public"."function_debug_logs" to "service_role";

grant insert on table "public"."function_debug_logs" to "service_role";

grant references on table "public"."function_debug_logs" to "service_role";

grant select on table "public"."function_debug_logs" to "service_role";

grant trigger on table "public"."function_debug_logs" to "service_role";

grant truncate on table "public"."function_debug_logs" to "service_role";

grant update on table "public"."function_debug_logs" to "service_role";

grant delete on table "public"."invited_users" to "anon";

grant insert on table "public"."invited_users" to "anon";

grant references on table "public"."invited_users" to "anon";

grant select on table "public"."invited_users" to "anon";

grant trigger on table "public"."invited_users" to "anon";

grant truncate on table "public"."invited_users" to "anon";

grant update on table "public"."invited_users" to "anon";

grant delete on table "public"."invited_users" to "authenticated";

grant insert on table "public"."invited_users" to "authenticated";

grant references on table "public"."invited_users" to "authenticated";

grant select on table "public"."invited_users" to "authenticated";

grant trigger on table "public"."invited_users" to "authenticated";

grant truncate on table "public"."invited_users" to "authenticated";

grant update on table "public"."invited_users" to "authenticated";

grant delete on table "public"."invited_users" to "service_role";

grant insert on table "public"."invited_users" to "service_role";

grant references on table "public"."invited_users" to "service_role";

grant select on table "public"."invited_users" to "service_role";

grant trigger on table "public"."invited_users" to "service_role";

grant truncate on table "public"."invited_users" to "service_role";

grant update on table "public"."invited_users" to "service_role";

grant delete on table "public"."logs" to "anon";

grant insert on table "public"."logs" to "anon";

grant references on table "public"."logs" to "anon";

grant select on table "public"."logs" to "anon";

grant trigger on table "public"."logs" to "anon";

grant truncate on table "public"."logs" to "anon";

grant update on table "public"."logs" to "anon";

grant delete on table "public"."logs" to "authenticated";

grant insert on table "public"."logs" to "authenticated";

grant references on table "public"."logs" to "authenticated";

grant select on table "public"."logs" to "authenticated";

grant trigger on table "public"."logs" to "authenticated";

grant truncate on table "public"."logs" to "authenticated";

grant update on table "public"."logs" to "authenticated";

grant delete on table "public"."logs" to "service_role";

grant insert on table "public"."logs" to "service_role";

grant references on table "public"."logs" to "service_role";

grant select on table "public"."logs" to "service_role";

grant trigger on table "public"."logs" to "service_role";

grant truncate on table "public"."logs" to "service_role";

grant update on table "public"."logs" to "service_role";

grant delete on table "public"."manager_feedback_summaries" to "anon";

grant insert on table "public"."manager_feedback_summaries" to "anon";

grant references on table "public"."manager_feedback_summaries" to "anon";

grant select on table "public"."manager_feedback_summaries" to "anon";

grant trigger on table "public"."manager_feedback_summaries" to "anon";

grant truncate on table "public"."manager_feedback_summaries" to "anon";

grant update on table "public"."manager_feedback_summaries" to "anon";

grant delete on table "public"."manager_feedback_summaries" to "authenticated";

grant insert on table "public"."manager_feedback_summaries" to "authenticated";

grant references on table "public"."manager_feedback_summaries" to "authenticated";

grant select on table "public"."manager_feedback_summaries" to "authenticated";

grant trigger on table "public"."manager_feedback_summaries" to "authenticated";

grant truncate on table "public"."manager_feedback_summaries" to "authenticated";

grant update on table "public"."manager_feedback_summaries" to "authenticated";

grant delete on table "public"."manager_feedback_summaries" to "service_role";

grant insert on table "public"."manager_feedback_summaries" to "service_role";

grant references on table "public"."manager_feedback_summaries" to "service_role";

grant select on table "public"."manager_feedback_summaries" to "service_role";

grant trigger on table "public"."manager_feedback_summaries" to "service_role";

grant truncate on table "public"."manager_feedback_summaries" to "service_role";

grant update on table "public"."manager_feedback_summaries" to "service_role";

grant delete on table "public"."manager_relationships" to "anon";

grant insert on table "public"."manager_relationships" to "anon";

grant references on table "public"."manager_relationships" to "anon";

grant select on table "public"."manager_relationships" to "anon";

grant trigger on table "public"."manager_relationships" to "anon";

grant truncate on table "public"."manager_relationships" to "anon";

grant update on table "public"."manager_relationships" to "anon";

grant delete on table "public"."manager_relationships" to "authenticated";

grant insert on table "public"."manager_relationships" to "authenticated";

grant references on table "public"."manager_relationships" to "authenticated";

grant select on table "public"."manager_relationships" to "authenticated";

grant trigger on table "public"."manager_relationships" to "authenticated";

grant truncate on table "public"."manager_relationships" to "authenticated";

grant update on table "public"."manager_relationships" to "authenticated";

grant delete on table "public"."manager_relationships" to "service_role";

grant insert on table "public"."manager_relationships" to "service_role";

grant references on table "public"."manager_relationships" to "service_role";

grant select on table "public"."manager_relationships" to "service_role";

grant trigger on table "public"."manager_relationships" to "service_role";

grant truncate on table "public"."manager_relationships" to "service_role";

grant update on table "public"."manager_relationships" to "service_role";

grant delete on table "public"."notes" to "anon";

grant insert on table "public"."notes" to "anon";

grant references on table "public"."notes" to "anon";

grant select on table "public"."notes" to "anon";

grant trigger on table "public"."notes" to "anon";

grant truncate on table "public"."notes" to "anon";

grant update on table "public"."notes" to "anon";

grant delete on table "public"."notes" to "authenticated";

grant insert on table "public"."notes" to "authenticated";

grant references on table "public"."notes" to "authenticated";

grant select on table "public"."notes" to "authenticated";

grant trigger on table "public"."notes" to "authenticated";

grant truncate on table "public"."notes" to "authenticated";

grant update on table "public"."notes" to "authenticated";

grant delete on table "public"."notes" to "service_role";

grant insert on table "public"."notes" to "service_role";

grant references on table "public"."notes" to "service_role";

grant select on table "public"."notes" to "service_role";

grant trigger on table "public"."notes" to "service_role";

grant truncate on table "public"."notes" to "service_role";

grant update on table "public"."notes" to "service_role";

grant delete on table "public"."pending_registrations" to "anon";

grant insert on table "public"."pending_registrations" to "anon";

grant references on table "public"."pending_registrations" to "anon";

grant select on table "public"."pending_registrations" to "anon";

grant trigger on table "public"."pending_registrations" to "anon";

grant truncate on table "public"."pending_registrations" to "anon";

grant update on table "public"."pending_registrations" to "anon";

grant delete on table "public"."pending_registrations" to "authenticated";

grant insert on table "public"."pending_registrations" to "authenticated";

grant references on table "public"."pending_registrations" to "authenticated";

grant select on table "public"."pending_registrations" to "authenticated";

grant trigger on table "public"."pending_registrations" to "authenticated";

grant truncate on table "public"."pending_registrations" to "authenticated";

grant update on table "public"."pending_registrations" to "authenticated";

grant delete on table "public"."pending_registrations" to "service_role";

grant insert on table "public"."pending_registrations" to "service_role";

grant references on table "public"."pending_registrations" to "service_role";

grant select on table "public"."pending_registrations" to "service_role";

grant trigger on table "public"."pending_registrations" to "service_role";

grant truncate on table "public"."pending_registrations" to "service_role";

grant update on table "public"."pending_registrations" to "service_role";

grant delete on table "public"."user_profiles" to "anon";

grant insert on table "public"."user_profiles" to "anon";

grant references on table "public"."user_profiles" to "anon";

grant select on table "public"."user_profiles" to "anon";

grant trigger on table "public"."user_profiles" to "anon";

grant truncate on table "public"."user_profiles" to "anon";

grant update on table "public"."user_profiles" to "anon";

grant delete on table "public"."user_profiles" to "authenticated";

grant insert on table "public"."user_profiles" to "authenticated";

grant references on table "public"."user_profiles" to "authenticated";

grant select on table "public"."user_profiles" to "authenticated";

grant trigger on table "public"."user_profiles" to "authenticated";

grant truncate on table "public"."user_profiles" to "authenticated";

grant update on table "public"."user_profiles" to "authenticated";

grant delete on table "public"."user_profiles" to "service_role";

grant insert on table "public"."user_profiles" to "service_role";

grant references on table "public"."user_profiles" to "service_role";

grant select on table "public"."user_profiles" to "service_role";

grant trigger on table "public"."user_profiles" to "service_role";

grant truncate on table "public"."user_profiles" to "service_role";

grant update on table "public"."user_profiles" to "service_role";

create policy "Admins can manage company"
on "public"."companies"
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = companies.id) AND (cm.role = 'admin'::user_role)))))
with check ((EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = companies.id) AND (cm.role = 'admin'::user_role)))));


create policy "Allow unregistered users to create companies"
on "public"."companies"
as permissive
for insert
to anon
with check (true);


create policy "Allow updating companies during registration flow"
on "public"."companies"
as permissive
for update
to authenticated, anon
using (true)
with check (true);


create policy "Allow users to check company domains"
on "public"."companies"
as permissive
for select
to authenticated, anon
using (true);


create policy "Allow users to create companies during registration"
on "public"."companies"
as permissive
for insert
to authenticated, anon
with check (true);


create policy "Users can view their company"
on "public"."companies"
as permissive
for select
to authenticated
using ((id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.id = auth.uid()))));


create policy "Admins can update any member status"
on "public"."company_members"
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM company_members admin_check
  WHERE ((admin_check.id = auth.uid()) AND (admin_check.company_id = company_members.company_id) AND (admin_check.role = 'admin'::user_role)))))
with check ((EXISTS ( SELECT 1
   FROM company_members admin_check
  WHERE ((admin_check.id = auth.uid()) AND (admin_check.company_id = company_members.company_id) AND (admin_check.role = 'admin'::user_role)))));


create policy "View company members"
on "public"."company_members"
as permissive
for select
to authenticated
using ((company_id = ( SELECT get_user_company_id() AS get_user_company_id)));


create policy "View own company member record"
on "public"."company_members"
as permissive
for select
to authenticated
using ((id = auth.uid()));


create policy "Admins create company values"
on "public"."company_values"
as permissive
for insert
to authenticated
with check ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));


create policy "Admins delete company values"
on "public"."company_values"
as permissive
for delete
to authenticated
using ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));


create policy "Admins update company values"
on "public"."company_values"
as permissive
for update
to authenticated
using ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))))
with check ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));


create policy "View company values"
on "public"."company_values"
as permissive
for select
to authenticated
using ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status)))));


create policy "service_role_bypass"
on "public"."company_values"
as permissive
for all
to service_role
using (true)
with check (true);


create policy "Anyone can insert a demo lead"
on "public"."demo_leads"
as permissive
for insert
to anon
with check (true);


create policy "Admins manage feedback cycle occurrences"
on "public"."feedback_cycle_occurrences"
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM (feedback_cycles fc
     JOIN company_members cm ON ((fc.company_id = cm.company_id)))
  WHERE ((feedback_cycle_occurrences.cycle_id = fc.id) AND (cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))))
with check ((EXISTS ( SELECT 1
   FROM (feedback_cycles fc
     JOIN company_members cm ON ((fc.company_id = cm.company_id)))
  WHERE ((feedback_cycle_occurrences.cycle_id = fc.id) AND (cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));


create policy "View feedback cycle occurrences"
on "public"."feedback_cycle_occurrences"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM (feedback_cycles fc
     JOIN company_members cm ON ((fc.company_id = cm.company_id)))
  WHERE ((feedback_cycle_occurrences.cycle_id = fc.id) AND (cm.id = auth.uid()) AND (cm.status = 'active'::member_status)))));


create policy "Admins can delete feedback cycles"
on "public"."feedback_cycles"
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = feedback_cycles.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));


create policy "Admins can insert feedback cycles"
on "public"."feedback_cycles"
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = feedback_cycles.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));


create policy "Admins can update feedback cycles"
on "public"."feedback_cycles"
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = feedback_cycles.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))))
with check ((EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = feedback_cycles.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));


create policy "View cycles in company"
on "public"."feedback_cycles"
as permissive
for select
to authenticated
using ((company_id = ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.id = auth.uid()))));


create policy "Admins delete feedback questions"
on "public"."feedback_questions"
as permissive
for delete
to authenticated
using (((scope = 'company'::text) AND (company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))))));


create policy "Admins manage feedback questions"
on "public"."feedback_questions"
as permissive
for insert
to authenticated
with check (((scope = 'company'::text) AND (company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))))));


create policy "Admins update feedback questions"
on "public"."feedback_questions"
as permissive
for update
to authenticated
using (((scope = 'company'::text) AND (company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))))))
with check (((scope = 'company'::text) AND (company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))))));


create policy "Authenticated users can create feedback questions of type 'ai'"
on "public"."feedback_questions"
as permissive
for insert
to authenticated
with check ((question_type = 'ai'::text));


create policy "View feedback questions"
on "public"."feedback_questions"
as permissive
for select
to authenticated
using (((scope = 'global'::text) OR ((scope = 'company'::text) AND (company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status)))))));


create policy "service_role_bypass"
on "public"."feedback_questions"
as permissive
for all
to service_role
using (true)
with check (true);


create policy "Managers view direct reports as recipients"
on "public"."feedback_recipients"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM (feedback_user_identities fui
     JOIN manager_relationships mr ON ((fui.id = mr.member_id)))
  WHERE ((feedback_recipients.recipient_id = fui.id) AND (mr.manager_id = ( SELECT auth.uid() AS uid))))));


create policy "View assigned feedback tasks"
on "public"."feedback_recipients"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM feedback_sessions fs
  WHERE ((feedback_recipients.session_id = fs.id) AND (fs.provider_id = ( SELECT auth.uid() AS uid))))));


create policy "View self as recipient"
on "public"."feedback_recipients"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM feedback_user_identities fui
  WHERE ((feedback_recipients.recipient_id = fui.id) AND (fui.id = ( SELECT auth.uid() AS uid))))));


create policy "admin_feedback_recipients"
on "public"."feedback_recipients"
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM ((feedback_sessions fs
     JOIN feedback_cycles fc ON ((fs.cycle_id = fc.id)))
     JOIN company_members cm ON ((fc.company_id = cm.company_id)))
  WHERE ((feedback_recipients.session_id = fs.id) AND (cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));


create policy "manage_own_feedback_recipients"
on "public"."feedback_recipients"
as permissive
for all
to authenticated
using ((session_id IN ( SELECT feedback_sessions.id
   FROM feedback_sessions
  WHERE (feedback_sessions.provider_id = auth.uid()))))
with check ((session_id IN ( SELECT feedback_sessions.id
   FROM feedback_sessions
  WHERE (feedback_sessions.provider_id = auth.uid()))));


create policy "manager_view_team_feedback_recipients"
on "public"."feedback_recipients"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM (feedback_user_identities fui
     JOIN manager_relationships mr ON ((fui.id = mr.member_id)))
  WHERE ((feedback_recipients.recipient_id = fui.id) AND (mr.manager_id = auth.uid()) AND ((mr.relationship_type)::text = 'direct'::text)))));


create policy "view_feedback_recipients"
on "public"."feedback_recipients"
as permissive
for select
to authenticated
using ((session_id IN ( SELECT fs.id
   FROM ((feedback_sessions fs
     JOIN feedback_cycles fc ON ((fs.cycle_id = fc.id)))
     JOIN company_members cm ON ((fc.company_id = cm.company_id)))
  WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status)))));


create policy "Create/update responses"
on "public"."feedback_responses"
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM feedback_sessions fs
  WHERE ((feedback_responses.session_id = fs.id) AND (fs.provider_id = ( SELECT auth.uid() AS uid))))));


create policy "View feedback provided"
on "public"."feedback_responses"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM feedback_sessions fs
  WHERE ((feedback_responses.session_id = fs.id) AND (fs.provider_id = ( SELECT auth.uid() AS uid))))));


create policy "View own provided responses"
on "public"."feedback_responses"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM feedback_sessions fs
  WHERE ((feedback_responses.session_id = fs.id) AND (fs.provider_id = ( SELECT auth.uid() AS uid))))));


create policy "admin_feedback_responses"
on "public"."feedback_responses"
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM ((feedback_sessions fs
     JOIN feedback_cycles fc ON ((fs.cycle_id = fc.id)))
     JOIN company_members cm ON ((fc.company_id = cm.company_id)))
  WHERE ((feedback_responses.session_id = fs.id) AND (cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));


create policy "manage_own_feedback_responses"
on "public"."feedback_responses"
as permissive
for all
to authenticated
using ((session_id IN ( SELECT feedback_sessions.id
   FROM feedback_sessions
  WHERE (feedback_sessions.provider_id = auth.uid()))))
with check ((session_id IN ( SELECT feedback_sessions.id
   FROM feedback_sessions
  WHERE (feedback_sessions.provider_id = auth.uid()))));


create policy "manager_view_team_feedback_responses"
on "public"."feedback_responses"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM ((feedback_recipients fr
     JOIN feedback_user_identities fui ON ((fr.recipient_id = fui.id)))
     JOIN manager_relationships mr ON ((fui.id = mr.member_id)))
  WHERE ((feedback_responses.recipient_id = fr.id) AND (mr.manager_id = auth.uid()) AND ((mr.relationship_type)::text = 'direct'::text)))));


create policy "view_provided_feedback_responses"
on "public"."feedback_responses"
as permissive
for select
to authenticated
using ((session_id IN ( SELECT feedback_sessions.id
   FROM feedback_sessions
  WHERE (feedback_sessions.provider_id = auth.uid()))));


create policy "view_received_feedback_responses"
on "public"."feedback_responses"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM (feedback_recipients fr
     JOIN feedback_user_identities fui ON ((fr.recipient_id = fui.id)))
  WHERE ((feedback_responses.recipient_id = fr.id) AND (fui.id = auth.uid())))));


create policy "admin_feedback_sessions"
on "public"."feedback_sessions"
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM (feedback_cycles fc
     JOIN company_members cm ON ((fc.company_id = cm.company_id)))
  WHERE ((feedback_sessions.cycle_id = fc.id) AND (cm.id = auth.uid()) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));


create policy "insert_feedback_sessions"
on "public"."feedback_sessions"
as permissive
for insert
to authenticated
with check (((provider_id = auth.uid()) AND (cycle_id IN ( SELECT fc.id
   FROM (feedback_cycles fc
     JOIN company_members cm ON ((fc.company_id = cm.company_id)))
  WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status))))));


create policy "update_feedback_sessions"
on "public"."feedback_sessions"
as permissive
for update
to authenticated
using ((provider_id = auth.uid()))
with check ((provider_id = auth.uid()));


create policy "view_feedback_sessions"
on "public"."feedback_sessions"
as permissive
for select
to authenticated
using ((cycle_id IN ( SELECT fc.id
   FROM (feedback_cycles fc
     JOIN company_members cm ON ((fc.company_id = cm.company_id)))
  WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status)))));


create policy "insert_own_summaries"
on "public"."feedback_summaries"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "view_own_summaries"
on "public"."feedback_summaries"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "View identities in company"
on "public"."feedback_user_identities"
as permissive
for select
to authenticated
using ((company_id = ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.id = auth.uid()))));


create policy "admin_delete_feedback_user_identities"
on "public"."feedback_user_identities"
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM company_members
  WHERE ((company_members.id = auth.uid()) AND (company_members.company_id = feedback_user_identities.company_id) AND (company_members.role = 'admin'::user_role) AND (company_members.status = 'active'::member_status)))));


create policy "admin_feedback_user_identities"
on "public"."feedback_user_identities"
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM company_members
  WHERE ((company_members.id = auth.uid()) AND (company_members.company_id = feedback_user_identities.company_id) AND (company_members.role = 'admin'::user_role) AND (company_members.status = 'active'::member_status)))))
with check ((EXISTS ( SELECT 1
   FROM company_members
  WHERE ((company_members.id = auth.uid()) AND (company_members.company_id = feedback_user_identities.company_id) AND (company_members.role = 'admin'::user_role) AND (company_members.status = 'active'::member_status)))));


create policy "create_feedback_user_identities"
on "public"."feedback_user_identities"
as permissive
for insert
to authenticated
with check ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE ((company_members.id = auth.uid()) AND (company_members.status = 'active'::member_status)))));


create policy "service_role_bypass"
on "public"."feedback_user_identities"
as permissive
for all
to service_role
using (true)
with check (true);


create policy "view_feedback_user_identities"
on "public"."feedback_user_identities"
as permissive
for select
to authenticated
using ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE ((company_members.id = auth.uid()) AND (company_members.status = 'active'::member_status)))));


create policy "Verify invite code"
on "public"."invited_users"
as permissive
for select
to anon
using ((invite_code IS NOT NULL));


create policy "View invited users"
on "public"."invited_users"
as permissive
for select
to authenticated
using ((company_id = ( SELECT get_user_company_id() AS get_user_company_id)));


create policy "service_role_bypass"
on "public"."invited_users"
as permissive
for all
to service_role
using (true)
with check (true);


create policy "Authenticated users can view logs"
on "public"."logs"
as permissive
for select
to authenticated
using (true);


create policy "Admins manage manager relationships"
on "public"."manager_relationships"
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = manager_relationships.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))))
with check ((EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = manager_relationships.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));


create policy "View relationships"
on "public"."manager_relationships"
as permissive
for select
to authenticated
using ((company_id = ( SELECT get_user_company_id() AS get_user_company_id)));


create policy "manage_manager_relationships"
on "public"."manager_relationships"
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = manager_relationships.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))))
with check ((EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = manager_relationships.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status)))));


create policy "Users can delete their own notes"
on "public"."notes"
as permissive
for delete
to public
using ((creator_id = auth.uid()));


create policy "Users can insert their own notes"
on "public"."notes"
as permissive
for insert
to public
with check ((creator_id = auth.uid()));


create policy "Users can update notes they created"
on "public"."notes"
as permissive
for update
to public
using ((creator_id = auth.uid()));


create policy "Users can view notes they created or are about them"
on "public"."notes"
as permissive
for select
to public
using (((creator_id = auth.uid()) OR (subject_member_id = auth.uid())));


create policy "service_role_bypass"
on "public"."pending_registrations"
as permissive
for all
to service_role
using (true)
with check (true);


create policy "insert_own_profile"
on "public"."user_profiles"
as permissive
for insert
to authenticated
with check ((id = auth.uid()));


create policy "update_own_profile"
on "public"."user_profiles"
as permissive
for update
to authenticated
using ((id = auth.uid()))
with check ((id = auth.uid()));


create policy "view_user_profiles"
on "public"."user_profiles"
as permissive
for select
to authenticated
using (true);


CREATE TRIGGER update_company_members_updated_at BEFORE UPDATE ON public.company_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_values_updated_at BEFORE UPDATE ON public.company_values FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_cycle_occurrences_updated_at BEFORE UPDATE ON public.feedback_cycle_occurrences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER create_company_member_trigger AFTER UPDATE ON public.pending_registrations FOR EACH ROW WHEN (((old.status = 'pending'::text) AND (new.status = 'processed'::text))) EXECUTE FUNCTION create_company_member_after_verification();

CREATE TRIGGER pending_registration_created AFTER INSERT ON public.pending_registrations FOR EACH ROW EXECUTE FUNCTION maintain_manager_relationships();

CREATE TRIGGER pending_registration_processed AFTER UPDATE ON public.pending_registrations FOR EACH ROW WHEN (((old.status = 'pending'::text) AND (new.status = 'processed'::text))) EXECUTE FUNCTION maintain_manager_relationships();

CREATE TRIGGER trg_migrate_invited_user_feedback AFTER INSERT ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION migrate_invited_user_feedback();


