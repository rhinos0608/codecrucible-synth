/**
 * CLI Types and Interfaces
 * Extracted from monolithic cli.ts for better organization
 */

import { UnifiedModelClient, ProjectContext } from '../client.js';
import { VoiceArchetypeSystem } from '../../voices/voice-archetype-system.js';
import { UnifiedAgent } from '../agent.js';
import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import { AppConfig } from '../../config/config-manager.js';

export interface CLIOptions {
  voices?: string | string[];
  depth?: string;
  mode?: 'competitive' | 'collaborative' | 'consensus' | 'iterative' | 'agentic' | 'comprehensive' | 'analysis';
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
  
  // VRAM management options
  status?: boolean;
  optimize?: boolean;
  test?: boolean;
  models?: boolean;
  configure?: boolean;
  server?: boolean;
  port?: string;
  
  // Additional CLI options
  [key: string]: unknown;
}

export interface CLIContext {
  modelClient: UnifiedModelClient;
  voiceSystem: VoiceArchetypeSystem;
  mcpManager: MCPServerManager;
  config: AppConfig;
  agentOrchestrator?: UnifiedAgent;
  autonomousAgent?: UnifiedAgent;
}