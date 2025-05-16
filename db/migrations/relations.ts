import { relations } from "drizzle-orm/relations";
import { companies, feedbackCycles, usersInAuth, userProfiles, feedbackQuestions, companyValues, feedbackSessions, feedbackCycleOccurrences, companyMembers, feedbackUserIdentities, feedbackResponses, feedbackRecipients, invitedUsers, authTokens, feedbackSummaries, pendingRegistrations, managerFeedbackSummaries, managerRelationships } from "./schema";

export const feedbackCyclesRelations = relations(feedbackCycles, ({one, many}) => ({
	company: one(companies, {
		fields: [feedbackCycles.companyId],
		references: [companies.id]
	}),
	feedbackSessions: many(feedbackSessions),
	feedbackCycleOccurrences: many(feedbackCycleOccurrences),
}));

export const companiesRelations = relations(companies, ({many}) => ({
	feedbackCycles: many(feedbackCycles),
	feedbackQuestions: many(feedbackQuestions),
	invitedUsers: many(invitedUsers),
	pendingRegistrations: many(pendingRegistrations),
	companyMembers: many(companyMembers),
	managerRelationships: many(managerRelationships),
	companyValues: many(companyValues),
}));

export const userProfilesRelations = relations(userProfiles, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userProfiles.id],
		references: [usersInAuth.id]
	}),
	companyMembers: many(companyMembers),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	userProfiles: many(userProfiles),
	companyMembers: many(companyMembers),
	managerRelationships_managerId: many(managerRelationships, {
		relationName: "managerRelationships_managerId_usersInAuth_id"
	}),
	managerRelationships_memberId: many(managerRelationships, {
		relationName: "managerRelationships_memberId_usersInAuth_id"
	}),
}));

export const feedbackQuestionsRelations = relations(feedbackQuestions, ({one, many}) => ({
	company: one(companies, {
		fields: [feedbackQuestions.companyId],
		references: [companies.id]
	}),
	companyValue: one(companyValues, {
		fields: [feedbackQuestions.companyValueId],
		references: [companyValues.id]
	}),
	feedbackResponses: many(feedbackResponses),
}));

export const companyValuesRelations = relations(companyValues, ({one, many}) => ({
	feedbackQuestions: many(feedbackQuestions),
	company: one(companies, {
		fields: [companyValues.companyId],
		references: [companies.id]
	}),
}));

export const feedbackSessionsRelations = relations(feedbackSessions, ({one, many}) => ({
	feedbackCycle: one(feedbackCycles, {
		fields: [feedbackSessions.cycleId],
		references: [feedbackCycles.id]
	}),
	feedbackCycleOccurrence: one(feedbackCycleOccurrences, {
		fields: [feedbackSessions.occurrenceId],
		references: [feedbackCycleOccurrences.id]
	}),
	companyMember: one(companyMembers, {
		fields: [feedbackSessions.providerId],
		references: [companyMembers.id]
	}),
	feedbackResponses: many(feedbackResponses),
	feedbackRecipients: many(feedbackRecipients),
	authTokens: many(authTokens),
}));

export const feedbackCycleOccurrencesRelations = relations(feedbackCycleOccurrences, ({one, many}) => ({
	feedbackSessions: many(feedbackSessions),
	feedbackCycle: one(feedbackCycles, {
		fields: [feedbackCycleOccurrences.cycleId],
		references: [feedbackCycles.id]
	}),
}));

export const companyMembersRelations = relations(companyMembers, ({one, many}) => ({
	feedbackSessions: many(feedbackSessions),
	authTokens: many(authTokens),
	feedbackSummaries: many(feedbackSummaries),
	managerFeedbackSummaries_employeeId: many(managerFeedbackSummaries, {
		relationName: "managerFeedbackSummaries_employeeId_companyMembers_id"
	}),
	managerFeedbackSummaries_managerId: many(managerFeedbackSummaries, {
		relationName: "managerFeedbackSummaries_managerId_companyMembers_id"
	}),
	company: one(companies, {
		fields: [companyMembers.companyId],
		references: [companies.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [companyMembers.id],
		references: [usersInAuth.id]
	}),
	userProfile: one(userProfiles, {
		fields: [companyMembers.id],
		references: [userProfiles.id]
	}),
}));

export const feedbackResponsesRelations = relations(feedbackResponses, ({one}) => ({
	feedbackUserIdentity: one(feedbackUserIdentities, {
		fields: [feedbackResponses.nominatedUserId],
		references: [feedbackUserIdentities.id]
	}),
	feedbackQuestion: one(feedbackQuestions, {
		fields: [feedbackResponses.questionId],
		references: [feedbackQuestions.id]
	}),
	feedbackRecipient: one(feedbackRecipients, {
		fields: [feedbackResponses.recipientId],
		references: [feedbackRecipients.id]
	}),
	feedbackSession: one(feedbackSessions, {
		fields: [feedbackResponses.sessionId],
		references: [feedbackSessions.id]
	}),
}));

export const feedbackUserIdentitiesRelations = relations(feedbackUserIdentities, ({many}) => ({
	feedbackResponses: many(feedbackResponses),
	feedbackRecipients: many(feedbackRecipients),
}));

export const feedbackRecipientsRelations = relations(feedbackRecipients, ({one, many}) => ({
	feedbackResponses: many(feedbackResponses),
	feedbackUserIdentity: one(feedbackUserIdentities, {
		fields: [feedbackRecipients.recipientId],
		references: [feedbackUserIdentities.id]
	}),
	feedbackSession: one(feedbackSessions, {
		fields: [feedbackRecipients.sessionId],
		references: [feedbackSessions.id]
	}),
}));

export const invitedUsersRelations = relations(invitedUsers, ({one, many}) => ({
	company: one(companies, {
		fields: [invitedUsers.companyId],
		references: [companies.id]
	}),
	managerRelationships_invitedManagerId: many(managerRelationships, {
		relationName: "managerRelationships_invitedManagerId_invitedUsers_id"
	}),
	managerRelationships_invitedMemberId: many(managerRelationships, {
		relationName: "managerRelationships_invitedMemberId_invitedUsers_id"
	}),
}));

export const authTokensRelations = relations(authTokens, ({one}) => ({
	feedbackSession: one(feedbackSessions, {
		fields: [authTokens.sessionId],
		references: [feedbackSessions.id]
	}),
	companyMember: one(companyMembers, {
		fields: [authTokens.userId],
		references: [companyMembers.id]
	}),
}));

export const feedbackSummariesRelations = relations(feedbackSummaries, ({one}) => ({
	companyMember: one(companyMembers, {
		fields: [feedbackSummaries.userId],
		references: [companyMembers.id]
	}),
}));

export const pendingRegistrationsRelations = relations(pendingRegistrations, ({one}) => ({
	company: one(companies, {
		fields: [pendingRegistrations.companyId],
		references: [companies.id]
	}),
}));

export const managerFeedbackSummariesRelations = relations(managerFeedbackSummaries, ({one}) => ({
	companyMember_employeeId: one(companyMembers, {
		fields: [managerFeedbackSummaries.employeeId],
		references: [companyMembers.id],
		relationName: "managerFeedbackSummaries_employeeId_companyMembers_id"
	}),
	companyMember_managerId: one(companyMembers, {
		fields: [managerFeedbackSummaries.managerId],
		references: [companyMembers.id],
		relationName: "managerFeedbackSummaries_managerId_companyMembers_id"
	}),
}));

export const managerRelationshipsRelations = relations(managerRelationships, ({one}) => ({
	company: one(companies, {
		fields: [managerRelationships.companyId],
		references: [companies.id]
	}),
	invitedUser_invitedManagerId: one(invitedUsers, {
		fields: [managerRelationships.invitedManagerId],
		references: [invitedUsers.id],
		relationName: "managerRelationships_invitedManagerId_invitedUsers_id"
	}),
	invitedUser_invitedMemberId: one(invitedUsers, {
		fields: [managerRelationships.invitedMemberId],
		references: [invitedUsers.id],
		relationName: "managerRelationships_invitedMemberId_invitedUsers_id"
	}),
	usersInAuth_managerId: one(usersInAuth, {
		fields: [managerRelationships.managerId],
		references: [usersInAuth.id],
		relationName: "managerRelationships_managerId_usersInAuth_id"
	}),
	usersInAuth_memberId: one(usersInAuth, {
		fields: [managerRelationships.memberId],
		references: [usersInAuth.id],
		relationName: "managerRelationships_memberId_usersInAuth_id"
	}),
}));