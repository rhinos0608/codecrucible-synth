// Team Collaboration Database Schema - AI_INSTRUCTIONS.md Security Patterns
import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Teams table
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ownerId: text('owner_id').notNull(),
  subscriptionTier: text('subscription_tier').default('team'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Team members table
export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').references(() => teams.id),
  userId: text('user_id').notNull(),
  role: text('role').default('member'), // owner, admin, member
  permissions: jsonb('permissions'),
  joinedAt: timestamp('joined_at').defaultNow(),
});

// Collaborative sessions table
export const collaborativeSessions = pgTable('collaborative_sessions', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').references(() => teams.id),
  initiatorId: text('initiator_id').notNull(),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  status: text('status').default('active'), // active, paused, completed
  sharedVoices: jsonb('shared_voices'),
  participants: jsonb('participants'),
  liveDocument: jsonb('live_document'),
  voiceOutputs: jsonb('voice_outputs'),
  chatHistory: jsonb('chat_history'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Shared voice profiles table
export const sharedVoiceProfiles = pgTable('shared_voice_profiles', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').references(() => teams.id),
  voiceProfileId: integer('voice_profile_id'),
  sharedBy: text('shared_by').notNull(),
  accessLevel: text('access_level').default('read'), // read, write, admin
  isPublic: boolean('is_public').default(false),
  usageCount: integer('usage_count').default(0),
  sharedAt: timestamp('shared_at').defaultNow(),
});

// Create Zod schemas for type safety following AI_INSTRUCTIONS.md patterns
export const insertTeamSchema = createInsertSchema(teams);
export const insertTeamMemberSchema = createInsertSchema(teamMembers);
export const insertCollaborativeSessionSchema = createInsertSchema(collaborativeSessions);
export const insertSharedVoiceProfileSchema = createInsertSchema(sharedVoiceProfiles);

// Type exports
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type CollaborativeSession = typeof collaborativeSessions.$inferSelect;
export type SharedVoiceProfile = typeof sharedVoiceProfiles.$inferSelect;

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type InsertCollaborativeSession = z.infer<typeof insertCollaborativeSessionSchema>;
export type InsertSharedVoiceProfile = z.infer<typeof insertSharedVoiceProfileSchema>;
