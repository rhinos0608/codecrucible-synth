import { 
  users, 
  voiceSessions, 
  solutions, 
  syntheses, 
  phantomLedgerEntries,
  type User, 
  type InsertUser, 
  type VoiceSession,
  type InsertVoiceSession,
  type Solution,
  type InsertSolution,
  type Synthesis,
  type InsertSynthesis,
  type PhantomLedgerEntry,
  type InsertPhantomLedgerEntry
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createVoiceSession(session: InsertVoiceSession): Promise<VoiceSession>;
  getVoiceSession(id: number): Promise<VoiceSession | undefined>;
  getVoiceSessionsByUser(userId: number): Promise<VoiceSession[]>;
  
  createSolution(solution: InsertSolution): Promise<Solution>;
  getSolutionsBySession(sessionId: number): Promise<Solution[]>;
  
  createSynthesis(synthesis: InsertSynthesis): Promise<Synthesis>;
  getSynthesisBySession(sessionId: number): Promise<Synthesis | undefined>;
  
  createPhantomLedgerEntry(entry: InsertPhantomLedgerEntry): Promise<PhantomLedgerEntry>;
  getPhantomLedgerEntries(limit?: number): Promise<PhantomLedgerEntry[]>;
  getPhantomLedgerEntriesByUser(userId: number): Promise<PhantomLedgerEntry[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private voiceSessions: Map<number, VoiceSession>;
  private solutions: Map<number, Solution>;
  private syntheses: Map<number, Synthesis>;
  private phantomLedgerEntries: Map<number, PhantomLedgerEntry>;
  private currentUserId: number;
  private currentSessionId: number;
  private currentSolutionId: number;
  private currentSynthesisId: number;
  private currentLedgerId: number;

  constructor() {
    this.users = new Map();
    this.voiceSessions = new Map();
    this.solutions = new Map();
    this.syntheses = new Map();
    this.phantomLedgerEntries = new Map();
    this.currentUserId = 1;
    this.currentSessionId = 1;
    this.currentSolutionId = 1;
    this.currentSynthesisId = 1;
    this.currentLedgerId = 1;
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
      createdAt: new Date()
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
      createdAt: new Date()
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
      createdAt: new Date()
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
      createdAt: new Date()
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
}

export const storage = new MemStorage();
