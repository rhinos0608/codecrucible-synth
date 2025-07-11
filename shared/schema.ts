import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, index, date, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(), // Replit user ID
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Voice preference profiles for users
export const voiceProfiles = pgTable("voice_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  selectedPerspectives: jsonb("selected_perspectives").notNull(), // Array of perspective IDs
  selectedRoles: jsonb("selected_roles").notNull(), // Array of role IDs
  analysisDepth: integer("analysis_depth").default(2),
  mergeStrategy: text("merge_strategy").default("competitive"),
  qualityFiltering: boolean("quality_filtering").default(true),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const voiceSessions = pgTable("voice_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
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
  userId: varchar("user_id").references(() => users.id),
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

// Analytics tables for tracking user behavior and preferences
export const userAnalytics = pgTable("user_analytics", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  eventType: varchar("event_type").notNull(), // "session_created", "synthesis_completed", "voice_selected", etc.
  eventData: jsonb("event_data").notNull(),
  voiceCombination: text("voice_combination").array(),
  sessionId: integer("session_id").references(() => voiceSessions.id),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [index("user_analytics_user_idx").on(table.userId)]);

export const voiceUsageStats = pgTable("voice_usage_stats", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  voiceType: varchar("voice_type").notNull(), // "perspective" or "role"
  voiceName: varchar("voice_name").notNull(),
  usageCount: integer("usage_count").default(0),
  successCount: integer("success_count").default(0),
  lastUsed: timestamp("last_used").defaultNow(),
  averageRating: real("average_rating"),
}, (table) => [
  index("voice_usage_user_idx").on(table.userId),
  index("voice_usage_composite_idx").on(table.userId, table.voiceType, table.voiceName),
]);

export const sessionAnalytics = pgTable("session_analytics", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => voiceSessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  generationTime: integer("generation_time"), // milliseconds
  synthesisTime: integer("synthesis_time"), // milliseconds
  solutionCount: integer("solution_count").default(0),
  userRating: varchar("user_rating"), // 'excellent', 'good', 'bad', 'none'
  voicesUsed: text("voices_used").array(),
  promptLength: integer("prompt_length"),
  promptComplexity: integer("prompt_complexity"), // 1, 2, or 3
  createdAt: timestamp("created_at").defaultNow(),
});

export const dailyUsageMetrics = pgTable("daily_usage_metrics", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  generationCount: integer("generation_count").default(0),
  synthesisCount: integer("synthesis_count").default(0),
  uniqueVoiceCombinations: integer("unique_voice_combinations").default(0),
  totalGenerationTime: integer("total_generation_time").default(0), // milliseconds
  averageSessionRating: real("average_session_rating"),
}, (table) => [
  index("daily_metrics_user_date_idx").on(table.userId, table.date),
]);

// Insert schemas  
export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const insertVoiceProfileSchema = createInsertSchema(voiceProfiles).pick({
  userId: true,
  name: true,
  description: true,
  selectedPerspectives: true,
  selectedRoles: true,
  analysisDepth: true,
  mergeStrategy: true,
  qualityFiltering: true,
  isDefault: true,
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

// Analytics insert schemas with security validation
export const insertUserAnalyticsSchema = createInsertSchema(userAnalytics).pick({
  userId: true,
  eventType: true,
  eventData: true,
  voiceCombination: true,
  sessionId: true,
}).extend({
  eventType: z.enum([
    "session_created",
    "synthesis_completed", 
    "voice_selected",
    "recommendation_applied",
    "recommendation_rejected",
    "rating_submitted"
  ]),
  eventData: z.record(z.any()),
  voiceCombination: z.array(z.string()).optional(),
});

export const insertVoiceUsageStatsSchema = createInsertSchema(voiceUsageStats).pick({
  userId: true,
  voiceType: true,
  voiceName: true,
  usageCount: true,
  successCount: true,
  averageRating: true,
}).extend({
  voiceType: z.enum(["perspective", "role"]),
  voiceName: z.string().min(1).max(50),
  usageCount: z.number().int().min(0).default(0),
  successCount: z.number().int().min(0).default(0),
  averageRating: z.number().min(0).max(5).optional(),
});

export const insertSessionAnalyticsSchema = createInsertSchema(sessionAnalytics).pick({
  sessionId: true,
  userId: true,
  generationTime: true,
  synthesisTime: true,
  solutionCount: true,
  userRating: true,
  voicesUsed: true,
  promptLength: true,
  promptComplexity: true,
}).extend({
  userRating: z.enum(["excellent", "good", "bad", "none"]).optional(),
  voicesUsed: z.array(z.string()),
  promptComplexity: z.number().int().min(1).max(3),
});

export const insertDailyUsageMetricsSchema = createInsertSchema(dailyUsageMetrics).pick({
  userId: true,
  date: true,
  generationCount: true,
  synthesisCount: true,
  uniqueVoiceCombinations: true,
  totalGenerationTime: true,
  averageSessionRating: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertVoiceProfile = z.infer<typeof insertVoiceProfileSchema>;
export type VoiceProfile = typeof voiceProfiles.$inferSelect;

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

export type InsertUserAnalytics = z.infer<typeof insertUserAnalyticsSchema>;
export type UserAnalytics = typeof userAnalytics.$inferSelect;

export type InsertVoiceUsageStats = z.infer<typeof insertVoiceUsageStatsSchema>;
export type VoiceUsageStats = typeof voiceUsageStats.$inferSelect;

export type InsertSessionAnalytics = z.infer<typeof insertSessionAnalyticsSchema>;
export type SessionAnalytics = typeof sessionAnalytics.$inferSelect;

export type InsertDailyUsageMetrics = z.infer<typeof insertDailyUsageMetricsSchema>;
export type DailyUsageMetrics = typeof dailyUsageMetrics.$inferSelect;
