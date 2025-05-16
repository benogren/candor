import { pgTable, index, foreignKey, pgPolicy, check, uuid, text, timestamp, jsonb, boolean, integer, unique, smallint, varchar, serial, pgView, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const memberStatus = pgEnum("member_status", ['pending', 'active', 'deactivated'])
export const userRole = pgEnum("user_role", ['admin', 'member'])

export const usersInAuth = pgTable(
  "users", 
  {
    id: uuid('id').primaryKey().notNull(),
	email: text('email'),
    // Add other fields if needed
  },
  (table) => ({
    schema: 'auth'
  })
);

export const feedbackCycles = pgTable("feedback_cycles", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	cycleName: text("cycle_name"),
	status: text().notNull(),
	startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }),
	dueDate: timestamp("due_date", { withTimezone: true, mode: 'string' }),
	frequency: text().default('weekly'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_feedback_cycles_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "feedback_cycles_company_id_fkey"
		}),
	pgPolicy("View cycles in company", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(company_id = ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.id = auth.uid())))` }),
	pgPolicy("Admins can insert feedback cycles", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Admins can update feedback cycles", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Admins can delete feedback cycles", { as: "permissive", for: "delete", to: ["authenticated"] }),
	check("feedback_cycles_frequency_check", sql`frequency = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text])`),
	check("feedback_cycles_status_check", sql`status = ANY (ARRAY['active'::text, 'completed'::text, 'draft'::text])`),
]);

export const userProfiles = pgTable("user_profiles", {
	id: uuid().primaryKey().notNull(),
	email: text().notNull(),
	name: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	additionalData: jsonb("additional_data").default({}),
	avatarUrl: text("avatar_url"),
	jobTitle: text("job_title"),
}, (table) => [
	index("user_profiles_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.id],
			foreignColumns: [usersInAuth.id],
			name: "user_profiles_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("view_user_profiles", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("update_own_profile", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("insert_own_profile", { as: "permissive", for: "insert", to: ["authenticated"] }),
]);

export const feedbackQuestions = pgTable("feedback_questions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	companyId: uuid("company_id"),
	questionText: text("question_text").notNull(),
	questionType: text("question_type").notNull(),
	scope: text().notNull(),
	active: boolean().default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	questionDescription: text("question_description"),
	questionSubtype: text("question_subtype"),
	companyValueId: uuid("company_value_id"),
	isAdminManageable: boolean("is_admin_manageable").default(true).notNull(),
}, (table) => [
	index("idx_feedback_questions_company_value_id").using("btree", table.companyValueId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "feedback_questions_company_id_fkey"
		}),
	foreignKey({
			columns: [table.companyValueId],
			foreignColumns: [companyValues.id],
			name: "feedback_questions_company_value_id_fkey"
		}).onDelete("set null"),
	pgPolicy("View feedback questions", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((scope = 'global'::text) OR ((scope = 'company'::text) AND (company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status))))))` }),
	pgPolicy("Admins manage feedback questions", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Admins update feedback questions", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Admins delete feedback questions", { as: "permissive", for: "delete", to: ["authenticated"] }),
	pgPolicy("service_role_bypass", { as: "permissive", for: "all", to: ["service_role"] }),
	pgPolicy("Authenticated users can create feedback questions of type 'ai'", { as: "permissive", for: "insert", to: ["authenticated"] }),
	check("feedback_questions_question_type_check", sql`question_type = ANY (ARRAY['rating'::text, 'text'::text, 'values'::text, 'ai'::text])`),
	check("feedback_questions_scope_check", sql`scope = ANY (ARRAY['global'::text, 'company'::text])`),
]);

export const feedbackSessions = pgTable("feedback_sessions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	cycleId: uuid("cycle_id").notNull(),
	providerId: uuid("provider_id").notNull(),
	status: text().default('pending'),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	occurrenceId: uuid("occurrence_id"),
}, (table) => [
	index("idx_feedback_sessions_occurrence_id").using("btree", table.occurrenceId.asc().nullsLast().op("uuid_ops")),
	index("idx_feedback_sessions_provider_id").using("btree", table.providerId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.cycleId],
			foreignColumns: [feedbackCycles.id],
			name: "feedback_sessions_cycle_id_fkey"
		}),
	foreignKey({
			columns: [table.occurrenceId],
			foreignColumns: [feedbackCycleOccurrences.id],
			name: "feedback_sessions_occurrence_id_fkey"
		}),
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [companyMembers.id],
			name: "feedback_sessions_provider_id_fkey"
		}),
	pgPolicy("view_feedback_sessions", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(cycle_id IN ( SELECT fc.id
   FROM (feedback_cycles fc
     JOIN company_members cm ON ((fc.company_id = cm.company_id)))
  WHERE ((cm.id = auth.uid()) AND (cm.status = 'active'::member_status))))` }),
	pgPolicy("insert_feedback_sessions", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("update_feedback_sessions", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("admin_feedback_sessions", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("feedback_sessions_status_check", sql`status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text])`),
]);

export const feedbackResponses = pgTable("feedback_responses", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	recipientId: uuid("recipient_id").notNull(),
	questionId: uuid("question_id").notNull(),
	ratingValue: integer("rating_value"),
	textResponse: text("text_response"),
	hasComment: boolean("has_comment").default(false),
	commentText: text("comment_text"),
	skipped: boolean().default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	sessionId: uuid("session_id").notNull(),
	nominatedUserId: uuid("nominated_user_id"),
	nominationDate: timestamp("nomination_date", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_feedback_responses_nominated_user_id").using("btree", table.nominatedUserId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.nominatedUserId],
			foreignColumns: [feedbackUserIdentities.id],
			name: "feedback_responses_nominated_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [feedbackQuestions.id],
			name: "feedback_responses_question_id_fkey"
		}),
	foreignKey({
			columns: [table.recipientId],
			foreignColumns: [feedbackRecipients.id],
			name: "feedback_responses_recipient_id_fkey"
		}),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [feedbackSessions.id],
			name: "feedback_responses_session_id_fkey"
		}),
	pgPolicy("Create/update responses", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(EXISTS ( SELECT 1
   FROM feedback_sessions fs
  WHERE ((feedback_responses.session_id = fs.id) AND (fs.provider_id = ( SELECT auth.uid() AS uid)))))`  }),
	pgPolicy("View own provided responses", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("manager_view_team_feedback_responses", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("View feedback provided", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("view_provided_feedback_responses", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("view_received_feedback_responses", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("manage_own_feedback_responses", { as: "permissive", for: "all", to: ["authenticated"] }),
	pgPolicy("admin_feedback_responses", { as: "permissive", for: "all", to: ["authenticated"] }),
]);

export const feedbackRecipients = pgTable("feedback_recipients", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	recipientId: uuid("recipient_id").notNull(),
	status: text().default('pending'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_feedback_recipients_session_id").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.recipientId],
			foreignColumns: [feedbackUserIdentities.id],
			name: "feedback_recipients_recipient_id_fkey"
		}),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [feedbackSessions.id],
			name: "feedback_recipients_session_id_fkey"
		}),
	pgPolicy("View self as recipient", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM feedback_user_identities fui
  WHERE ((feedback_recipients.recipient_id = fui.id) AND (fui.id = ( SELECT auth.uid() AS uid)))))` }),
	pgPolicy("View assigned feedback tasks", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Managers view direct reports as recipients", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("manager_view_team_feedback_recipients", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("view_feedback_recipients", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("manage_own_feedback_recipients", { as: "permissive", for: "all", to: ["authenticated"] }),
	pgPolicy("admin_feedback_recipients", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("feedback_recipients_status_check", sql`status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text])`),
]);

export const invitedUsers = pgTable("invited_users", {
	id: uuid().primaryKey().notNull(),
	email: text().notNull(),
	name: text(),
	role: userRole().default('member').notNull(),
	companyId: uuid("company_id"),
	inviteCode: text("invite_code"),
	status: text().default('pending'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	createdBy: uuid("created_by"),
	jobTitle: text("job_title"),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "invited_users_company_id_fkey"
		}).onDelete("cascade"),
	unique("invited_users_email_key").on(table.email),
	pgPolicy("service_role_bypass", { as: "permissive", for: "all", to: ["service_role"], using: sql`true`, withCheck: sql`true`  }),
	pgPolicy("Verify invite code", { as: "permissive", for: "select", to: ["anon"] }),
	pgPolicy("View invited users", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const authTokens = pgTable("auth_tokens", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	token: text().notNull(),
	userId: uuid("user_id").notNull(),
	type: text().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	sessionId: uuid("session_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("auth_tokens_token_idx").using("btree", table.token.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [feedbackSessions.id],
			name: "auth_tokens_session_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [companyMembers.id],
			name: "auth_tokens_user_id_fkey"
		}),
	unique("auth_tokens_token_key").on(table.token),
]);

export const feedbackSummaries = pgTable("feedback_summaries", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	timeframe: text().notNull(),
	summary: text().notNull(),
	feedbackData: jsonb("feedback_data"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	type: text(),
}, (table) => [
	index("idx_feedback_summaries_timeframe").using("btree", table.timeframe.asc().nullsLast().op("text_ops")),
	index("idx_feedback_summaries_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [companyMembers.id],
			name: "feedback_summaries_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("view_own_summaries", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("insert_own_summaries", { as: "permissive", for: "insert", to: ["public"] }),
]);

export const pendingRegistrations = pgTable("pending_registrations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	email: text().notNull(),
	name: text(),
	companyId: uuid("company_id"),
	role: userRole().default('member').notNull(),
	status: text().default('pending'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "pending_registrations_company_id_fkey"
		}).onDelete("cascade"),
	unique("pending_registrations_user_id_key").on(table.userId),
	pgPolicy("service_role_bypass", { as: "permissive", for: "all", to: ["service_role"], using: sql`true`, withCheck: sql`true`  }),
]);

export const feedbackUserIdentities = pgTable("feedback_user_identities", {
	id: uuid().primaryKey().notNull(),
	identityType: text("identity_type").notNull(),
	companyId: uuid("company_id").notNull(),
	email: text().notNull(),
	name: text(),
}, (table) => [
	pgPolicy("service_role_bypass", { as: "permissive", for: "all", to: ["service_role"], using: sql`true`, withCheck: sql`true`  }),
	pgPolicy("View identities in company", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("view_feedback_user_identities", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("create_feedback_user_identities", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("admin_feedback_user_identities", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("admin_delete_feedback_user_identities", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const managerFeedbackSummaries = pgTable("manager_feedback_summaries", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	managerId: uuid("manager_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	timeframe: text().notNull(),
	summary: text().notNull(),
	feedbackData: jsonb("feedback_data"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	type: text().notNull(),
}, (table) => [
	index("idx_manager_feedback_summaries_employee_id").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_manager_feedback_summaries_manager_id").using("btree", table.managerId.asc().nullsLast().op("uuid_ops")),
	index("idx_manager_feedback_summaries_timeframe").using("btree", table.timeframe.asc().nullsLast().op("text_ops")),
	index("idx_manager_feedback_summaries_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [companyMembers.id],
			name: "manager_feedback_summaries_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.managerId],
			foreignColumns: [companyMembers.id],
			name: "manager_feedback_summaries_manager_id_fkey"
		}).onDelete("cascade"),
]);

export const companies = pgTable("companies", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	domains: text().array().default([""]),
	industry: text(),
	stripeCustomerId: text("stripe_customer_id"),
	subscriptionId: text("subscription_id"),
	subscriptionInterval: text("subscription_interval"),
	subscriptionStatus: text("subscription_status"),
	userCount: smallint("user_count"),
	trialEnd: timestamp("trial_end", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_companies_domains").using("gin", table.domains.asc().nullsLast().op("array_ops")),
	pgPolicy("Allow updating companies during registration flow", { as: "permissive", for: "update", to: ["anon", "authenticated"], using: sql`true`, withCheck: sql`true`  }),
	pgPolicy("Users can view their company", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Allow unregistered users to create companies", { as: "permissive", for: "insert", to: ["anon"] }),
	pgPolicy("Allow users to create companies during registration", { as: "permissive", for: "insert", to: ["anon", "authenticated"] }),
	pgPolicy("Admins can manage company", { as: "permissive", for: "all", to: ["authenticated"] }),
	pgPolicy("Allow users to check company domains", { as: "permissive", for: "select", to: ["anon", "authenticated"] }),
]);

export const companyMembers = pgTable("company_members", {
	id: uuid().primaryKey().notNull(),
	companyId: uuid("company_id"),
	role: userRole().default('member').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	status: memberStatus().default('pending').notNull(),
}, (table) => [
	index("idx_company_members_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_members_company_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.id],
			foreignColumns: [usersInAuth.id],
			name: "company_members_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.id],
			foreignColumns: [userProfiles.id],
			name: "company_members_id_fkey1"
		}).onDelete("cascade"),
	pgPolicy("View own company member record", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(id = auth.uid())` }),
	pgPolicy("View company members", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Admins can update any member status", { as: "permissive", for: "update", to: ["authenticated"] }),
]);

export const managerRelationships = pgTable("manager_relationships", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	memberId: uuid("member_id"),
	managerId: uuid("manager_id"),
	relationshipType: varchar("relationship_type", { length: 20 }).default('direct'),
	companyId: uuid("company_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	invitedMemberId: uuid("invited_member_id"),
	invitedManagerId: uuid("invited_manager_id"),
}, (table) => [
	index("idx_manager_relationships_combined").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.memberId.asc().nullsLast().op("uuid_ops"), table.managerId.asc().nullsLast().op("uuid_ops")),
	index("idx_manager_relationships_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_manager_relationships_manager_id").using("btree", table.managerId.asc().nullsLast().op("uuid_ops")),
	index("idx_manager_relationships_member_id").using("btree", table.memberId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "manager_relationships_company_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.invitedManagerId],
			foreignColumns: [invitedUsers.id],
			name: "manager_relationships_invited_manager_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.invitedMemberId],
			foreignColumns: [invitedUsers.id],
			name: "manager_relationships_invited_member_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.managerId],
			foreignColumns: [usersInAuth.id],
			name: "manager_relationships_manager_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [usersInAuth.id],
			name: "manager_relationships_member_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("manage_manager_relationships", { as: "permissive", for: "all", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = manager_relationships.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))))`, withCheck: sql`(EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.id = auth.uid()) AND (cm.company_id = manager_relationships.company_id) AND (cm.role = 'admin'::user_role) AND (cm.status = 'active'::member_status))))`  }),
	pgPolicy("Admins manage manager relationships", { as: "permissive", for: "all", to: ["authenticated"] }),
	pgPolicy("View relationships", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("check_at_least_one_member", sql`((member_id IS NOT NULL) AND (invited_member_id IS NULL)) OR ((member_id IS NULL) AND (invited_member_id IS NOT NULL))`),
	check("check_manager_consistency", sql`((manager_id IS NOT NULL) AND (invited_manager_id IS NULL)) OR ((manager_id IS NULL) AND (invited_manager_id IS NOT NULL)) OR ((manager_id IS NULL) AND (invited_manager_id IS NULL))`),
]);

export const feedbackCycleOccurrences = pgTable("feedback_cycle_occurrences", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	cycleId: uuid("cycle_id").notNull(),
	occurrenceNumber: integer("occurrence_number").notNull(),
	startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { withTimezone: true, mode: 'string' }).notNull(),
	status: text().default('active').notNull(),
	emailsSentCount: integer("emails_sent_count").default(0).notNull(),
	responsesCount: integer("responses_count").default(0).notNull(),
	emailsSentAt: timestamp("emails_sent_at", { withTimezone: true, mode: 'string' }),
	remindersSentAt: timestamp("reminders_sent_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_feedback_cycle_occurrences_cycle_id").using("btree", table.cycleId.asc().nullsLast().op("uuid_ops")),
	index("idx_feedback_cycle_occurrences_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.cycleId],
			foreignColumns: [feedbackCycles.id],
			name: "feedback_cycle_occurrences_cycle_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("View feedback cycle occurrences", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM (feedback_cycles fc
     JOIN company_members cm ON ((fc.company_id = cm.company_id)))
  WHERE ((feedback_cycle_occurrences.cycle_id = fc.id) AND (cm.id = auth.uid()) AND (cm.status = 'active'::member_status))))` }),
	pgPolicy("Admins manage feedback cycle occurrences", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("feedback_cycle_occurrences_status_check", sql`status = ANY (ARRAY['active'::text, 'completed'::text])`),
]);

export const demoLeads = pgTable("demo_leads", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	company: text().notNull(),
	companySize: text("company_size").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	notes: text(),
	status: text().default('pending'),
}, (table) => [
	index("demo_leads_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	pgPolicy("Anyone can insert a demo lead", { as: "permissive", for: "insert", to: ["anon"], withCheck: sql`true`  }),
]);

export const companyValues = pgTable("company_values", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	name: text().notNull(),
	description: text().notNull(),
	icon: text(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_company_values_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_values_company_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("service_role_bypass", { as: "permissive", for: "all", to: ["service_role"], using: sql`true`, withCheck: sql`true`  }),
	pgPolicy("View company values", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Admins create company values", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Admins update company values", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Admins delete company values", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const logs = pgTable("logs", {
	id: serial().primaryKey().notNull(),
	action: text().notNull(),
	details: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	pgPolicy("Authenticated users can view logs", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]);

export const debugLogs = pgTable("debug_logs", {
	id: serial().primaryKey().notNull(),
	eventType: text("event_type"),
	userId: uuid("user_id"),
	userEmail: text("user_email"),
	details: text(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});
export const feedbackSummariesView = pgView("feedback_summaries_view", {	id: uuid(),
	userId: uuid("user_id"),
	timeframe: text(),
	summary: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	userName: text("user_name"),
	userEmail: text("user_email"),
	companyId: uuid("company_id"),
}).as(sql`SELECT fs.id, fs.user_id, fs.timeframe, fs.summary, fs.created_at, up.name AS user_name, up.email AS user_email, cm.company_id FROM feedback_summaries fs JOIN user_profiles up ON fs.user_id = up.id JOIN company_members cm ON fs.user_id = cm.id`);

export const orgStructure = pgView("org_structure", {	id: uuid(),
	role: userRole(),
	email: varchar(),
	companyId: uuid("company_id"),
	isInvited: boolean("is_invited"),
	isPending: boolean("is_pending"),
	managerId: uuid("manager_id"),
	relationshipType: varchar("relationship_type"),
}).as(sql`SELECT u.id, cm.role, p.email::character varying AS email, cm.company_id, false AS is_invited, false AS is_pending, COALESCE(mr.manager_id, imr.id) AS manager_id, COALESCE(mr.relationship_type, 'direct'::character varying) AS relationship_type FROM auth.users u JOIN company_members cm ON u.id = cm.id LEFT JOIN user_profiles p ON u.id = p.id LEFT JOIN ( SELECT DISTINCT ON (manager_relationships.member_id, manager_relationships.company_id) manager_relationships.member_id, manager_relationships.manager_id, manager_relationships.company_id, manager_relationships.relationship_type, manager_relationships.invited_manager_id FROM manager_relationships ORDER BY manager_relationships.member_id, manager_relationships.company_id, manager_relationships.updated_at DESC) mr ON u.id = mr.member_id AND cm.company_id = mr.company_id LEFT JOIN invited_users imr ON mr.invited_manager_id = imr.id WHERE cm.status = 'active'::member_status UNION ALL SELECT iu.id, iu.role, iu.email::character varying AS email, iu.company_id, true AS is_invited, false AS is_pending, COALESCE(mr.manager_id, imr.id) AS manager_id, COALESCE(mr.relationship_type, 'direct'::character varying) AS relationship_type FROM invited_users iu LEFT JOIN ( SELECT DISTINCT ON (manager_relationships.invited_member_id, manager_relationships.company_id) manager_relationships.invited_member_id, manager_relationships.manager_id, manager_relationships.company_id, manager_relationships.relationship_type, manager_relationships.invited_manager_id FROM manager_relationships ORDER BY manager_relationships.invited_member_id, manager_relationships.company_id, manager_relationships.updated_at DESC) mr ON iu.id = mr.invited_member_id AND iu.company_id = mr.company_id LEFT JOIN invited_users imr ON mr.invited_manager_id = imr.id WHERE iu.status = 'pending'::text AND NOT (EXISTS ( SELECT 1 FROM company_members cm JOIN user_profiles p ON cm.id = p.id WHERE lower(p.email) = lower(iu.email) AND cm.company_id = iu.company_id)) UNION ALL SELECT pr.user_id AS id, pr.role, pr.email::character varying AS email, pr.company_id, false AS is_invited, true AS is_pending, COALESCE(mr.manager_id, imr.id) AS manager_id, COALESCE(mr.relationship_type, 'direct'::character varying) AS relationship_type FROM pending_registrations pr LEFT JOIN ( SELECT DISTINCT ON (manager_relationships.member_id, manager_relationships.company_id) manager_relationships.member_id, manager_relationships.manager_id, manager_relationships.company_id, manager_relationships.relationship_type, manager_relationships.invited_manager_id FROM manager_relationships ORDER BY manager_relationships.member_id, manager_relationships.company_id, manager_relationships.updated_at DESC) mr ON pr.user_id = mr.member_id AND pr.company_id = mr.company_id LEFT JOIN invited_users imr ON mr.invited_manager_id = imr.id WHERE pr.status = 'pending'::text AND pr.processed_at IS NULL AND NOT (EXISTS ( SELECT 1 FROM company_members cm WHERE cm.id = pr.user_id AND cm.company_id = pr.company_id)) AND NOT (EXISTS ( SELECT 1 FROM invited_users iu WHERE lower(iu.email) = lower(pr.email) AND iu.company_id = pr.company_id))`);