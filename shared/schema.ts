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
  tourCompleted: boolean("tour_completed").default(false),
  subscriptionTier: varchar("subscription_tier").default("free"), // free, pro, team
  subscriptionStatus: varchar("subscription_status").default("active"), // active, canceled, past_due
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Teams table for team collaboration
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status").default("active"),
  maxMembers: integer("max_members").default(5),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team membership table
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: varchar("role").default("member"), // admin, member
  joinedAt: timestamp("joined_at").defaultNow(),
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
  // Additional fields for avatar customizer
  avatar: text("avatar").default("🤖"),
  personality: text("personality"),
  chatStyle: text("chat_style").default("analytical"),
  specialization: text("specialization"),
  ethicalStance: text("ethical_stance"),
  perspective: text("perspective"), // Primary perspective name
  role: text("role"), // Primary role name
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
  mode: varchar("mode").default("production"), // 'dev' or 'production' for tracking dev mode sessions
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

// Project folders table - Following AI_INSTRUCTIONS.md Pro tier gating and CodingPhilosophy.md pattern language
export const projectFolders = pgTable("project_folders", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3b82f6"), // Hex color for Alexander's visual patterns
  icon: varchar("icon", { length: 50 }).default("folder"), // Lucide icon name
  userId: varchar("user_id").notNull().references(() => users.id),
  parentId: integer("parent_id"), // Recursive nesting following Bateson's patterns
  isShared: boolean("is_shared").default(false),
  visibility: varchar("visibility", { length: 20 }).default("private"), // private, team, public
  sortOrder: integer("sort_order").default(0), // User-defined ordering
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enhanced project storage with folder organization - Following consciousness principles
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  code: text("code").notNull(),
  language: text("language").notNull().default("javascript"),
  sessionId: integer("session_id").references(() => voiceSessions.id),
  synthesisId: integer("synthesis_id").references(() => syntheses.id),
  chatSessionId: integer("chat_session_id").references(() => chatSessions.id), // Link to chat session for project history
  folderId: integer("folder_id").references(() => projectFolders.id), // Living organizational structure
  tags: jsonb("tags").notNull().default([]),
  isPublic: boolean("is_public").notNull().default(false),
  isTemplate: boolean("is_template").default(false), // Generative patterns from CodingPhilosophy.md
  visibility: varchar("visibility", { length: 20 }).default("private"), // private, team, public
  voiceConfiguration: jsonb("voice_configuration"), // Store voice synthesis metadata
  qualityScore: real("quality_score"), // QWAN scoring from CodingPhilosophy.md
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Folder files table for text file management - Following Alexander's Pattern Language
export const folderFiles = pgTable("folder_files", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id").notNull().references(() => projectFolders.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  fileType: varchar("file_type", { length: 50 }).default("text"),
  language: varchar("language", { length: 50 }).default("text"),
  description: text("description"),
  tags: jsonb("tags").default([]),
  isContextEnabled: boolean("is_context_enabled").default(false), // AI context integration
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat sessions table - Following AI_INSTRUCTIONS.md security patterns and Jung's consciousness principles
export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => voiceSessions.id).notNull(), // Link to original generation session
  userId: varchar("user_id").references(() => users.id).notNull(),
  selectedVoice: varchar("selected_voice", { length: 100 }).notNull(), // The voice chosen for conversation
  initialSolutionId: integer("initial_solution_id").references(() => solutions.id), // The solution that started the chat
  contextData: jsonb("context_data").notNull(), // Store initial code and solution context
  isActive: boolean("is_active").default(true),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat messages table - Multi-voice consciousness tracking following CodingPhilosophy.md
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  chatSessionId: integer("chat_session_id").references(() => chatSessions.id).notNull(),
  messageType: varchar("message_type", { length: 20 }).notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  voiceType: varchar("voice_type", { length: 100 }), // The voice that generated this message
  metadata: jsonb("metadata"), // Store code suggestions, confidence scores, etc.
  messageIndex: integer("message_index").notNull(), // Order in conversation
  createdAt: timestamp("created_at").defaultNow(),
});

// User uploaded files table - Following Jung's Descent Protocol for consciousness-driven file management
export const userFiles = pgTable("user_files", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  originalName: varchar("original_name", { length: 500 }).notNull(),
  fileName: varchar("file_name", { length: 500 }).notNull(), // Sanitized filename
  content: text("content").notNull(), // File content as text
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(), // Size in bytes
  encoding: varchar("encoding", { length: 50 }).default("utf-8"),
  language: varchar("language", { length: 50 }),
  isContextAvailable: boolean("is_context_available").default(true), // Can be used as AI context
  usageCount: integer("usage_count").default(0), // Track how often file is used in prompts
  projectId: integer("project_id").references(() => projects.id), // Optional link to project
  sessionId: integer("session_id").references(() => voiceSessions.id), // Optional link to session
  tags: jsonb("tags").default([]),
  metadata: jsonb("metadata").default({}), // File-specific metadata (line count, complexity, etc.)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("user_files_user_idx").on(table.userId),
  index("user_files_project_idx").on(table.projectId),
  index("user_files_session_idx").on(table.sessionId),
]);

// Session file attachments table - Link files to specific voice sessions
export const sessionFileAttachments = pgTable("session_file_attachments", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => voiceSessions.id, { onDelete: "cascade" }),
  fileId: integer("file_id").notNull().references(() => userFiles.id, { onDelete: "cascade" }),
  attachmentOrder: integer("attachment_order").default(0), // Order files were attached
  isContextEnabled: boolean("is_context_enabled").default(true), // Whether to include in AI context
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("session_files_session_idx").on(table.sessionId),
  index("session_files_file_idx").on(table.fileId),
]);

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



// Subscription history
export const subscriptionHistory = pgTable("subscription_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  tier: varchar("tier").notNull(), // free, pro, team
  action: varchar("action").notNull(), // created, upgraded, downgraded, canceled, reactivated
  previousTier: varchar("previous_tier"),
  amount: integer("amount"), // In cents
  currency: varchar("currency").default("usd"),
  teamId: integer("team_id").references(() => teams.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Voice preference learning
export const voicePreferences = pgTable("voice_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  promptPattern: text("prompt_pattern").notNull(), // Detected pattern type (e.g., "react_component", "api_endpoint")
  preferredPerspectives: text("preferred_perspectives").array(),
  preferredRoles: text("preferred_roles").array(),
  acceptanceRate: real("acceptance_rate").default(0), // How often user accepts recommendations
  successRate: real("success_rate").default(0), // How often these combinations succeed
  sampleCount: integer("sample_count").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  index("voice_prefs_user_pattern_idx").on(table.userId, table.promptPattern),
]);

// Team shared voice profiles
export const teamVoiceProfiles = pgTable("team_voice_profiles", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  selectedPerspectives: jsonb("selected_perspectives").notNull(),
  selectedRoles: jsonb("selected_roles").notNull(),
  analysisDepth: integer("analysis_depth").default(2),
  mergeStrategy: text("merge_strategy").default("competitive"),
  qualityFiltering: boolean("quality_filtering").default(true),
  isShared: boolean("is_shared").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment methods for tracking
export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  stripePaymentMethodId: varchar("stripe_payment_method_id").notNull(),
  last4: varchar("last4"),
  brand: varchar("brand"),
  expiryMonth: integer("expiry_month"),
  expiryYear: integer("expiry_year"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas  
export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const insertVoiceProfileSchema = createInsertSchema(voiceProfiles).pick({
  name: true,
  description: true,
  selectedPerspectives: true,
  selectedRoles: true,
  analysisDepth: true,
  mergeStrategy: true,
  qualityFiltering: true,
  isDefault: true,
  avatar: true,
  personality: true,
  chatStyle: true,
  specialization: true,
  ethicalStance: true,
  perspective: true,
  role: true,
}).extend({
  // Security validation following AI_INSTRUCTIONS.md patterns
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  selectedPerspectives: z.array(z.string()).min(1),
  selectedRoles: z.array(z.string()).min(1),
  specialization: z.string().max(500),
  perspective: z.string().min(1).max(50),
  role: z.string().min(1).max(50)
});

// File upload schemas - Following AI_INSTRUCTIONS.md security patterns
export const insertUserFileSchema = createInsertSchema(userFiles).pick({
  originalName: true,
  fileName: true,
  content: true,
  mimeType: true,
  fileSize: true,
  encoding: true,
  language: true,
  isContextAvailable: true,
  projectId: true,
  sessionId: true,
  tags: true,
  metadata: true,
}).extend({
  // Security validation with file size limits and content sanitization
  originalName: z.string().min(1).max(500),
  fileName: z.string().min(1).max(500),
  content: z.string().max(10000000), // 10MB text content limit
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().min(0).max(10485760), // 10MB limit
  encoding: z.string().max(50).optional(),
  language: z.string().max(50).optional(),
  isContextAvailable: z.boolean().default(true),
  projectId: z.number().int().optional(),
  sessionId: z.number().int().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({})
});

export const insertSessionFileAttachmentSchema = createInsertSchema(sessionFileAttachments).pick({
  sessionId: true,
  fileId: true,
  attachmentOrder: true,
  isContextEnabled: true,
}).extend({
  sessionId: z.number().int().min(1),
  fileId: z.number().int().min(1),
  attachmentOrder: z.number().int().min(0).default(0),
  isContextEnabled: z.boolean().default(true)
});

// Chat schema validation following AI_INSTRUCTIONS.md security patterns
export const insertChatSessionSchema = createInsertSchema(chatSessions).pick({
  sessionId: true,
  userId: true,
  selectedVoice: true,
  initialSolutionId: true,
  contextData: true,
  isActive: true,
}).extend({
  sessionId: z.number().int().min(1),
  userId: z.string().min(1),
  selectedVoice: z.string().min(1).max(100),
  initialSolutionId: z.number().int().min(1).optional(),
  contextData: z.record(z.any()),
  isActive: z.boolean().default(true)
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  chatSessionId: true,
  messageType: true,
  content: true,
  voiceType: true,
  metadata: true,
  messageIndex: true,
}).extend({
  chatSessionId: z.number().int().min(1),
  messageType: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(10000),
  voiceType: z.string().max(100).optional(),
  metadata: z.record(z.any()).optional(),
  messageIndex: z.number().int().min(0)
});

// Type exports for TypeScript
export type UserFile = typeof userFiles.$inferSelect;
export type InsertUserFile = z.infer<typeof insertUserFileSchema>;
export type SessionFileAttachment = typeof sessionFileAttachments.$inferSelect;
export type InsertSessionFileAttachment = z.infer<typeof insertSessionFileAttachmentSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// Security-first validation schema following AI_INSTRUCTIONS.md
export const insertVoiceSessionSchema = createInsertSchema(voiceSessions).pick({
  userId: true,
  prompt: true,
  selectedVoices: true,
  recursionDepth: true,
  synthesisMode: true,
  ethicalFiltering: true,
  mode: true,
}).extend({
  // Secure validation of selectedVoices structure
  selectedVoices: z.object({
    perspectives: z.array(z.string().min(1).max(50)).default([]),
    roles: z.array(z.string().min(1).max(50)).default([])
  }).refine(data => data.perspectives.length > 0 || data.roles.length > 0, {
    message: "At least one perspective or role must be selected"
  }),
  // Input validation following AI_INSTRUCTIONS.md security patterns
  userId: z.string().min(1),
  prompt: z.string().min(1).max(15000), // Extended for dev mode
  recursionDepth: z.number().int().min(1).max(5),
  synthesisMode: z.enum(["consensus", "competitive", "collaborative"]),
  ethicalFiltering: z.boolean(),
  mode: z.enum(["production", "development"]).default("production")
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

// Project folder insert schema with Pro tier validation
export const insertProjectFolderSchema = createInsertSchema(projectFolders).pick({
  name: true,
  description: true,
  color: true,
  icon: true,
  userId: true,
  parentId: true,
  isShared: true,
  visibility: true,
  sortOrder: true,
}).extend({
  // Security validation following AI_INSTRUCTIONS.md patterns
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().min(1).max(50).optional(),
  userId: z.string().min(1),
  parentId: z.number().int().positive().optional().nullable(),
  isShared: z.boolean().default(false),
  visibility: z.enum(['private', 'team', 'public']).default('private'),
  sortOrder: z.number().int().min(0).default(0)
});

// Enhanced project insert schema with folder organization
export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  description: true,
  code: true,
  language: true,
  userId: true,
  sessionId: true,
  synthesisId: true,
  folderId: true,
  tags: true,
  isPublic: true,
  isTemplate: true,
  visibility: true,
  voiceConfiguration: true,
  qualityScore: true,
}).extend({
  // Security validation following AI_INSTRUCTIONS.md patterns
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  code: z.string().min(1),
  language: z.string().min(1).max(50).default('javascript'),
  userId: z.string().min(1), // Required for project ownership
  sessionId: z.number().int().positive().nullable().optional(),
  synthesisId: z.number().int().positive().nullable().optional(),
  chatSessionId: z.number().int().positive().nullable().optional(),
  folderId: z.number().int().positive().nullable().optional(),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
  isTemplate: z.boolean().default(false),
  visibility: z.enum(['private', 'team', 'public']).default('private'),
  voiceConfiguration: z.object({}).optional(),
  qualityScore: z.number().min(0).max(100).optional()
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

// New table schemas for subscription management
export const insertTeamSchema = createInsertSchema(teams).pick({
  name: true,
  description: true,
  ownerId: true,
  maxMembers: true,
}).extend({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  maxMembers: z.number().int().min(1).max(50).default(5),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).pick({
  teamId: true,
  userId: true,
  role: true,
}).extend({
  role: z.enum(["admin", "member"]).default("member"),
});

// Will be defined later after usageLimits table

export const insertSubscriptionHistorySchema = createInsertSchema(subscriptionHistory).pick({
  userId: true,
  stripeSubscriptionId: true,
  tier: true,
  action: true,
  previousTier: true,
  amount: true,
  currency: true,
  teamId: true,
}).extend({
  tier: z.enum(["free", "pro", "team"]),
  action: z.enum(["created", "upgraded", "downgraded", "canceled", "reactivated"]),
  previousTier: z.enum(["free", "pro", "team"]).optional(),
  currency: z.string().default("usd"),
});

export const insertVoicePreferencesSchema = createInsertSchema(voicePreferences).pick({
  userId: true,
  promptPattern: true,
  preferredPerspectives: true,
  preferredRoles: true,
  acceptanceRate: true,
  successRate: true,
  sampleCount: true,
}).extend({
  promptPattern: z.string().min(1).max(100),
  preferredPerspectives: z.array(z.string()).optional(),
  preferredRoles: z.array(z.string()).optional(),
  acceptanceRate: z.number().min(0).max(1).default(0),
  successRate: z.number().min(0).max(1).default(0),
  sampleCount: z.number().int().min(0).default(0),
});

export const insertTeamVoiceProfileSchema = createInsertSchema(teamVoiceProfiles).pick({
  teamId: true,
  createdBy: true,
  name: true,
  description: true,
  selectedPerspectives: true,
  selectedRoles: true,
  analysisDepth: true,
  mergeStrategy: true,
  qualityFiltering: true,
  isShared: true,
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).pick({
  userId: true,
  stripePaymentMethodId: true,
  last4: true,
  brand: true,
  expiryMonth: true,
  expiryYear: true,
  isDefault: true,
});

// Types - consolidating duplicates
export type UpsertUser = typeof users.$inferInsert;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ProjectFolder = typeof projectFolders.$inferSelect;
export type InsertProjectFolder = z.infer<typeof insertProjectFolderSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

// Usage limits table for quota enforcement following AI_INSTRUCTIONS.md
export const usageLimits = pgTable("usage_limits", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: varchar("date").notNull(), // YYYY-MM-DD format
  generationsUsed: integer("generations_used").default(0).notNull(),
  generationsLimit: integer("generations_limit").default(3).notNull(),
  lastResetAt: timestamp("last_reset_at").defaultNow(),
  synthesisUsed: integer("synthesis_used").default(0).notNull(),
  synthesisLimit: integer("synthesis_limit").default(0).notNull(),
}, (table) => [
  index("usage_limits_user_date_idx").on(table.userId, table.date),
]);

export const insertUsageLimitSchema = createInsertSchema(usageLimits).omit({
  id: true,
});

export const insertUsageLimitsSchema = createInsertSchema(usageLimits).pick({
  userId: true,
  date: true,
  generationsUsed: true,
  generationsLimit: true,
});

export type InsertUsageLimit = z.infer<typeof insertUsageLimitSchema>;
export type UsageLimit = typeof usageLimits.$inferSelect;

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

// Folder file insert schema with validation
export const insertFolderFileSchema = createInsertSchema(folderFiles).pick({
  folderId: true,
  name: true,
  content: true,
  fileType: true,
  language: true,
  description: true,
  tags: true,
  isContextEnabled: true,
}).extend({
  name: z.string().min(1).max(255),
  content: z.string().min(1),
  fileType: z.string().min(1).max(50).default("text"),
  language: z.string().min(1).max(50).default("text"),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).default([]),
  isContextEnabled: z.boolean().default(false),
});

export type FolderFile = typeof folderFiles.$inferSelect;
export type InsertFolderFile = z.infer<typeof insertFolderFileSchema>;

export type InsertUserAnalytics = z.infer<typeof insertUserAnalyticsSchema>;
export type UserAnalytics = typeof userAnalytics.$inferSelect;

export type InsertVoiceUsageStats = z.infer<typeof insertVoiceUsageStatsSchema>;
export type VoiceUsageStats = typeof voiceUsageStats.$inferSelect;

export type InsertSessionAnalytics = z.infer<typeof insertSessionAnalyticsSchema>;
export type SessionAnalytics = typeof sessionAnalytics.$inferSelect;

export type InsertDailyUsageMetrics = z.infer<typeof insertDailyUsageMetricsSchema>;
export type DailyUsageMetrics = typeof dailyUsageMetrics.$inferSelect;

// New types for subscription management
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

export type UsageLimits = typeof usageLimits.$inferSelect;
export type InsertUsageLimits = z.infer<typeof insertUsageLimitsSchema>;

export type SubscriptionHistory = typeof subscriptionHistory.$inferSelect;
export type InsertSubscriptionHistory = z.infer<typeof insertSubscriptionHistorySchema>;

export type VoicePreference = typeof voicePreferences.$inferSelect;
export type InsertVoicePreference = z.infer<typeof insertVoicePreferencesSchema>;

export type TeamVoiceProfile = typeof teamVoiceProfiles.$inferSelect;
export type InsertTeamVoiceProfile = z.infer<typeof insertTeamVoiceProfileSchema>;

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;

// Project folder types following AI_INSTRUCTIONS.md patterns
export type ProjectFolder = typeof projectFolders.$inferSelect;
export type InsertProjectFolder = z.infer<typeof insertProjectFolderSchema>;
