/**
 * CLI Types and Interfaces
 * Extracted from monolithic cli.ts for better organization
 */

import { UnifiedModelClient } from '../../application/services/client.js';
import { VoiceArchetypeSystem } from '../../voices/voice-archetype-system.js';
import { UnifiedAgentSystem } from '../../domain/services/unified-agent/index.js';
import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import { AppConfig } from '../../config/config-manager.js';

export interface CLIOptions {
  voices?: string | string[];
  depth?: string;
  mode?:
    | 'competitive'
    | 'collaborative'
    | 'consensus'
    | 'iterative'
    | 'agentic'
    | 'comprehensive'
    | 'analysis';
  file?: string;
  project?: boolean;
  interactive?: boolean;
  spiral?: boolean;
  spiralIterations?: number;
  spiralQuality?: number;
  autonomous?: boolean;
  maxSteps?: number;
  council?: boolean;
  agentic?: boolean;
  quick?: boolean;
  direct?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  output?: 'text' | 'json' | 'table';
  timeout?: number;
  backend?: 'docker' | 'e2b' | 'local_e2b' | 'local_process' | 'firecracker' | 'podman' | 'auto';
  e2bTemplate?: string;
  dockerImage?: string;
  fast?: boolean;
  skipInit?: boolean;
  iterative?: boolean;
  maxIterations?: string;
  qualityThreshold?: string;

  // Real-time streaming options (streaming is now default)
  stream?: boolean;
  noStream?: boolean;

  // Role-based model selection
  role?: 'auditor' | 'writer' | 'auto';
  forceProvider?: 'ollama' | 'lm-studio';
  batch?: boolean;

  // Enhanced context awareness options
  enableIntelligence?: boolean;
  contextAware?: boolean;
  smartSuggestions?: boolean;
  projectAnalysis?: boolean;

  // Dual Agent System options
  dualAgent?: boolean;
  realtimeAudit?: boolean;
  autoFix?: boolean;
  streamGeneration?: boolean;
  writerModel?: string;
  auditorModel?: string;

  // Sequential Dual Agent System options
  sequentialReview?: boolean;
  writerProvider?: 'ollama' | 'lm-studio';
  auditorProvider?: 'ollama' | 'lm-studio';
  writerTemp?: number;
  auditorTemp?: number;
  writerTokens?: number;
  auditorTokens?: number;
  autoAudit?: boolean;
  applyFixes?: boolean;
  confidenceThreshold?: number;
  saveResult?: boolean;
  showCode?: boolean;

  // VRAM management options
  status?: boolean;
  optimize?: boolean;
  test?: boolean;
  models?: boolean;
  configure?: boolean;
  server?: boolean;
  port?: string;

  // Authentication options
  token?: string;
  apiKey?: string;
  login?: boolean;
  logout?: boolean;
  register?: boolean;

  // Additional CLI options
  [key: string]: unknown;
}

export interface CLIContext {
  modelClient: UnifiedModelClient;
  voiceSystem: VoiceArchetypeSystem;
  mcpManager: MCPServerManager;
  config: AppConfig;
  agentOrchestrator?: UnifiedAgentSystem;
  autonomousAgent?: UnifiedAgentSystem;
}
