import { ProcessingRequest } from '../../domain/entities/request.js';
import { ModelSelection } from '../../domain/services/model-selection-service.js';
import { VoiceSelection } from '../../domain/services/voice-orchestration-service.js';
import { SelectionResult } from '../../providers/provider-selection-strategy.js';
import {
  RoutingDecision,
  TaskComplexityMetrics,
} from '../../providers/hybrid/hybrid-llm-router.js';

export interface RoutingPreferences {
  prioritizeSpeed?: boolean;
  prioritizeQuality?: boolean;
  maxLatency?: number;
  optimizeForCost?: boolean;
  maxCostPerRequest?: number;
  preferredVoices?: string[];
  maxVoices?: number;
  enableMultiVoice?: boolean;
  preferredProviders?: string[];
  excludeProviders?: string[];
  enableHybridRouting?: boolean;
  enableLoadBalancing?: boolean;
  learningEnabled?: boolean;
}

export interface RoutingContext {
  request: ProcessingRequest;
  priority: 'low' | 'medium' | 'high' | 'critical';
  phase?: 'collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection';
  preferences?: RoutingPreferences;
  metrics?: TaskComplexityMetrics;
}

export interface IntelligentRoutingDecision {
  modelSelection: ModelSelection;
  voiceSelection: VoiceSelection;
  providerSelection: SelectionResult;
  hybridRouting?: RoutingDecision;
  routingStrategy: 'single-model' | 'hybrid' | 'multi-voice' | 'load-balanced';
  confidence: number;
  reasoning: string;
  estimatedCost: number;
  estimatedLatency: number;
  estimatedQuality: number;
  fallbackChain: Array<{ type: 'model' | 'voice' | 'provider'; option: string; reason: string }>;
  routingId: string;
  timestamp: number;
  context: RoutingContext;
}

export interface RoutingPerformance {
  success: boolean;
  actualLatency: number;
  actualCost: number;
  qualityScore: number;
  errorType?: string;
  userSatisfaction?: number;
}

export interface RoutingAnalytics {
  totalRequests: number;
  successRate: number;
  averageLatency: number;
  averageCost: number;
  routingAccuracy: number;
  strategyPerformance: Map<
    string,
    { requests: number; successRate: number; avgLatency: number; avgCost: number }
  >;
  phasePerformance: Map<
    string,
    { requests: number; avgQuality: number; preferredStrategy: string }
  >;
}

export interface IIntelligentRoutingCoordinator {
  routeRequest: (context: Readonly<RoutingContext>) => Promise<IntelligentRoutingDecision>;
  recordPerformance: (routingId: string, performance: Readonly<RoutingPerformance>) => void;
  getAnalytics: () => RoutingAnalytics;
  optimizeRouting: () => Promise<void>;
}
