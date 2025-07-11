import { 
  users, 
  voiceSessions, 
  solutions, 
  syntheses, 
  phantomLedgerEntries,
  projects,
  voiceProfiles,
  userAnalytics,
  voiceUsageStats,
  sessionAnalytics,
  dailyUsageMetrics,
  type User, 
  type UpsertUser,
  type VoiceSession,
  type InsertVoiceSession,
  type Solution,
  type InsertSolution,
  type Synthesis,
  type InsertSynthesis,
  type PhantomLedgerEntry,
  type InsertPhantomLedgerEntry,
  type Project,
  type InsertProject,
  type VoiceProfile,
  type InsertVoiceProfile,
  type UserAnalytics,
  type InsertUserAnalytics,
  type VoiceUsageStats,
  type InsertVoiceUsageStats,
  type SessionAnalytics,
  type InsertSessionAnalytics,
  type DailyUsageMetrics,
  type InsertDailyUsageMetrics
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  // User operations for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Voice profile operations
  createVoiceProfile(profile: InsertVoiceProfile): Promise<VoiceProfile>;
  getVoiceProfiles(userId: string): Promise<VoiceProfile[]>;
  getVoiceProfile(id: number): Promise<VoiceProfile | undefined>;
  updateVoiceProfile(id: number, updates: Partial<InsertVoiceProfile>): Promise<VoiceProfile | undefined>;
  deleteVoiceProfile(id: number): Promise<boolean>;
  setDefaultVoiceProfile(userId: string, profileId: number): Promise<boolean>;
  
  createVoiceSession(session: InsertVoiceSession): Promise<VoiceSession>;
  getVoiceSession(id: number): Promise<VoiceSession | undefined>;
  getVoiceSessionsByUser(userId: string): Promise<VoiceSession[]>;
  
  createSolution(solution: InsertSolution): Promise<Solution>;
  getSolutionsBySession(sessionId: number): Promise<Solution[]>;
  
  createSynthesis(synthesis: InsertSynthesis): Promise<Synthesis>;
  getSynthesisBySession(sessionId: number): Promise<Synthesis | undefined>;
  
  createPhantomLedgerEntry(entry: InsertPhantomLedgerEntry): Promise<PhantomLedgerEntry>;
  getPhantomLedgerEntries(limit?: number): Promise<PhantomLedgerEntry[]>;
  getPhantomLedgerEntriesByUser(userId: string): Promise<PhantomLedgerEntry[]>;
  
  createProject(project: InsertProject): Promise<Project>;
  getProjects(limit?: number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  
  // Analytics operations
  trackAnalyticsEvent(event: InsertUserAnalytics): Promise<UserAnalytics>;
  updateVoiceUsageStats(userId: string, voiceType: string, voiceName: string, success: boolean, rating?: number): Promise<void>;
  createSessionAnalytics(analytics: InsertSessionAnalytics): Promise<SessionAnalytics>;
  updateDailyMetrics(userId: string, date: string, metrics: Partial<InsertDailyUsageMetrics>): Promise<void>;
  getUserAnalytics(userId: string, limit?: number): Promise<UserAnalytics[]>;
  getVoiceUsageStats(userId: string): Promise<VoiceUsageStats[]>;
  getDailyMetrics(userId: string, startDate: string, endDate: string): Promise<DailyUsageMetrics[]>;
  getSessionAnalytics(sessionId: number): Promise<SessionAnalytics | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Voice profile operations
  async createVoiceProfile(profile: InsertVoiceProfile): Promise<VoiceProfile> {
    const [voiceProfile] = await db
      .insert(voiceProfiles)
      .values(profile)
      .returning();
    return voiceProfile;
  }

  async getVoiceProfiles(userId: string): Promise<VoiceProfile[]> {
    return db.select().from(voiceProfiles).where(eq(voiceProfiles.userId, userId)).orderBy(desc(voiceProfiles.updatedAt));
  }

  async getVoiceProfile(id: number): Promise<VoiceProfile | undefined> {
    const [profile] = await db.select().from(voiceProfiles).where(eq(voiceProfiles.id, id));
    return profile || undefined;
  }

  async updateVoiceProfile(id: number, updates: Partial<InsertVoiceProfile>): Promise<VoiceProfile | undefined> {
    const [profile] = await db
      .update(voiceProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(voiceProfiles.id, id))
      .returning();
    return profile || undefined;
  }

  async deleteVoiceProfile(id: number): Promise<boolean> {
    const result = await db.delete(voiceProfiles).where(eq(voiceProfiles.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async setDefaultVoiceProfile(userId: string, profileId: number): Promise<boolean> {
    try {
      // First, unset all default profiles for the user
      await db
        .update(voiceProfiles)
        .set({ isDefault: false })
        .where(eq(voiceProfiles.userId, userId));

      // Then set the new default
      const [profile] = await db
        .update(voiceProfiles)
        .set({ isDefault: true })
        .where(eq(voiceProfiles.id, profileId))
        .returning();

      return !!profile;
    } catch (error) {
      console.error('Error setting default voice profile:', error);
      return false;
    }
  }

  // Voice session operations
  async createVoiceSession(insertSession: InsertVoiceSession): Promise<VoiceSession> {
    const [session] = await db
      .insert(voiceSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getVoiceSession(id: number): Promise<VoiceSession | undefined> {
    const [session] = await db.select().from(voiceSessions).where(eq(voiceSessions.id, id));
    return session || undefined;
  }

  async getVoiceSessionsByUser(userId: string): Promise<VoiceSession[]> {
    return db.select().from(voiceSessions).where(eq(voiceSessions.userId, userId)).orderBy(desc(voiceSessions.createdAt));
  }

  // Solution operations
  async createSolution(insertSolution: InsertSolution): Promise<Solution> {
    const [solution] = await db
      .insert(solutions)
      .values(insertSolution)
      .returning();
    return solution;
  }

  async getSolutionsBySession(sessionId: number): Promise<Solution[]> {
    return db.select().from(solutions).where(eq(solutions.sessionId, sessionId));
  }

  // Synthesis operations
  async createSynthesis(insertSynthesis: InsertSynthesis): Promise<Synthesis> {
    const [synthesis] = await db
      .insert(syntheses)
      .values(insertSynthesis)
      .returning();
    return synthesis;
  }

  async getSynthesisBySession(sessionId: number): Promise<Synthesis | undefined> {
    const [synthesis] = await db.select().from(syntheses).where(eq(syntheses.sessionId, sessionId));
    return synthesis || undefined;
  }

  // Phantom ledger operations
  async createPhantomLedgerEntry(insertEntry: InsertPhantomLedgerEntry): Promise<PhantomLedgerEntry> {
    const [entry] = await db
      .insert(phantomLedgerEntries)
      .values(insertEntry)
      .returning();
    return entry;
  }

  async getPhantomLedgerEntries(limit = 10): Promise<PhantomLedgerEntry[]> {
    return db.select().from(phantomLedgerEntries).orderBy(desc(phantomLedgerEntries.createdAt)).limit(limit);
  }

  async getPhantomLedgerEntriesByUser(userId: string): Promise<PhantomLedgerEntry[]> {
    return db
      .select()
      .from(phantomLedgerEntries)
      .innerJoin(voiceSessions, eq(phantomLedgerEntries.sessionId, voiceSessions.id))
      .where(eq(voiceSessions.userId, userId))
      .orderBy(desc(phantomLedgerEntries.createdAt))
      .then(results => results.map(r => r.phantom_ledger_entries));
  }

  // Project operations
  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values(insertProject)
      .returning();
    return project;
  }

  async getProjects(limit = 20): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.updatedAt)).limit(limit);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project || undefined;
  }

  async deleteProject(id: number): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Analytics operations
  async trackAnalyticsEvent(event: InsertUserAnalytics): Promise<UserAnalytics> {
    const [analytics] = await db
      .insert(userAnalytics)
      .values(event)
      .returning();
    return analytics;
  }

  async updateVoiceUsageStats(userId: string, voiceType: string, voiceName: string, success: boolean, rating?: number): Promise<void> {
    // Check if stats already exist
    const [existing] = await db
      .select()
      .from(voiceUsageStats)
      .where(
        and(
          eq(voiceUsageStats.userId, userId),
          eq(voiceUsageStats.voiceType, voiceType),
          eq(voiceUsageStats.voiceName, voiceName)
        )
      );

    if (existing) {
      // Update existing stats
      const newUsageCount = existing.usageCount + 1;
      const newSuccessCount = existing.successCount + (success ? 1 : 0);
      const newAverageRating = rating 
        ? (existing.averageRating 
          ? (existing.averageRating * existing.usageCount + rating) / newUsageCount 
          : rating)
        : existing.averageRating;

      await db
        .update(voiceUsageStats)
        .set({
          usageCount: newUsageCount,
          successCount: newSuccessCount,
          averageRating: newAverageRating,
          lastUsed: new Date()
        })
        .where(eq(voiceUsageStats.id, existing.id));
    } else {
      // Create new stats
      await db
        .insert(voiceUsageStats)
        .values({
          userId,
          voiceType,
          voiceName,
          usageCount: 1,
          successCount: success ? 1 : 0,
          averageRating: rating,
          lastUsed: new Date()
        });
    }
  }

  async createSessionAnalytics(analytics: InsertSessionAnalytics): Promise<SessionAnalytics> {
    const [sessionAnalytic] = await db
      .insert(sessionAnalytics)
      .values(analytics)
      .returning();
    return sessionAnalytic;
  }

  async updateDailyMetrics(userId: string, date: string, metrics: Partial<InsertDailyUsageMetrics>): Promise<void> {
    // Check if metrics for this date already exist
    const [existing] = await db
      .select()
      .from(dailyUsageMetrics)
      .where(
        and(
          eq(dailyUsageMetrics.userId, userId),
          eq(dailyUsageMetrics.date, date)
        )
      );

    if (existing) {
      // Update existing metrics
      await db
        .update(dailyUsageMetrics)
        .set({
          generationCount: sql`${dailyUsageMetrics.generationCount} + ${metrics.generationCount || 0}`,
          synthesisCount: sql`${dailyUsageMetrics.synthesisCount} + ${metrics.synthesisCount || 0}`,
          uniqueVoiceCombinations: metrics.uniqueVoiceCombinations || existing.uniqueVoiceCombinations,
          totalGenerationTime: sql`${dailyUsageMetrics.totalGenerationTime} + ${metrics.totalGenerationTime || 0}`,
          averageSessionRating: metrics.averageSessionRating || existing.averageSessionRating
        })
        .where(eq(dailyUsageMetrics.id, existing.id));
    } else {
      // Create new metrics entry
      await db
        .insert(dailyUsageMetrics)
        .values({
          userId,
          date,
          ...metrics
        });
    }
  }

  async getUserAnalytics(userId: string, limit = 100): Promise<UserAnalytics[]> {
    return db
      .select()
      .from(userAnalytics)
      .where(eq(userAnalytics.userId, userId))
      .orderBy(desc(userAnalytics.timestamp))
      .limit(limit);
  }

  async getVoiceUsageStats(userId: string): Promise<VoiceUsageStats[]> {
    return db
      .select()
      .from(voiceUsageStats)
      .where(eq(voiceUsageStats.userId, userId))
      .orderBy(desc(voiceUsageStats.usageCount));
  }

  async getDailyMetrics(userId: string, startDate: string, endDate: string): Promise<DailyUsageMetrics[]> {
    return db
      .select()
      .from(dailyUsageMetrics)
      .where(
        and(
          eq(dailyUsageMetrics.userId, userId),
          gte(dailyUsageMetrics.date, startDate),
          lte(dailyUsageMetrics.date, endDate)
        )
      )
      .orderBy(dailyUsageMetrics.date);
  }

  async getSessionAnalytics(sessionId: number): Promise<SessionAnalytics | undefined> {
    const [analytics] = await db
      .select()
      .from(sessionAnalytics)
      .where(eq(sessionAnalytics.sessionId, sessionId));
    return analytics || undefined;
  }
}

export const storage = new DatabaseStorage();