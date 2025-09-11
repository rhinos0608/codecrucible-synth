import {
  IVoiceOrchestrationService,
  VoiceSelection,
} from '../../domain/services/voice-orchestration-service.js';
import { RoutingContext } from './routing-types.js';

export class VoiceIntegrationHandler {
  public constructor(private readonly voiceService: IVoiceOrchestrationService) {}

  public async selectVoices(context: RoutingContext): Promise<VoiceSelection> {
    return this.voiceService.selectVoicesForRequest(context.request, {
      preferredVoices: context.preferences?.preferredVoices,
      maxVoices: context.preferences?.maxVoices,
    });
  }
}
