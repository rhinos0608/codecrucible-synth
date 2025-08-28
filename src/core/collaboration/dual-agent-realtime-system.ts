/**
 * Dual Agent Realtime System
 * Real-time collaboration between dual agents with streaming responses
 */

export * from './sequential-dual-agent-system.js';

import { SequentialDualAgentSystem } from './sequential-dual-agent-system.js';
import { EventEmitter } from 'events';
import { logger } from '../logger.js';

export class DualAgentRealtimeSystem extends SequentialDualAgentSystem {
  private streamingConnections: Map<string, EventEmitter> = new Map();

  constructor() {
    super();
  }

  async startRealtimeCollaboration(taskId: string): Promise<EventEmitter> {
    const stream = new EventEmitter();
    this.streamingConnections.set(taskId, stream);
    
    logger.info(`Started realtime collaboration stream for task: ${taskId}`);
    
    // Simulate realtime updates
    setTimeout(() => stream.emit('progress', { step: 'primary_agent_thinking' }), 100);
    setTimeout(() => stream.emit('progress', { step: 'secondary_agent_preparation' }), 500);
    setTimeout(() => stream.emit('progress', { step: 'synthesis_in_progress' }), 1000);
    
    return stream;
  }

  stopRealtimeCollaboration(taskId: string): void {
    const stream = this.streamingConnections.get(taskId);
    if (stream) {
      stream.emit('end');
      this.streamingConnections.delete(taskId);
      logger.info(`Stopped realtime collaboration stream for task: ${taskId}`);
    }
  }
}

export const dualAgentRealtimeSystem = new DualAgentRealtimeSystem();