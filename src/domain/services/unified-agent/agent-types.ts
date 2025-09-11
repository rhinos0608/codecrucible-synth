// Core agent interfaces and types extracted from the legacy unified agent system

export interface IAgent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  capabilities: AgentCapability[];
  expertiseDomains: string[];
  isActive?: boolean;
  initialize: () => Promise<void>;
  process: (request: Readonly<AgentRequest>) => Promise<AgentResponse>;
  collaborate: (
    agents: ReadonlyArray<IAgent>,
    task: Readonly<CollaborativeTask>
  ) => Promise<CollaborativeResponse>;
  learn: (feedback: Readonly<AgentFeedback>) => Promise<void>;
  shutdown: () => Promise<void>;
}

export interface AgentRole {
  type:
    | 'explorer'
    | 'maintainer'
    | 'security'
    | 'architect'
    | 'developer'
    | 'analyzer'
    | 'implementor'
    | 'designer'
    | 'optimizer'
    | 'guardian'
    | 'research'
    | 'git-manager'
    | 'code-analyzer'
    | 'problem-solver'
    | 'file-explorer';
  description: string;
  responsibilities: string[];
  authority: 'advisory' | 'decision-making' | 'implementation' | 'review';
  scope: 'local' | 'project' | 'system' | 'global';
  expertise: ExpertiseDomain[];
}

export interface ExpertiseDomain {
  area:
    | 'code-analysis'
    | 'security'
    | 'performance'
    | 'testing'
    | 'documentation'
    | 'architecture'
    | 'deployment'
    | 'debugging'
    | 'optimization'
    | 'research'
    | 'git-operations'
    | 'file-operations'
    | 'project-structure'
    | 'problem-solving';
  level: 'novice' | 'intermediate' | 'advanced' | 'expert';
  experience: number;
}

export interface AgentCapability {
  name: string;
  description: string;
  type:
    | 'analysis'
    | 'generation'
    | 'transformation'
    | 'validation'
    | 'research'
    | 'planning'
    | 'execution'
    | 'monitoring'
    | 'communication'
    | 'learning';
  handler: (task: AgentTask) => Promise<ExecutionResult>;
  priority: number;
  enabled: boolean;
  resources: ResourceRequirements;
}

export interface ResourceRequirements {
  memory: number; // MB
  cpu: number; // percentage
  network: boolean;
  fileSystem: boolean;
  timeout: number; // milliseconds
}

export interface AgentRequest {
  id: string;
  type:
    | 'analyze'
    | 'generate'
    | 'refactor'
    | 'test'
    | 'document'
    | 'debug'
    | 'optimize'
    | 'research'
    | 'git-operation'
    | 'file-operation'
    | 'collaborate';
  input: string | AgentTask;
  context?: ProjectContext;
  constraints?: AgentConstraints;
  preferences?: AgentPreferences;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentConstraints {
  maxExecutionTime?: number;
  maxMemoryUsage?: number;
  allowedResources?: string[];
  securityLevel?: 'low' | 'medium' | 'high' | 'maximum';
  collaborationRules?: CollaborationRule[];
}

export interface AgentPreferences {
  mode?: 'fast' | 'balanced' | 'thorough' | 'creative';
  outputFormat?: 'structured' | 'narrative' | 'code' | 'documentation';
  includeReasoning?: boolean;
  verboseLogging?: boolean;
  interactiveMode?: boolean;
}

export interface CollaborationRule {
  type: 'sequential' | 'parallel' | 'hierarchical' | 'consensus';
  participants: string[]; // agent IDs
  coordination: 'leader-follower' | 'peer-to-peer' | 'democratic';
  conflictResolution: 'majority-vote' | 'expert-decision' | 'user-choice';
}

export interface CollaborativeTask {
  id: string;
  description: string;
  requirements: string[];
  expectedOutput: string;
  coordination: CollaborationRule;
  deadline?: Date;
}

export interface CollaborativeResponse {
  taskId: string;
  participants: string[];
  result: ExecutionResult;
  contributions: Map<string, ExecutionResult>;
  consensus: boolean;
  conflictsResolved: number;
  executionTime: number;
}

export interface AgentFeedback {
  taskId: string;
  rating: number; // 1-10
  comments: string;
  improvements: string[];
  effectiveness: number;
  efficiency: number;
}

export interface ProjectContext {
  rootPath: string;
  language: string[];
  frameworks: string[];
  dependencies: Map<string, string>;
  structure: ProjectStructure;
  documentation: DocumentationIndex;
  git?: GitContext;
}

export interface ProjectStructure {
  directories: string[];
  files: Map<string, FileMetadata>;
  entryPoints: string[];
  testDirectories: string[];
  configFiles: string[];
}

export interface FileMetadata {
  path: string;
  size: number;
  type: string;
  lastModified: Date;
  complexity?: number;
  dependencies?: string[];
}

export interface DocumentationIndex {
  readme: string[];
  guides: string[];
  api: string[];
  examples: string[];
  changelog: string[];
}

export interface GitContext {
  branch: string;
  commits: number;
  status: 'clean' | 'modified' | 'conflicted';
  remotes: string[];
}

export type AgentStatus =
  | 'idle'
  | 'initializing'
  | 'processing'
  | 'collaborating'
  | 'learning'
  | 'error'
  | 'shutdown';

export interface AgentTask {
  id: string;
  description: string;
  input: string;
  expertiseDomains: string[];
}

export interface AgentResponse {
  taskId: string;
  output: string;
  success: boolean;
  error?: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}
