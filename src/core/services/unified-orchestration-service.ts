/**
 * Legacy Unified Orchestration Service - Backward Compatibility Wrapper
 * 
 * This is a temporary wrapper around the new application layer service
 * to maintain backward compatibility during the architectural migration.
 * 
 * @deprecated Use UnifiedOrchestrationService from application/services instead
 */

export { 
  UnifiedOrchestrationService, 
  createUnifiedOrchestrationService,
  type OrchestrationRequest,
  type OrchestrationResponse
} from '../../application/services/unified-orchestration-service.js';