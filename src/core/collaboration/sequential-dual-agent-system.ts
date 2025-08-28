/**
 * Sequential Dual Agent System
 * Implements sequential collaboration between two AI agents
 */

import { logger } from '../logger.js';
import { EventEmitter } from 'events';

export interface AgentRole {
  id: string;
  name: string;
  specialization: string;
  temperature: number;
  systemPrompt: string;
}

export interface CollaborationTask {
  id: string;
  description: string;
  context: any;
  primaryAgent: string;
  secondaryAgent: string;
  sequenceSteps: string[];
}

export interface CollaborationResult {
  taskId: string;
  primaryOutput: any;
  secondaryOutput: any;
  synthesizedResult: any;
  executionTime: number;
  success: boolean;
}

export class SequentialDualAgentSystem extends EventEmitter {
  private agents: Map<string, AgentRole> = new Map();
  private activeTasks: Map<string, CollaborationTask> = new Map();

  constructor() {
    super();
    this.initializeDefaultAgents();
  }

  private initializeDefaultAgents(): void {
    const defaultAgents: AgentRole[] = [
      {
        id: 'architect',
        name: 'System Architect',
        specialization: 'High-level design and architecture planning',
        temperature: 0.3,
        systemPrompt: 'You are a senior system architect focused on scalable, maintainable solutions.'
      },
      {
        id: 'implementor',
        name: 'Implementation Specialist', 
        specialization: 'Detailed implementation and code generation',
        temperature: 0.2,
        systemPrompt: 'You are an expert developer focused on practical, working implementations.'
      }
    ];

    for (const agent of defaultAgents) {
      this.agents.set(agent.id, agent);
    }
  }

  async executeSequentialCollaboration(task: CollaborationTask): Promise<CollaborationResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting sequential collaboration for task: ${task.id}`);
      this.activeTasks.set(task.id, task);

      // Execute primary agent
      const primaryOutput = await this.executePrimaryAgent(task);
      
      // Execute secondary agent with primary output as context
      const secondaryOutput = await this.executeSecondaryAgent(task, primaryOutput);
      
      // Synthesize final result
      const synthesizedResult = await this.synthesizeResults(primaryOutput, secondaryOutput, task);

      const result: CollaborationResult = {
        taskId: task.id,
        primaryOutput,
        secondaryOutput,
        synthesizedResult,
        executionTime: Date.now() - startTime,
        success: true
      };

      this.activeTasks.delete(task.id);
      this.emit('collaborationComplete', result);
      
      return result;

    } catch (error) {
      logger.error(`Sequential collaboration failed for task ${task.id}:`, error);
      
      const result: CollaborationResult = {
        taskId: task.id,
        primaryOutput: null,
        secondaryOutput: null,
        synthesizedResult: { error: error.message },
        executionTime: Date.now() - startTime,
        success: false
      };

      this.activeTasks.delete(task.id);
      return result;
    }
  }

  private async executePrimaryAgent(task: CollaborationTask): Promise<any> {
    const agent = this.agents.get(task.primaryAgent);
    if (!agent) {
      throw new Error(`Primary agent ${task.primaryAgent} not found`);
    }

    logger.info(`Executing primary agent: ${agent.name}`);
    
    // Simulate agent execution
    return {
      agentId: agent.id,
      agentName: agent.name,
      response: `Primary analysis for: ${task.description}`,
      timestamp: Date.now(),
      specialization: agent.specialization
    };
  }

  private async executeSecondaryAgent(task: CollaborationTask, primaryOutput: any): Promise<any> {
    const agent = this.agents.get(task.secondaryAgent);
    if (!agent) {
      throw new Error(`Secondary agent ${task.secondaryAgent} not found`);
    }

    logger.info(`Executing secondary agent: ${agent.name}`);
    
    // Simulate agent execution with primary context
    return {
      agentId: agent.id,
      agentName: agent.name,
      response: `Secondary implementation for: ${task.description}`,
      primaryContext: primaryOutput,
      timestamp: Date.now(),
      specialization: agent.specialization
    };
  }

  private async synthesizeResults(primaryOutput: any, secondaryOutput: any, task: CollaborationTask): Promise<any> {
    logger.info(`Synthesizing results for task: ${task.id}`);
    
    return {
      taskId: task.id,
      synthesis: `Combined output from ${primaryOutput.agentName} and ${secondaryOutput.agentName}`,
      primaryContribution: primaryOutput.response,
      secondaryContribution: secondaryOutput.response,
      finalRecommendation: `Integrated solution for: ${task.description}`,
      confidence: 0.85,
      timestamp: Date.now()
    };
  }

  addAgent(agent: AgentRole): void {
    this.agents.set(agent.id, agent);
    logger.info(`Added agent: ${agent.name} (${agent.id})`);
  }

  getAgent(agentId: string): AgentRole | undefined {
    return this.agents.get(agentId);
  }

  getActiveAgents(): AgentRole[] {
    return Array.from(this.agents.values());
  }

  getActiveTasks(): CollaborationTask[] {
    return Array.from(this.activeTasks.values());
  }
}