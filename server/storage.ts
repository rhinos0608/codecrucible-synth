import {
  users,
  voiceProfiles,
  voiceSessions,
  solutions,
  syntheses,
  phantomLedgerEntries,
  projects,
  teams,
  teamMembers,
  usageLimits,
  subscriptionHistory,
  voicePreferences,
  teamVoiceProfiles,
  paymentMethods,
  userAnalytics,
  voiceUsageStats,
  sessionAnalytics,
  dailyUsageMetrics,
  type User,
  type UpsertUser,
  type InsertVoiceProfile,
  type VoiceProfile,
  type InsertVoiceSession,
  type VoiceSession,
  type InsertSolution,
  type Solution,
  type InsertSynthesis,
  type Synthesis,
  type InsertPhantomLedgerEntry,
  type PhantomLedgerEntry,
  type InsertProject,
  type Project,
  type Team,
  type InsertTeam,
  type TeamMember,
  type InsertTeamMember,
  type UsageLimits,
  type InsertUsageLimits,
  type SubscriptionHistory,
  type InsertSubscriptionHistory,
  type VoicePreference,
  type InsertVoicePreference,
  type TeamVoiceProfile,
  type InsertTeamVoiceProfile,
  type PaymentMethod,
  type InsertPaymentMethod,
  type UserAnalytics,
  type InsertUserAnalytics,
  type VoiceUsageStats,
  type InsertVoiceUsageStats,
  type SessionAnalytics,
  type InsertSessionAnalytics,
  type DailyUsageMetrics,
  type InsertDailyUsageMetrics,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Voice profile operations
  createVoiceProfile(profile: InsertVoiceProfile): Promise<VoiceProfile>;
  getVoiceProfiles(userId: string): Promise<VoiceProfile[]>;
  getVoiceProfile(id: number): Promise<VoiceProfile | undefined>;
  updateVoiceProfile(id: number, updates: Partial<InsertVoiceProfile>): Promise<VoiceProfile | undefined>;
  deleteVoiceProfile(id: number): Promise<boolean>;
  setDefaultVoiceProfile(userId: string, profileId: number): Promise<boolean>;
  
  // Session operations
  createVoiceSession(session: InsertVoiceSession): Promise<VoiceSession>;
  getVoiceSession(id: number): Promise<VoiceSession | undefined>;
  getVoiceSessionsByUser(userId: string): Promise<VoiceSession[]>;
  
  // Solution operations
  createSolution(solution: InsertSolution): Promise<Solution>;
  getSolutionsBySession(sessionId: number): Promise<Solution[]>;
  
  // Synthesis operations
  createSynthesis(synthesis: InsertSynthesis): Promise<Synthesis>;
  getSynthesisBySession(sessionId: number): Promise<Synthesis | undefined>;
  
  // Phantom ledger operations
  createPhantomLedgerEntry(entry: InsertPhantomLedgerEntry): Promise<PhantomLedgerEntry>;
  getPhantomLedgerEntries(limit?: number): Promise<PhantomLedgerEntry[]>;
  getPhantomLedgerEntriesByUser(userId: string): Promise<PhantomLedgerEntry[]>;
  
  // Project operations
  createProject(project: InsertProject): Promise<Project>;
  getProjects(limit?: number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  
  // Team operations
  createTeam(team: InsertTeam): Promise<Team>;
  getTeam(id: number): Promise<Team | undefined>;
  getTeamsByUser(userId: string): Promise<Team[]>;
  updateTeam(id: number, updates: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: number): Promise<boolean>;
  
  // Team member operations
  addTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  getTeamMembers(teamId: number): Promise<TeamMember[]>;
  removeTeamMember(teamId: number, userId: string): Promise<boolean>;
  updateTeamMemberRole(teamId: number, userId: string, role: "admin" | "member"): Promise<boolean>;
  
  // Usage limit operations
  getOrCreateUsageLimit(userId: string, date: string): Promise<UsageLimits>;
  updateUsageLimit(userId: string, date: string, updates: Partial<InsertUsageLimits>): Promise<UsageLimits | undefined>;
  
  // Subscription history operations
  createSubscriptionHistory(history: InsertSubscriptionHistory): Promise<SubscriptionHistory>;
  getSubscriptionHistory(userId: string): Promise<SubscriptionHistory[]>;
  
  // Voice preference operations
  upsertVoicePreference(preference: InsertVoicePreference): Promise<VoicePreference>;
  getVoicePreferences(userId: string): Promise<VoicePreference[]>;
  
  // Team voice profile operations
  createTeamVoiceProfile(profile: InsertTeamVoiceProfile): Promise<TeamVoiceProfile>;
  getTeamVoiceProfiles(teamId: number): Promise<TeamVoiceProfile[]>;
  deleteTeamVoiceProfile(id: number): Promise<boolean>;
  
  // Payment method operations
  createPaymentMethod(method: InsertPaymentMethod): Promise<PaymentMethod>;
  getPaymentMethods(userId: string): Promise<PaymentMethod[]>;
  setDefaultPaymentMethod(userId: string, methodId: number): Promise<boolean>;
  
  // Analytics operations
  createUserAnalytics(analytics: InsertUserAnalytics): Promise<UserAnalytics>;
  getUserAnalytics(userId: string, eventType?: string): Promise<UserAnalytics[]>;
  
  upsertVoiceUsageStats(stats: InsertVoiceUsageStats): Promise<VoiceUsageStats>;
  getVoiceUsageStats(userId: string): Promise<VoiceUsageStats[]>;
  
  createSessionAnalytics(analytics: InsertSessionAnalytics): Promise<SessionAnalytics>;
  getSessionAnalytics(sessionId: number): Promise<SessionAnalytics | undefined>;
  
  upsertDailyUsageMetrics(metrics: InsertDailyUsageMetrics): Promise<DailyUsageMetrics>;
  getDailyUsageMetrics(userId: string, startDate?: string, endDate?: string): Promise<DailyUsageMetrics[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
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

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }
  
  // Voice profile operations
  async createVoiceProfile(profile: InsertVoiceProfile): Promise<VoiceProfile> {
    const [created] = await db.insert(voiceProfiles).values(profile).returning();
    return created;
  }
  
  async getVoiceProfiles(userId: string): Promise<VoiceProfile[]> {
    return await db.select().from(voiceProfiles).where(eq(voiceProfiles.userId, userId));
  }
  
  async getVoiceProfile(id: number): Promise<VoiceProfile | undefined> {
    const [profile] = await db.select().from(voiceProfiles).where(eq(voiceProfiles.id, id));
    return profile;
  }
  
  async updateVoiceProfile(id: number, updates: Partial<InsertVoiceProfile>): Promise<VoiceProfile | undefined> {
    const [updated] = await db
      .update(voiceProfiles)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(voiceProfiles.id, id))
      .returning();
    return updated;
  }
  
  async deleteVoiceProfile(id: number): Promise<boolean> {
    const result = await db.delete(voiceProfiles).where(eq(voiceProfiles.id, id));
    return result.rowCount > 0;
  }
  
  async setDefaultVoiceProfile(userId: string, profileId: number): Promise<boolean> {
    // Reset all profiles to non-default
    await db
      .update(voiceProfiles)
      .set({ isDefault: false })
      .where(eq(voiceProfiles.userId, userId));
    
    // Set selected profile as default
    const [updated] = await db
      .update(voiceProfiles)
      .set({ isDefault: true })
      .where(and(eq(voiceProfiles.id, profileId), eq(voiceProfiles.userId, userId)))
      .returning();
    
    return !!updated;
  }
  
  // Session operations
  async createVoiceSession(session: InsertVoiceSession): Promise<VoiceSession> {
    const [created] = await db.insert(voiceSessions).values(session).returning();
    return created;
  }
  
  async getVoiceSession(id: number): Promise<VoiceSession | undefined> {
    const [session] = await db.select().from(voiceSessions).where(eq(voiceSessions.id, id));
    return session;
  }
  
  async getVoiceSessionsByUser(userId: string): Promise<VoiceSession[]> {
    return await db
      .select()
      .from(voiceSessions)
      .where(eq(voiceSessions.userId, userId))
      .orderBy(desc(voiceSessions.createdAt))
      .limit(50);
  }
  
  // Solution operations
  async createSolution(solution: InsertSolution): Promise<Solution> {
    const [created] = await db.insert(solutions).values(solution).returning();
    return created;
  }
  
  async getSolutionsBySession(sessionId: number): Promise<Solution[]> {
    return await db.select().from(solutions).where(eq(solutions.sessionId, sessionId));
  }
  
  // Synthesis operations
  async createSynthesis(synthesis: InsertSynthesis): Promise<Synthesis> {
    const [created] = await db.insert(syntheses).values(synthesis).returning();
    return created;
  }
  
  async getSynthesisBySession(sessionId: number): Promise<Synthesis | undefined> {
    const [synthesis] = await db.select().from(syntheses).where(eq(syntheses.sessionId, sessionId));
    return synthesis;
  }
  
  // Phantom ledger operations
  async createPhantomLedgerEntry(entry: InsertPhantomLedgerEntry): Promise<PhantomLedgerEntry> {
    const [created] = await db.insert(phantomLedgerEntries).values(entry).returning();
    return created;
  }
  
  async getPhantomLedgerEntries(limit = 10): Promise<PhantomLedgerEntry[]> {
    return await db
      .select()
      .from(phantomLedgerEntries)
      .orderBy(desc(phantomLedgerEntries.createdAt))
      .limit(limit);
  }
  
  async getPhantomLedgerEntriesByUser(userId: string): Promise<PhantomLedgerEntry[]> {
    return await db
      .select()
      .from(phantomLedgerEntries)
      .where(eq(phantomLedgerEntries.userId, userId))
      .orderBy(desc(phantomLedgerEntries.createdAt))
      .limit(20);
  }
  
  // Project operations
  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }
  
  async getProjects(limit = 20): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt))
      .limit(limit);
  }
  
  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }
  
  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db
      .update(projects)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }
  
  async deleteProject(id: number): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return result.rowCount > 0;
  }
  
  // Team operations
  async createTeam(team: InsertTeam): Promise<Team> {
    const [created] = await db.insert(teams).values(team).returning();
    return created;
  }
  
  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }
  
  async getTeamsByUser(userId: string): Promise<Team[]> {
    const userTeams = await db
      .select({ team: teams })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, userId));
    
    return userTeams.map(t => t.team);
  }
  
  async updateTeam(id: number, updates: Partial<InsertTeam>): Promise<Team | undefined> {
    const [updated] = await db
      .update(teams)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, id))
      .returning();
    return updated;
  }
  
  async deleteTeam(id: number): Promise<boolean> {
    const result = await db.delete(teams).where(eq(teams.id, id));
    return result.rowCount > 0;
  }
  
  // Team member operations
  async addTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const [created] = await db.insert(teamMembers).values(member).returning();
    return created;
  }
  
  async getTeamMembers(teamId: number): Promise<TeamMember[]> {
    const membersWithUserData = await db
      .select({
        id: teamMembers.id,
        teamId: teamMembers.teamId,
        userId: teamMembers.userId,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        // User data from join
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        profileImageUrl: users.profileImageUrl,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, teamId));

    // Return properly typed TeamMember objects with joined user data
    return membersWithUserData.map(member => ({
      id: member.id,
      teamId: member.teamId,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      // Additional user data will be handled in route transformation
    } as TeamMember));
  }
  
  async removeTeamMember(teamId: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    return result.rowCount > 0;
  }
  
  async updateTeamMemberRole(teamId: number, userId: string, role: "admin" | "member"): Promise<boolean> {
    const [updated] = await db
      .update(teamMembers)
      .set({ role })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .returning();
    return !!updated;
  }
  
  // Usage limit operations
  async getOrCreateUsageLimit(userId: string, date: string): Promise<UsageLimits> {
    let [limit] = await db
      .select()
      .from(usageLimits)
      .where(and(eq(usageLimits.userId, userId), eq(usageLimits.date, date)));
    
    if (!limit) {
      // Determine limit based on user's subscription
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      const tierLimits = {
        free: 3,
        pro: -1, // unlimited
        team: -1, // unlimited
      };
      
      [limit] = await db.insert(usageLimits).values({
        userId,
        date,
        generationsUsed: 0,
        generationsLimit: tierLimits[user?.subscriptionTier as keyof typeof tierLimits] || 3,
      }).returning();
    }
    
    return limit;
  }
  
  async updateUsageLimit(userId: string, date: string, updates: Partial<InsertUsageLimits>): Promise<UsageLimits | undefined> {
    const [updated] = await db
      .update(usageLimits)
      .set(updates)
      .where(and(eq(usageLimits.userId, userId), eq(usageLimits.date, date)))
      .returning();
    return updated;
  }
  
  // Subscription history operations
  async createSubscriptionHistory(history: InsertSubscriptionHistory): Promise<SubscriptionHistory> {
    const [created] = await db.insert(subscriptionHistory).values(history).returning();
    return created;
  }
  
  async getSubscriptionHistory(userId: string): Promise<SubscriptionHistory[]> {
    return await db
      .select()
      .from(subscriptionHistory)
      .where(eq(subscriptionHistory.userId, userId))
      .orderBy(desc(subscriptionHistory.createdAt));
  }
  
  // Voice preference operations
  async upsertVoicePreference(preference: InsertVoicePreference): Promise<VoicePreference> {
    const [existing] = await db
      .select()
      .from(voicePreferences)
      .where(and(
        eq(voicePreferences.userId, preference.userId),
        eq(voicePreferences.promptPattern, preference.promptPattern)
      ));
    
    if (existing) {
      const [updated] = await db
        .update(voicePreferences)
        .set({
          ...preference,
          lastUpdated: new Date(),
        })
        .where(eq(voicePreferences.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(voicePreferences).values(preference).returning();
      return created;
    }
  }
  
  async getVoicePreferences(userId: string): Promise<VoicePreference[]> {
    return await db.select().from(voicePreferences).where(eq(voicePreferences.userId, userId));
  }
  
  // Team voice profile operations
  async createTeamVoiceProfile(profile: InsertTeamVoiceProfile): Promise<TeamVoiceProfile> {
    const [created] = await db.insert(teamVoiceProfiles).values(profile).returning();
    return created;
  }
  
  async getTeamVoiceProfiles(teamId: number): Promise<TeamVoiceProfile[]> {
    return await db.select().from(teamVoiceProfiles).where(eq(teamVoiceProfiles.teamId, teamId));
  }
  
  async deleteTeamVoiceProfile(id: number): Promise<boolean> {
    const result = await db.delete(teamVoiceProfiles).where(eq(teamVoiceProfiles.id, id));
    return result.rowCount > 0;
  }
  
  // Payment method operations
  async createPaymentMethod(method: InsertPaymentMethod): Promise<PaymentMethod> {
    const [created] = await db.insert(paymentMethods).values(method).returning();
    return created;
  }
  
  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    return await db.select().from(paymentMethods).where(eq(paymentMethods.userId, userId));
  }
  
  async setDefaultPaymentMethod(userId: string, methodId: number): Promise<boolean> {
    // Reset all methods to non-default
    await db
      .update(paymentMethods)
      .set({ isDefault: false })
      .where(eq(paymentMethods.userId, userId));
    
    // Set selected method as default
    const [updated] = await db
      .update(paymentMethods)
      .set({ isDefault: true })
      .where(and(eq(paymentMethods.id, methodId), eq(paymentMethods.userId, userId)))
      .returning();
    
    return !!updated;
  }
  
  // Analytics operations
  async createUserAnalytics(analytics: InsertUserAnalytics): Promise<UserAnalytics> {
    const [created] = await db.insert(userAnalytics).values(analytics).returning();
    return created;
  }
  
  async getUserAnalytics(userId: string, eventType?: string): Promise<UserAnalytics[]> {
    let query = db.select().from(userAnalytics).where(eq(userAnalytics.userId, userId));
    
    if (eventType) {
      query = query.where(and(
        eq(userAnalytics.userId, userId),
        eq(userAnalytics.eventType, eventType)
      ));
    }
    
    return await query.orderBy(desc(userAnalytics.timestamp)).limit(100);
  }
  
  async upsertVoiceUsageStats(stats: InsertVoiceUsageStats): Promise<VoiceUsageStats> {
    const [existing] = await db
      .select()
      .from(voiceUsageStats)
      .where(and(
        eq(voiceUsageStats.userId, stats.userId),
        eq(voiceUsageStats.voiceType, stats.voiceType),
        eq(voiceUsageStats.voiceName, stats.voiceName)
      ));
    
    if (existing) {
      const [updated] = await db
        .update(voiceUsageStats)
        .set({
          ...stats,
          lastUsed: new Date(),
        })
        .where(eq(voiceUsageStats.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(voiceUsageStats).values(stats).returning();
      return created;
    }
  }
  
  async getVoiceUsageStats(userId: string): Promise<VoiceUsageStats[]> {
    return await db
      .select()
      .from(voiceUsageStats)
      .where(eq(voiceUsageStats.userId, userId))
      .orderBy(desc(voiceUsageStats.usageCount));
  }
  
  async createSessionAnalytics(analytics: InsertSessionAnalytics): Promise<SessionAnalytics> {
    const [created] = await db.insert(sessionAnalytics).values(analytics).returning();
    return created;
  }
  
  async getSessionAnalytics(sessionId: number): Promise<SessionAnalytics | undefined> {
    const [analytics] = await db
      .select()
      .from(sessionAnalytics)
      .where(eq(sessionAnalytics.sessionId, sessionId));
    return analytics;
  }
  
  async upsertDailyUsageMetrics(metrics: InsertDailyUsageMetrics): Promise<DailyUsageMetrics> {
    const [existing] = await db
      .select()
      .from(dailyUsageMetrics)
      .where(and(
        eq(dailyUsageMetrics.userId, metrics.userId),
        eq(dailyUsageMetrics.date, metrics.date)
      ));
    
    if (existing) {
      const [updated] = await db
        .update(dailyUsageMetrics)
        .set(metrics)
        .where(eq(dailyUsageMetrics.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(dailyUsageMetrics).values(metrics).returning();
      return created;
    }
  }
  
  async getDailyUsageMetrics(userId: string, startDate?: string, endDate?: string): Promise<DailyUsageMetrics[]> {
    let query = db.select().from(dailyUsageMetrics).where(eq(dailyUsageMetrics.userId, userId));
    
    if (startDate) {
      query = query.where(gte(dailyUsageMetrics.date, startDate));
    }
    
    return await query.orderBy(desc(dailyUsageMetrics.date)).limit(30);
  }
}

export const storage = new DatabaseStorage();