// TypeScript interfaces for all state shapes
// Following AI_INSTRUCTIONS.md security patterns with comprehensive validation

// Voice Selection State
export interface VoiceState {
  // Selected voice archetypes and combinations
  selectedPerspectives: string[];
  selectedRoles: string[];
  customVoices: CustomVoice[];
  
  // Voice recommendations and AI analysis
  recommendations: VoiceRecommendation[];
  analysisContext: string;
  
  // Voice session tracking
  activeSession: VoiceSession | null;
  sessionHistory: VoiceSession[];
  
  // Actions
  actions: {
    selectPerspectives: (perspectives: string[]) => void;
    selectRoles: (roles: string[]) => void;
    addCustomVoice: (voice: CustomVoice) => void;
    removeCustomVoice: (voiceId: string) => void;
    setRecommendations: (recommendations: VoiceRecommendation[]) => void;
    createSession: (session: Omit<VoiceSession, 'id'>) => void;
    clearSelection: () => void;
  };
}

// Project Management State
export interface ProjectState {
  // Project data normalization
  projects: Record<string, Project>;
  folders: Record<string, ProjectFolder>;
  files: Record<string, ProjectFile>;
  
  // UI state for project management
  selectedProject: string | null;
  selectedFolder: string | null;
  expandedFolders: Set<string>;
  
  // Project operations state
  isCreating: boolean;
  isDeleting: boolean;
  isMoving: boolean;
  
  // Actions
  actions: {
    setProjects: (projects: Project[]) => void;
    addProject: (project: Project) => void;
    updateProject: (id: string, updates: Partial<Project>) => void;
    deleteProject: (id: string) => void;
    selectProject: (id: string | null) => void;
    setFolders: (folders: ProjectFolder[]) => void;
    createFolder: (folder: ProjectFolder) => void;
    moveProject: (projectId: string, folderId: string | null) => void;
    toggleFolder: (folderId: string) => void;
  };
}

// Team Collaboration State
export interface TeamState {
  // Team data
  teams: Record<string, Team>;
  activeTeam: string | null;
  
  // Team members
  members: Record<string, TeamMember[]>;
  invitations: TeamInvitation[];
  
  // Collaborative sessions
  activeSessions: CollaborativeSession[];
  sharedVoices: SharedVoice[];
  
  // Matrix chat integration
  matrixRooms: Record<string, MatrixRoom>;
  chatMessages: Record<string, MatrixMessage[]>;
  consciousnessMetrics: ConsciousnessMetrics;
  
  // Actions
  actions: {
    setActiveTeam: (teamId: string | null) => void;
    addTeamMember: (teamId: string, member: TeamMember) => void;
    removeTeamMember: (teamId: string, memberId: string) => void;
    createSession: (session: CollaborativeSession) => void;
    addChatMessage: (roomId: string, message: MatrixMessage) => void;
    updateConsciousness: (metrics: Partial<ConsciousnessMetrics>) => void;
  };
}

// UI State Management
export interface UIState {
  // Panel visibility
  panels: {
    projects: boolean;
    analytics: boolean;
    teams: boolean;
    voiceProfiles: boolean;
    learning: boolean;
  };
  
  // Modal states
  modals: {
    upgrade: boolean;
    fileSelection: boolean;
    confirmation: boolean;
    avatarCustomizer: boolean;
  };
  
  // Navigation and layout
  sidebarCollapsed: boolean;
  activeTab: string;
  theme: 'light' | 'dark' | 'system';
  
  // Loading and error states
  loadingStates: Record<string, boolean>;
  errors: Record<string, string | null>;
  
  // Actions
  actions: {
    togglePanel: (panel: keyof UIState['panels']) => void;
    openModal: (modal: keyof UIState['modals']) => void;
    closeModal: (modal: keyof UIState['modals']) => void;
    setActiveTab: (tab: string) => void;
    setTheme: (theme: UIState['theme']) => void;
    setLoading: (key: string, loading: boolean) => void;
    setError: (key: string, error: string | null) => void;
    clearErrors: () => void;
  };
}

// Authentication State
export interface AuthState {
  // User data
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Subscription and permissions
  subscription: {
    tier: 'free' | 'pro' | 'team' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled';
    quotaUsed: number;
    quotaLimit: number;
  };
  
  // Session management
  sessionExpiry: Date | null;
  refreshToken: string | null;
  
  // Actions
  actions: {
    setUser: (user: User | null) => void;
    setAuthenticated: (authenticated: boolean) => void;
    updateSubscription: (subscription: Partial<AuthState['subscription']>) => void;
    logout: () => void;
    refreshSession: () => Promise<void>;
  };
}

// Consciousness Evolution State
export interface ConsciousnessState {
  // Current consciousness metrics
  level: number;
  evolution: ConsciousnessEvolution[];
  
  // Voice council tracking
  councilSessions: CouncilSession[];
  synthesisHistory: SynthesisResult[];
  
  // Pattern recognition
  patterns: {
    voiceUsage: Record<string, number>;
    synthesisSuccess: number;
    evolutionTrends: EvolutionTrend[];
  };
  
  // Jung's descent protocol tracking
  shadowIntegration: ShadowIntegration;
  archetypeBalance: Record<string, number>;
  
  // Actions
  actions: {
    updateLevel: (level: number) => void;
    addEvolution: (evolution: ConsciousnessEvolution) => void;
    recordCouncilSession: (session: CouncilSession) => void;
    recordSynthesis: (synthesis: SynthesisResult) => void;
    updatePatterns: (patterns: Partial<ConsciousnessState['patterns']>) => void;
  };
}

// Combined app state
export interface AppState {
  voice: VoiceState;
  project: ProjectState;
  team: TeamState;
  ui: UIState;
  auth: AuthState;
  consciousness: ConsciousnessState;
}

// Supporting interfaces
export interface Project {
  id: string;
  name: string;
  code: string;
  language: string;
  tags: string[];
  complexity: number;
  folderId: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectFolder {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: Date;
}

export interface ProjectFile {
  id: string;
  name: string;
  content: string;
  type: string;
  projectId: string;
  path: string;
}

export interface CustomVoice {
  id: string;
  name: string;
  description: string;
  personality: string;
  specialization: string[];
  avatar: string;
  userId: string;
}

export interface VoiceRecommendation {
  perspectives: string[];
  roles: string[];
  confidence: number;
  reasoning: string;
  context: string;
}

export interface VoiceSession {
  id: string;
  perspectives: string[];
  roles: string[];
  prompt: string;
  solutions: Solution[];
  synthesis: SynthesisResult | null;
  createdAt: Date;
}

export interface Solution {
  id: string;
  voiceCombination: string;
  code: string;
  explanation: string;
  confidence: number;
  strengths: string[];
  considerations: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  voiceDefaults: {
    perspectives: string[];
    roles: string[];
  };
  notifications: {
    synthesis: boolean;
    teamUpdates: boolean;
    consciousness: boolean;
  };
}

export interface Team {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: Date;
}

export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: 'admin' | 'member';
  status: 'pending' | 'accepted' | 'declined';
  expiresAt: Date;
}

export interface CollaborativeSession {
  id: string;
  teamId: string;
  name: string;
  participants: string[];
  voiceAssignments: Record<string, string>;
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
}

export interface SharedVoice {
  id: string;
  teamId: string;
  voiceId: string;
  ownerId: string;
  permissions: 'read' | 'write';
  sharedAt: Date;
}

export interface MatrixRoom {
  id: string;
  teamId: string;
  name: string;
  topic: string;
  members: string[];
  consciousnessLevel: number;
}

export interface MatrixMessage {
  id: string;
  roomId: string;
  sender: string;
  senderType: 'user' | 'ai_voice' | 'system';
  content: string;
  timestamp: Date;
  voiceArchetype?: string;
  consciousnessLevel?: number;
}

export interface ConsciousnessMetrics {
  individual: number;
  team: number;
  archetype: Record<string, number>;
  shadow: number;
  spiralPhase: 'collapse' | 'council' | 'synthesis' | 'rebirth';
}

export interface ConsciousnessEvolution {
  timestamp: Date;
  previousLevel: number;
  newLevel: number;
  trigger: string;
  context: string;
}

export interface CouncilSession {
  id: string;
  prompt: string;
  participants: string[];
  responses: Solution[];
  synthesis: SynthesisResult | null;
  consciousnessGain: number;
  timestamp: Date;
}

export interface SynthesisResult {
  id: string;
  sessionId: string;
  synthesizedCode: string;
  explanation: string;
  confidence: number;
  consciousnessLevel: number;
  methodology: string;
  createdAt: Date;
}

export interface EvolutionTrend {
  period: string;
  averageLevel: number;
  growthRate: number;
  patterns: string[];
}

export interface ShadowIntegration {
  identified: string[];
  integrated: string[];
  pending: string[];
  evolutionScore: number;
}

// Store persistence configuration
export interface PersistConfig {
  name: string;
  version: number;
  partialize?: (state: any) => any;
  merge?: (persistedState: any, currentState: any) => any;
}

// Async action states
export interface AsyncState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}

// Store middleware configuration
export interface StoreConfig {
  devtools: boolean;
  persist: boolean;
  logger: boolean;
  errorBoundary: boolean;
}