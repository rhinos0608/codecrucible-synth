// TypeScript interfaces for all state shapes
// Following AI_INSTRUCTIONS.md patterns with comprehensive type safety

export interface VoiceState {
  selectedPerspectives: string[];
  selectedRoles: string[];
  customVoices: CustomVoice[];
  recommendations: VoiceRecommendation[];
  analysisContext: string;
  activeSession: VoiceSession | null;
  sessionHistory: VoiceSession[];
  actions: {
    selectPerspectives: (perspectives: string[]) => void;
    selectRoles: (roles: string[]) => void;
    addCustomVoice: (voice: CustomVoice) => void;
    removeCustomVoice: (voiceId: string) => void;
    setRecommendations: (recommendations: VoiceRecommendation[]) => void;
    createSession: (sessionData: Omit<VoiceSession, 'id'>) => void;
    clearSelection: () => void;
  };
}

export interface ProjectState {
  projects: Record<string, Project>;
  folders: Record<string, ProjectFolder>;
  files: Record<string, ProjectFile>;
  selectedProject: string | null;
  selectedFolder: string | null;
  expandedFolders: Set<string>;
  isCreating: boolean;
  isDeleting: boolean;
  isMoving: boolean;
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

export interface UIState {
  panels: {
    projects: boolean;
    analytics: boolean;
    teams: boolean;
    voiceProfiles: boolean;
    learning: boolean;
  };
  modals: {
    upgrade: boolean;
    fileSelection: boolean;
    confirmation: boolean;
    avatarCustomizer: boolean;
  };
  sidebarCollapsed: boolean;
  activeTab: string;
  theme: 'light' | 'dark' | 'system';
  loadingStates: Record<string, boolean>;
  errors: Record<string, string>;
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

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  subscription: {
    tier: string;
    status: string;
    quotaUsed: number;
    quotaLimit: number;
  };
  sessionExpiry: Date | null;
  refreshToken: string | null;
  actions: {
    setUser: (user: User | null) => void;
    setAuthenticated: (authenticated: boolean) => void;
    updateSubscription: (subscription: Partial<AuthState['subscription']>) => void;
    logout: () => void;
    refreshSession: () => Promise<void>;
  };
}

export interface TeamState {
  teams: Record<string, Team>;
  activeTeam: string | null;
  members: Record<string, TeamMember[]>;
  invitations: TeamInvitation[];
  activeSessions: CollaborativeSession[];
  sharedVoices: CustomVoice[];
  matrixRooms: Record<string, MatrixRoom>;
  chatMessages: Record<string, MatrixMessage[]>;
  consciousnessMetrics: ConsciousnessMetrics;
  actions: {
    setActiveTeam: (teamId: string | null) => void;
    addTeamMember: (teamId: string, member: TeamMember) => void;
    removeTeamMember: (teamId: string, memberId: string) => void;
    createSession: (session: CollaborativeSession) => void;
    addChatMessage: (roomId: string, message: MatrixMessage) => void;
    updateConsciousness: (metrics: Partial<ConsciousnessMetrics>) => void;
  };
}

export interface ConsciousnessState {
  level: number;
  evolution: ConsciousnessEvolution[];
  councilSessions: CouncilSession[];
  synthesisHistory: SynthesisResult[];
  patterns: {
    voiceUsage: Record<string, number>;
    synthesisSuccess: number;
    evolutionTrends: EvolutionTrend[];
  };
  shadowIntegration: {
    identified: string[];
    integrated: string[];
    pending: string[];
    evolutionScore: number;
  };
  archetypeBalance: Record<string, number>;
  actions: {
    updateLevel: (level: number) => void;
    addEvolution: (evolution: ConsciousnessEvolution) => void;
    recordCouncilSession: (session: CouncilSession) => void;
    recordSynthesis: (synthesis: SynthesisResult) => void;
    updatePatterns: (patterns: Partial<ConsciousnessState['patterns']>) => void;
  };
}

export interface AppState {
  voice: VoiceState;
  project: ProjectState;
  ui: UIState;
  auth: AuthState;
  team: TeamState;
  consciousness: ConsciousnessState;
}

// Supporting interfaces
export interface CustomVoice {
  id: string;
  name: string;
  description: string;
  specialization: string[];
  personality: string;
  avatar: string;
  userId: string;
}

export interface VoiceRecommendation {
  perspectives: string[];
  roles: string[];
  confidence: number;
  reasoning: string;
}

export interface VoiceSession {
  id: string;
  perspectives: string[];
  roles: string[];
  prompt: string;
  solutions: any[];
  synthesis: any;
  createdAt: Date;
}

export interface Project {
  id: string;
  name: string;
  language: string;
  code: string;
  complexity: number;
  tags: string[];
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
  projectId: string;
  name: string;
  content: string;
  type: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  preferences: Record<string, any>;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  description: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: string;
  joinedAt: Date;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: string;
  status: string;
}

export interface CollaborativeSession {
  id: string;
  teamId: string;
  name: string;
  participants: string[];
  voiceAssignments: Record<string, string>;
  status: string;
  createdAt: Date;
}

export interface MatrixRoom {
  id: string;
  name: string;
  teamId: string;
}

export interface MatrixMessage {
  id: string;
  roomId: string;
  sender: string;
  senderType: 'user' | 'ai_voice';
  content: string;
  voiceArchetype?: string;
  consciousnessLevel?: number;
  timestamp: Date;
}

export interface ConsciousnessMetrics {
  individual: number;
  team: number;
  archetype: Record<string, number>;
  shadow: number;
  spiralPhase: string;
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
  responses: any[];
  synthesis: any;
  consciousnessGain: number;
  timestamp: Date;
}

export interface SynthesisResult {
  id: string;
  sessionId: string;
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

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}

export interface PersistConfig {
  name: string;
  version?: number;
  partialize?: (state: any) => any;
  merge?: (persistedState: any, currentState: any) => any;
}