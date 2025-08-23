/**
 * Extended Type Definitions
 * Additional types to resolve TypeScript compilation errors
 */

// Extended UnifiedModelClient with missing methods
export interface ExtendedUnifiedModelClient {
  currentOptimization?: Record<string, unknown>;
  executeCommand?: (command: string) => Promise<Record<string, unknown>>;
  generateCode?: (prompt: string) => Promise<string>;
  checkConnection?: () => Promise<boolean>;
  analyzeCode?: (code: string) => Promise<Record<string, unknown>>;
  generateVoiceResponse?: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

// Extended voice archetype with missing properties
export interface ExtendedVoiceArchetype {
  prompt?: string;
  systemPrompt: string;
  id: string;
  name: string;
  temperature: number;
  style: string;
}

// Extended synthesis result with missing properties
export interface ExtendedSynthesisResult {
  content: string;
  confidence?: number;
  reasoning?: string;
  combinedCode?: string;
  convergenceReason?: string;
  lessonsLearned?: string[];
  voicesUsed?: string[];
  qualityScore?: number;
}

// Extended iteration result with missing properties
export interface ExtendedIterationResult {
  diff?: string;
  code?: string;
  content: string;
  iterations: Array<{
    content: string;
    feedback: string;
    improvement: number;
  }>;
  writerVoice: string;
  auditorVoice: string;
  totalIterations: number;
  finalQualityScore: number;
  converged: boolean;
  finalCode: string;
}

// CLI Context interface
export interface CLIContext {
  modelClient: Record<string, unknown>;
  voiceSystem: Record<string, unknown>;
  mcpManager: Record<string, unknown>;
  config: Record<string, unknown>;
  getPendingEditsCount?: () => number;
  proposeEdits?: (
    edits: Record<string, unknown>[]
  ) => Promise<{ approved: boolean; edits: Record<string, unknown>[] }>;
  confirmAllEdits?: () => Promise<{
    approved: Record<string, unknown>[];
    rejected: Record<string, unknown>[];
  }>;
  applyEdits?: (edits: Record<string, unknown>[]) => Promise<Record<string, unknown>>;
  clearPendingEdits?: () => void;
  generateEditSummary?: () => Record<string, unknown>;
  displayEditSummary?: () => void;
  options?: Record<string, unknown>;
}

// Global edit confirmation interface
export interface GlobalEditConfirmation {
  getPendingEditsCount: () => number;
  proposeEdits: (
    edits: Record<string, unknown>[]
  ) => Promise<{ approved: boolean; edits: Record<string, unknown>[] }>;
  confirmAllEdits: () => Promise<{
    approved: Record<string, unknown>[];
    rejected: Record<string, unknown>[];
  }>;
  applyEdits: (edits: Record<string, unknown>[]) => Promise<Record<string, unknown>>;
  clearPendingEdits: () => void;
  generateEditSummary: () => Record<string, unknown>;
  displayEditSummary: () => void;
  options?: Record<string, unknown>;
}

// Memory interfaces for workflow orchestrator
export interface WorkflowMemory {
  id: string;
  content: Record<string, unknown>;
  timestamp: number;
  importance?: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

// Performance metrics with all required fields
export interface CompleteProviderMetrics {
  requests: number;
  totalRequests: number;
  totalLatency: number;
  averageLatency: number;
  errorRate?: number;
  successRate: number;
  lastError?: string;
}

// Complete performance metrics interface
export interface CompletePerformanceMetrics {
  timestamp: Date;
  totalRequests: number;
  averageLatency: number;
  errorRate: number;
  providers?: Record<string, CompleteProviderMetrics>;
  overall?: {
    totalRequests: number;
    averageLatency: number;
    successRate: number;
    uptime: number;
  };
}

// Type guards for safe type checking
export function isExtendedUnifiedModelClient(client: any): client is ExtendedUnifiedModelClient {
  return typeof client === 'object' && client !== null;
}

export function isExtendedVoiceArchetype(voice: any): voice is ExtendedVoiceArchetype {
  return typeof voice === 'object' && voice !== null && 'systemPrompt' in voice;
}

export function hasProperty<T extends object, K extends PropertyKey>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return prop in obj;
}
