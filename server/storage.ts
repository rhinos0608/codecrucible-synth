import {
  users,
  voiceProfiles,
  voiceSessions,
  solutions,
  syntheses,
  phantomLedgerEntries,
  projects,
  projectFolders,
  folderFiles,
  userFiles,
  sessionFileAttachments,
  chatSessions,
  chatMessages,
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
  type InsertProjectFolder,
  type ProjectFolder,
  type FolderFile,
  type InsertFolderFile,
  type UserFile,
  type InsertUserFile,
  type SessionFileAttachment,
  type InsertSessionFileAttachment,
  type ChatSession,
  type InsertChatSession,
  type ChatMessage,
  type InsertChatMessage,
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
  getUserSessions(userId: string): Promise<VoiceSession[]>;
  
  // Alias for backward compatibility and defensive programming
  getVoiceSessions(userId: string): Promise<VoiceSession[]>;
  
  // Solution operations
  createSolution(solution: InsertSolution): Promise<Solution>;
  getSolutionsBySession(sessionId: number): Promise<Solution[]>;
  getSolution(solutionId: number): Promise<Solution | undefined>;
  
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
  getProjectsByUser(userId: string): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  
  // Project folder operations - Pro tier gated following AI_INSTRUCTIONS.md
  createProjectFolder(folder: InsertProjectFolder): Promise<ProjectFolder>;
  getProjectFolders(userId: string): Promise<ProjectFolder[]>;
  getProjectFolder(id: number): Promise<ProjectFolder | undefined>;
  updateProjectFolder(id: number, updates: Partial<InsertProjectFolder>): Promise<ProjectFolder | undefined>;
  deleteProjectFolder(id: number): Promise<boolean>;
  getFolderProjects(folderId: number): Promise<Project[]>;
  moveProjectToFolder(projectId: number, folderId: number | null): Promise<boolean>;

  // Folder file operations - Following Alexander's Pattern Language and CodingPhilosophy.md
  createFolderFile(file: InsertFolderFile): Promise<FolderFile>;
  getFolderFiles(folderId: number): Promise<FolderFile[]>;
  updateFolderFile(id: number, file: Partial<InsertFolderFile>, userId: string): Promise<FolderFile>;
  deleteFolderFile(id: number, userId: string): Promise<void>;
  getContextEnabledFiles(userId: string): Promise<FolderFile[]>;
  
  // User file operations - Following Jung's Descent Protocol for consciousness-driven file management
  createUserFile(file: InsertUserFile): Promise<UserFile>;
  getUserFiles(userId: string): Promise<UserFile[]>;
  getUserFile(id: number): Promise<UserFile | undefined>;
  updateUserFile(id: number, updates: Partial<InsertUserFile>): Promise<UserFile | undefined>;
  deleteUserFile(id: number): Promise<boolean>;
  getUserFilesByProject(projectId: number): Promise<UserFile[]>;
  incrementFileUsage(fileId: number): Promise<void>;
  
  // Session file attachment operations - Council-based file context integration
  attachFileToSession(attachment: InsertSessionFileAttachment): Promise<SessionFileAttachment>;
  getSessionFiles(sessionId: number): Promise<UserFile[]>;
  detachFileFromSession(sessionId: number, fileId: number): Promise<boolean>;
  updateFileAttachmentSettings(sessionId: number, fileId: number, isContextEnabled: boolean): Promise<boolean>;
  
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

  // Chat operations - Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles
  createChatSession(chatSession: InsertChatSession): Promise<ChatSession>;
  getChatSession(id: number): Promise<ChatSession | undefined>;
  getChatSessionsByUser(userId: string): Promise<ChatSession[]>;
  updateChatSessionActivity(id: number): Promise<void>;
  
  // Chat message operations - Multi-voice consciousness tracking
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(chatSessionId: number): Promise<ChatMessage[]>;
  getChatMessagesByUser(userId: string): Promise<ChatMessage[]>;
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
    try {
      console.log('🔧 Creating voice profile with data:', {
        name: profile.name,
        perspective: profile.perspective,
        role: profile.role,
        userId: profile.userId,
        hasSelectedPerspectives: !!profile.selectedPerspectives,
        hasSelectedRoles: !!profile.selectedRoles
      });

      // Ensure selectedPerspectives and selectedRoles are properly formatted as arrays
      const profileData = {
        ...profile,
        selectedPerspectives: profile.selectedPerspectives || [],
        selectedRoles: profile.selectedRoles || [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const [created] = await db.insert(voiceProfiles).values(profileData).returning();
      console.log('✅ Voice profile created successfully:', { id: created.id, name: created.name });
      return created;
    } catch (error) {
      console.error('❌ Voice profile creation error:', error);
      throw error;
    }
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
  
  // Alias for getUserSessions (for onboarding status API)
  async getUserSessions(userId: string): Promise<VoiceSession[]> {
    return this.getVoiceSessionsByUser(userId);
  }
  
  // Alias for getVoiceSessions (backward compatibility) - Defensive programming following AI_INSTRUCTIONS.md
  async getVoiceSessions(userId: string): Promise<VoiceSession[]> {
    return this.getVoiceSessionsByUser(userId);
  }
  
  // Solution operations
  async createSolution(solution: InsertSolution): Promise<Solution> {
    const [created] = await db.insert(solutions).values(solution).returning();
    return created;
  }
  
  async getSolutionsBySession(sessionId: number): Promise<Solution[]> {
    return await db.select().from(solutions).where(eq(solutions.sessionId, sessionId));
  }

  async getSolution(solutionId: number): Promise<Solution | undefined> {
    const [solution] = await db
      .select()
      .from(solutions)
      .where(eq(solutions.id, solutionId));
    return solution;
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

  async getProjectsByUser(userId: string): Promise<Project[]> {
    try {
      return await db
        .select()
        .from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(desc(projects.createdAt));
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
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
    return (result.rowCount ?? 0) > 0;
  }

  // Project folder operations - Pro tier gated following AI_INSTRUCTIONS.md
  async createProjectFolder(folder: InsertProjectFolder): Promise<ProjectFolder> {
    try {
      const [newFolder] = await db
        .insert(projectFolders)
        .values({
          ...folder,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      return newFolder;
    } catch (error) {
      console.error('Error creating project folder:', error);
      throw error;
    }
  }

  async getProjectFolders(userId: string): Promise<ProjectFolder[]> {
    try {
      return await db
        .select()
        .from(projectFolders)
        .where(eq(projectFolders.userId, userId))
        .orderBy(projectFolders.sortOrder, projectFolders.name);
    } catch (error) {
      console.error('Error fetching project folders:', error);
      return [];
    }
  }

  async getProjectFolder(id: number): Promise<ProjectFolder | undefined> {
    const [folder] = await db
      .select()
      .from(projectFolders)
      .where(eq(projectFolders.id, id));
    return folder;
  }

  async updateProjectFolder(id: number, updates: Partial<InsertProjectFolder>): Promise<ProjectFolder | undefined> {
    const [updatedFolder] = await db
      .update(projectFolders)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(projectFolders.id, id))
      .returning();
    return updatedFolder;
  }

  async deleteProjectFolder(id: number): Promise<boolean> {
    // First, check if folder has child folders or projects
    const childFolders = await db
      .select()
      .from(projectFolders)
      .where(eq(projectFolders.parentId, id));
    
    const folderProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.folderId, id));
    
    if (childFolders.length > 0 || folderProjects.length > 0) {
      // Move child folders and projects to parent folder or root
      const folderToDelete = await this.getProjectFolder(id);
      const parentId = folderToDelete?.parentId || null;
      
      // Update child folders
      if (childFolders.length > 0) {
        await db
          .update(projectFolders)
          .set({ parentId })
          .where(eq(projectFolders.parentId, id));
      }
      
      // Update projects in this folder
      if (folderProjects.length > 0) {
        await db
          .update(projects)
          .set({ folderId: parentId })
          .where(eq(projects.folderId, id));
      }
    }
    
    const result = await db.delete(projectFolders).where(eq(projectFolders.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getFolderProjects(folderId: number): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.folderId, folderId))
      .orderBy(projects.name);
  }

  async moveProjectToFolder(projectId: number, folderId: number | null): Promise<boolean> {
    try {
      console.log('🔧 Moving project to folder:', { projectId, folderId });
      
      const result = await db
        .update(projects)
        .set({ 
          folderId,
          updatedAt: new Date()
        })
        .where(eq(projects.id, projectId));
      
      const success = (result.rowCount ?? 0) > 0;
      console.log('✅ Project move result:', { success, rowCount: result.rowCount });
      return success;
    } catch (error) {
      console.error('❌ Project move error:', error);
      throw error;
    }
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

  async getUserTeams(userId: string): Promise<{ teamId: number; name: string; role: string }[]> {
    const userTeams = await db
      .select({
        teamId: teams.id,
        name: teams.name,
        role: teamMembers.role
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, userId));
    
    return userTeams.map(team => ({
      teamId: team.teamId,
      name: team.name,
      role: team.role || 'member'
    }));
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
  
  // Folder file operations - Following Alexander's Pattern Language and CodingPhilosophy.md
  async createFolderFile(file: InsertFolderFile): Promise<FolderFile> {
    const fileData = {
      ...file,
      userId: file.userId || '', // Ensure userId is provided
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const [created] = await db.insert(folderFiles).values(fileData).returning();
    return created;
  }

  async getFolderFiles(folderId: number): Promise<FolderFile[]> {
    return await db
      .select()
      .from(folderFiles)
      .where(eq(folderFiles.folderId, folderId))
      .orderBy(folderFiles.name);
  }

  async updateFolderFile(id: number, file: Partial<InsertFolderFile>, userId: string): Promise<FolderFile> {
    const [updated] = await db
      .update(folderFiles)
      .set({
        ...file,
        updatedAt: new Date(),
      })
      .where(and(eq(folderFiles.id, id), eq(folderFiles.userId, userId)))
      .returning();
    
    if (!updated) {
      throw new Error('File not found or access denied');
    }
    return updated;
  }

  async deleteFolderFile(id: number, userId: string): Promise<void> {
    const result = await db
      .delete(folderFiles)
      .where(and(eq(folderFiles.id, id), eq(folderFiles.userId, userId)));
    
    if (result.rowCount === 0) {
      throw new Error('File not found or access denied');
    }
  }

  async getContextEnabledFiles(userId: string): Promise<FolderFile[]> {
    return await db
      .select()
      .from(folderFiles)
      .where(and(
        eq(folderFiles.userId, userId),
        eq(folderFiles.isContextEnabled, true)
      ))
      .orderBy(folderFiles.updatedAt);
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

  // User file operations - Following Jung's Descent Protocol for consciousness-driven file management
  async createUserFile(file: InsertUserFile): Promise<UserFile> {
    const [created] = await db.insert(userFiles).values(file).returning();
    return created;
  }

  async getUserFiles(userId: string): Promise<UserFile[]> {
    return await db
      .select()
      .from(userFiles)
      .where(eq(userFiles.userId, userId))
      .orderBy(desc(userFiles.createdAt));
  }

  async getUserFile(id: number): Promise<UserFile | undefined> {
    const [file] = await db
      .select()
      .from(userFiles)
      .where(eq(userFiles.id, id));
    return file;
  }

  async updateUserFile(id: number, updates: Partial<InsertUserFile>): Promise<UserFile | undefined> {
    const [updated] = await db
      .update(userFiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userFiles.id, id))
      .returning();
    return updated;
  }

  async deleteUserFile(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(userFiles)
      .where(eq(userFiles.id, id))
      .returning();
    return !!deleted;
  }

  async getUserFilesByProject(projectId: number): Promise<UserFile[]> {
    return await db
      .select()
      .from(userFiles)
      .where(eq(userFiles.projectId, projectId))
      .orderBy(desc(userFiles.createdAt));
  }

  async incrementFileUsage(fileId: number): Promise<void> {
    await db
      .update(userFiles)
      .set({
        usageCount: sql`${userFiles.usageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(userFiles.id, fileId));
  }

  // Session file attachment operations - Council-based file context integration
  async attachFileToSession(attachment: InsertSessionFileAttachment): Promise<SessionFileAttachment> {
    const [created] = await db.insert(sessionFileAttachments).values(attachment).returning();
    return created;
  }

  async getSessionFiles(sessionId: number): Promise<UserFile[]> {
    const filesWithAttachments = await db
      .select({
        file: userFiles,
        attachment: sessionFileAttachments
      })
      .from(sessionFileAttachments)
      .innerJoin(userFiles, eq(sessionFileAttachments.fileId, userFiles.id))
      .where(eq(sessionFileAttachments.sessionId, sessionId))
      .orderBy(sessionFileAttachments.attachmentOrder);

    return filesWithAttachments.map(row => row.file);
  }

  async detachFileFromSession(sessionId: number, fileId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(sessionFileAttachments)
      .where(and(
        eq(sessionFileAttachments.sessionId, sessionId),
        eq(sessionFileAttachments.fileId, fileId)
      ))
      .returning();
    return !!deleted;
  }

  async updateFileAttachmentSettings(sessionId: number, fileId: number, isContextEnabled: boolean): Promise<boolean> {
    const [updated] = await db
      .update(sessionFileAttachments)
      .set({ isContextEnabled })
      .where(and(
        eq(sessionFileAttachments.sessionId, sessionId),
        eq(sessionFileAttachments.fileId, fileId)
      ))
      .returning();
    return !!updated;
  }

  // Chat operations - Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles
  async createChatSession(chatSession: InsertChatSession): Promise<ChatSession> {
    try {
      const [created] = await db.insert(chatSessions).values({
        sessionId: chatSession.sessionId,
        userId: chatSession.userId,
        selectedVoice: chatSession.selectedVoice,
        initialSolutionId: chatSession.initialSolutionId || null,
        contextData: chatSession.contextData,
        isActive: chatSession.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date()
      }).returning();
      
      console.log('✅ Chat session created successfully:', { 
        id: created.id, 
        selectedVoice: created.selectedVoice,
        sessionId: created.sessionId 
      });
      
      return created;
    } catch (error) {
      console.error('❌ Error creating chat session:', error);
      throw error;
    }
  }

  async getChatSession(id: number): Promise<ChatSession | undefined> {
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, id));
    return session;
  }

  async getChatSessionsByUser(userId: string): Promise<ChatSession[]> {
    return await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.lastActivityAt));
  }

  async updateChatSessionActivity(id: number): Promise<void> {
    await db
      .update(chatSessions)
      .set({ 
        lastActivityAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(chatSessions.id, id));
  }

  // Chat message operations - Multi-voice consciousness tracking following CodingPhilosophy.md
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values({
      ...message,
      createdAt: new Date()
    }).returning();
    
    // Update chat session activity
    await this.updateChatSessionActivity(message.chatSessionId);
    
    return created;
  }

  async getChatMessages(chatSessionId: number): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chatSessionId, chatSessionId))
      .orderBy(chatMessages.messageIndex);
  }

  async getChatMessagesByUser(userId: string): Promise<ChatMessage[]> {
    const messages = await db
      .select({
        message: chatMessages,
        session: chatSessions
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.chatSessionId, chatSessions.id))
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatMessages.createdAt));
    
    return messages.map(row => row.message);
  }
}

export const storage = new DatabaseStorage();