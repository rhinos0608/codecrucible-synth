// Real-Time Collaboration Database Schema - AI_INSTRUCTIONS.md Security Patterns
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./schema";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Collaborative sessions table
export const collaborativeSessions = pgTable("collaborative_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  creatorId: text("creator_id").references(() => users.id).notNull(),
  teamId: text("team_id"),
  shareableLink: varchar("shareable_link", { length: 100 }).unique().notNull(),
  accessType: varchar("access_type", { length: 20 }).default("team_only"), // public, team_only, invite_only
  prompt: text("prompt"),
  selectedVoices: jsonb("selected_voices").default([]),
  voiceOutputs: jsonb("voice_outputs").default({}),
  synthesis: jsonb("synthesis"),
  status: varchar("status", { length: 20 }).default("active"), // active, paused, completed
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  lastActivity: timestamp("last_activity").defaultNow()
});

// Session participants table (real-time tracking)
export const sessionParticipants = pgTable("session_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => collaborativeSessions.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 20 }).default("collaborator"), // creator, collaborator, observer
  assignedVoices: jsonb("assigned_voices").default([]),
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  cursorData: jsonb("cursor_data")
});

// Chat messages table
export const sessionChat = pgTable("session_chat", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => collaborativeSessions.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  message: text("message").notNull(),
  messageType: varchar("message_type", { length: 20 }).default("text"), // text, voice_assignment, system
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow()
});

// Voice assignments tracking table
export const voiceAssignments = pgTable("voice_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => collaborativeSessions.id, { onDelete: "cascade" }).notNull(),
  voiceType: varchar("voice_type", { length: 50 }).notNull(),
  assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
  status: varchar("status", { length: 20 }).default("available"), // available, assigned, generating, completed
  output: jsonb("output"),
  assignedAt: timestamp("assigned_at"),
  completedAt: timestamp("completed_at")
});

// Create Zod schemas for type safety
export const insertCollaborativeSessionSchema = createInsertSchema(collaborativeSessions);
export const insertSessionParticipantSchema = createInsertSchema(sessionParticipants);
export const insertSessionChatSchema = createInsertSchema(sessionChat);
export const insertVoiceAssignmentSchema = createInsertSchema(voiceAssignments);

// Type exports
export type CollaborativeSession = typeof collaborativeSessions.$inferSelect;
export type SessionParticipant = typeof sessionParticipants.$inferSelect;
export type SessionChat = typeof sessionChat.$inferSelect;
export type VoiceAssignment = typeof voiceAssignments.$inferSelect;

export type InsertCollaborativeSession = z.infer<typeof insertCollaborativeSessionSchema>;
export type InsertSessionParticipant = z.infer<typeof insertSessionParticipantSchema>;
export type InsertSessionChat = z.infer<typeof insertSessionChatSchema>;
export type InsertVoiceAssignment = z.infer<typeof insertVoiceAssignmentSchema>;

// WebSocket message types for real-time collaboration
export const collaborationMessageSchema = z.object({
  type: z.enum([
    'update_prompt',
    'voice_assignment', 
    'voice_generation_start',
    'voice_output',
    'chat_message',
    'cursor_update',
    'synthesis_request',
    'participant_joined',
    'participant_left',
    'session_state',
    'ping',
    'pong'
  ]),
  sessionId: z.string().uuid(),
  userId: z.string(),
  data: z.any(),
  timestamp: z.date().optional()
});

export type CollaborationMessage = z.infer<typeof collaborationMessageSchema>;

// Session participant interface for real-time tracking
export interface SessionParticipantInfo {
  userId: string;
  name: string;
  avatar?: string;
  role: 'creator' | 'collaborator' | 'observer';
  assignedVoices: string[];
  isActive: boolean;
  joinedAt: Date;
  lastSeenAt: Date;
  cursor?: {
    section: 'prompt' | 'voice_selection' | 'output' | 'synthesis';
    position?: { line: number; column: number };
  };
}

// Voice assignment interface
export interface VoiceAssignmentInfo {
  voiceType: string;
  assignedTo?: string;
  status: 'available' | 'assigned' | 'generating' | 'completed';
  output?: any;
  assignedAt?: Date;
}

// Complete session state interface
export interface CollaborativeSessionState {
  session: CollaborativeSession;
  participants: SessionParticipantInfo[];
  voiceAssignments: VoiceAssignmentInfo[];
  chatMessages: SessionChat[];
  recentActivity: any[];
}