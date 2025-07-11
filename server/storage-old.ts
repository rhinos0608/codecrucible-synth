import { 
  users, 
  voiceSessions, 
  solutions, 
  syntheses, 
  phantomLedgerEntries,
  projects,
  voiceProfiles,
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
  type InsertVoiceProfile
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
}

export class DatabaseStorage implements IStorage {
  private users: Map<number, User>;
  private voiceSessions: Map<number, VoiceSession>;
  private solutions: Map<number, Solution>;
  private syntheses: Map<number, Synthesis>;
  private phantomLedgerEntries: Map<number, PhantomLedgerEntry>;
  private projects: Map<number, Project>;
  private currentUserId: number;
  private currentSessionId: number;
  private currentSolutionId: number;
  private currentSynthesisId: number;
  private currentLedgerId: number;
  private currentProjectId: number;

  constructor() {
    this.users = new Map();
    this.voiceSessions = new Map();
    this.solutions = new Map();
    this.syntheses = new Map();
    this.phantomLedgerEntries = new Map();
    this.projects = new Map();
    this.currentUserId = 1;
    this.currentSessionId = 1;
    this.currentSolutionId = 1;
    this.currentSynthesisId = 1;
    this.currentLedgerId = 1;
    this.currentProjectId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: new Date() 
    };
    this.users.set(id, user);
    return user;
  }

  async createVoiceSession(insertSession: InsertVoiceSession): Promise<VoiceSession> {
    const id = this.currentSessionId++;
    const session: VoiceSession = {
      ...insertSession,
      id,
      userId: 1, // Default user for MVP
      createdAt: new Date(),
      recursionDepth: insertSession.recursionDepth ?? 2,
      synthesisMode: insertSession.synthesisMode ?? "competitive",
      ethicalFiltering: insertSession.ethicalFiltering ?? true
    };
    this.voiceSessions.set(id, session);
    return session;
  }

  async getVoiceSession(id: number): Promise<VoiceSession | undefined> {
    return this.voiceSessions.get(id);
  }

  async getVoiceSessionsByUser(userId: number): Promise<VoiceSession[]> {
    return Array.from(this.voiceSessions.values()).filter(
      session => session.userId === userId
    );
  }

  async createSolution(insertSolution: InsertSolution): Promise<Solution> {
    const id = this.currentSolutionId++;
    const solution: Solution = {
      ...insertSolution,
      id,
      createdAt: new Date(),
      sessionId: insertSolution.sessionId!
    };
    this.solutions.set(id, solution);
    return solution;
  }

  async getSolutionsBySession(sessionId: number): Promise<Solution[]> {
    return Array.from(this.solutions.values()).filter(
      solution => solution.sessionId === sessionId
    );
  }

  async createSynthesis(insertSynthesis: InsertSynthesis): Promise<Synthesis> {
    const id = this.currentSynthesisId++;
    const synthesis: Synthesis = {
      ...insertSynthesis,
      id,
      createdAt: new Date(),
      sessionId: insertSynthesis.sessionId!
    };
    this.syntheses.set(id, synthesis);
    return synthesis;
  }

  async getSynthesisBySession(sessionId: number): Promise<Synthesis | undefined> {
    return Array.from(this.syntheses.values()).find(
      synthesis => synthesis.sessionId === sessionId
    );
  }

  async createPhantomLedgerEntry(insertEntry: InsertPhantomLedgerEntry): Promise<PhantomLedgerEntry> {
    const id = this.currentLedgerId++;
    const entry: PhantomLedgerEntry = {
      ...insertEntry,
      id,
      createdAt: new Date(),
      sessionId: insertEntry.sessionId!
    };
    this.phantomLedgerEntries.set(id, entry);
    return entry;
  }

  async getPhantomLedgerEntries(limit = 10): Promise<PhantomLedgerEntry[]> {
    const entries = Array.from(this.phantomLedgerEntries.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
    return entries.slice(0, limit);
  }

  async getPhantomLedgerEntriesByUser(userId: number): Promise<PhantomLedgerEntry[]> {
    const userSessions = await this.getVoiceSessionsByUser(userId);
    const sessionIds = userSessions.map(s => s.id);
    
    return Array.from(this.phantomLedgerEntries.values())
      .filter(entry => sessionIds.includes(entry.sessionId!))
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.currentProjectId++;
    const project: Project = {
      ...insertProject,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      description: insertProject.description || null,
      sessionId: insertProject.sessionId || null,
      synthesisId: insertProject.synthesisId || null,
      tags: insertProject.tags || [],
      isPublic: insertProject.isPublic || false,
      language: insertProject.language || "javascript"
    };
    this.projects.set(id, project);
    return project;
  }

  async getProjects(limit = 20): Promise<Project[]> {
    const projects = Array.from(this.projects.values())
      .sort((a, b) => b.updatedAt!.getTime() - a.updatedAt!.getTime());
    return projects.slice(0, limit);
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const existingProject = this.projects.get(id);
    if (!existingProject) {
      return undefined;
    }
    
    const updatedProject: Project = {
      ...existingProject,
      ...updates,
      id,
      updatedAt: new Date()
    };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: number): Promise<boolean> {
    return this.projects.delete(id);
  }
}

export const storage = new DatabaseStorage();
