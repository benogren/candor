// src/types/feedback.ts
import { Database } from './supabase';

// Helper type for strongly typed Supabase fetches
export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row'];

// Feedback Cycles
export type FeedbackCycle = Tables<'feedback_cycles'>;

export type FeedbackCycleStatus = 'active' | 'completed' | 'draft';
export type FeedbackFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

// Feedback Questions
export type FeedbackQuestion = Tables<'feedback_questions'>;

export type QuestionType = 'rating' | 'text';
export type QuestionScope = 'global' | 'company';

// Feedback Sessions
export type FeedbackSession = Tables<'feedback_sessions'>;

export type SessionStatus = 'pending' | 'in_progress' | 'completed';

// Feedback Recipients
export type FeedbackRecipient = Tables<'feedback_recipients'>;

export type RecipientStatus = 'pending' | 'in_progress' | 'completed';

// Feedback Responses
export type FeedbackResponse = Tables<'feedback_responses'>;

// Extended types with related data
export type FeedbackSessionWithDetails = FeedbackSession & {
  recipients?: FeedbackRecipientWithDetails[];
  cycle?: FeedbackCycle;
};

export type FeedbackRecipientWithDetails = FeedbackRecipient & {
  recipient?: {
    id: string;
    name: string;
    email: string;
  };
  responses?: FeedbackResponseWithDetails[];
};

export type FeedbackResponseWithDetails = FeedbackResponse & {
  question?: FeedbackQuestion;
};