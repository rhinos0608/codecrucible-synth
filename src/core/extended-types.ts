/**
 * Extended Type Definitions
 * Additional types to resolve TypeScript compilation errors
 */

// Extended UnifiedModelClient with missing methods
export interface ExtendedUnifiedModelClient {
  currentOptimization?: any;
  executeCommand?: (command: string) => Promise<any>;
  generateCode?: (prompt: string) => Promise<any>;
  checkConnection?: () => Promise<boolean>;
  analyzeCode?: (code: string) => Promise<any>;
  generateVoiceResponse?: (input: any) => Promise<any>;
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
  voicesUsed?: any[];
  qualityScore?: number;
}

// Extended iteration result with missing properties
export interface ExtendedIterationResult {
  diff?: string;
  code?: string;
  content: string;
  iterations: Array<{
    content: string;
    feedback: any;
    improvement: number;
  }>;
  writerVoice: any;
  auditorVoice: any;
  totalIterations: any;
  finalQualityScore: number;
  converged: boolean;
  finalCode: string;
}

// CLI Context interface
export interface CLIContext {
  modelClient: any;
  voiceSystem: any;
  mcpManager: any;
  config: any;
  getPendingEditsCount?: () => number;
  proposeEdits?: (edits: any) => Promise<{ approved: boolean; edits: any }>;
  confirmAllEdits?: () => Promise<{ approved: any[]; rejected: any[] }>;
  applyEdits?: (edits: any) => Promise<any>;
  clearPendingEdits?: () => void;
  generateEditSummary?: () => any;
  displayEditSummary?: () => void;
  options?: any;
}

// Global edit confirmation interface
export interface GlobalEditConfirmation {
  getPendingEditsCount: () => number;
  proposeEdits: (edits: any) => Promise<{ approved: boolean; edits: any }>;
  confirmAllEdits: () => Promise<{ approved: any[]; rejected: any[] }>;
  applyEdits: (edits: any) => Promise<any>;
  clearPendingEdits: () => void;
  generateEditSummary: () => any;
  displayEditSummary: () => void;
  options?: any;
}

// Memory interfaces for workflow orchestrator
export interface WorkflowMemory {
  id: string;
  content: any;
  timestamp: number;
  importance?: number;
  embedding?: number[];
  metadata?: any;
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
