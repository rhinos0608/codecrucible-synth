import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voiceSessions = pgTable("voice_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  prompt: text("prompt").notNull(),
  selectedVoices: jsonb("selected_voices").notNull(), // Object with perspectives and roles arrays
  recursionDepth: integer("recursion_depth").default(2),
  synthesisMode: text("synthesis_mode").default("competitive"),
  ethicalFiltering: boolean("ethical_filtering").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const solutions = pgTable("solutions", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => voiceSessions.id),
  voiceCombination: text("voice_combination").notNull(),
  code: text("code").notNull(),
  explanation: text("explanation").notNull(),
  confidence: integer("confidence").notNull(), // 1-100
  strengths: jsonb("strengths").notNull(), // Array of strings
  considerations: jsonb("considerations").notNull(), // Array of strings
  createdAt: timestamp("created_at").defaultNow(),
});

export const syntheses = pgTable("syntheses", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => voiceSessions.id),
  combinedCode: text("combined_code").notNull(),
  synthesisSteps: jsonb("synthesis_steps").notNull(),
  qualityScore: integer("quality_score").notNull(),
  ethicalScore: integer("ethical_score").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const phantomLedgerEntries = pgTable("phantom_ledger_entries", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => voiceSessions.id),
  title: text("title").notNull(),
  voicesEngaged: jsonb("voices_engaged").notNull(),
  decisionOutcome: text("decision_outcome").notNull(),
  keyLearnings: jsonb("key_learnings").notNull(),
  ethicalScore: integer("ethical_score").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  code: text("code").notNull(),
  language: text("language").notNull().default("javascript"),
  sessionId: integer("session_id").references(() => voiceSessions.id),
  synthesisId: integer("synthesis_id").references(() => syntheses.id),
  tags: jsonb("tags").notNull().default([]),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Security-first validation schema following AI_INSTRUCTIONS.md
export const insertVoiceSessionSchema = createInsertSchema(voiceSessions).pick({
  prompt: true,
  selectedVoices: true,
  recursionDepth: true,
  synthesisMode: true,
  ethicalFiltering: true,
}).extend({
  // Secure validation of selectedVoices structure
  selectedVoices: z.object({
    perspectives: z.array(z.string().min(1).max(50)).min(1).max(10),
    roles: z.array(z.string().min(1).max(50)).min(1).max(10)
  }),
  // Input validation following AI_INSTRUCTIONS.md security patterns
  prompt: z.string().min(1).max(2000),
  recursionDepth: z.number().int().min(1).max(5),
  synthesisMode: z.enum(["consensus", "competitive", "collaborative"]),
  ethicalFiltering: z.boolean()
});

export const insertSolutionSchema = createInsertSchema(solutions).pick({
  sessionId: true,
  voiceCombination: true,
  code: true,
  explanation: true,
  confidence: true,
  strengths: true,
  considerations: true,
});

export const insertSynthesisSchema = createInsertSchema(syntheses).pick({
  sessionId: true,
  combinedCode: true,
  synthesisSteps: true,
  qualityScore: true,
  ethicalScore: true,
});

export const insertPhantomLedgerEntrySchema = createInsertSchema(phantomLedgerEntries).pick({
  sessionId: true,
  title: true,
  voicesEngaged: true,
  decisionOutcome: true,
  keyLearnings: true,
  ethicalScore: true,
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  description: true,
  code: true,
  language: true,
  sessionId: true,
  synthesisId: true,
  tags: true,
  isPublic: true,
}).extend({
  // Security validation following AI_INSTRUCTIONS.md patterns
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  code: z.string().min(1).max(50000),
  language: z.string().min(1).max(50),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  isPublic: z.boolean().default(false)
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertVoiceSession = z.infer<typeof insertVoiceSessionSchema>;
export type VoiceSession = typeof voiceSessions.$inferSelect;

export type InsertSolution = z.infer<typeof insertSolutionSchema>;
export type Solution = typeof solutions.$inferSelect;

export type InsertSynthesis = z.infer<typeof insertSynthesisSchema>;
export type Synthesis = typeof syntheses.$inferSelect;

export type InsertPhantomLedgerEntry = z.infer<typeof insertPhantomLedgerEntrySchema>;
export type PhantomLedgerEntry = typeof phantomLedgerEntries.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
