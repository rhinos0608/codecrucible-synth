/**
 * Task Memory Database - Persistent task state and context management
 * Enables autonomous agents to resume work after interruptions
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';

export interface TaskState {
  task_id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
  estimated_duration?: string;
  current_phase: number;
  total_phases: number;
  completed_steps: string[];
  failed_attempts: FailedAttempt[];
  agent_assignments: AgentAssignment[];
  context_data: Record<string, any>;
  results: Record<string, any>;
  checkpoints: TaskCheckpoint[];
}

export interface FailedAttempt {
  step: string;
  error: string;
  timestamp: string;
  agent_id?: string;
  retry_count: number;
}

export interface AgentAssignment {
  agent_id: string;
  role: string;
  status: 'assigned' | 'working' | 'completed' | 'failed';
  assigned_steps: string[];
  last_activity: string;
}

export interface TaskCheckpoint {
  id: string;
  phase: number;
  description: string;
  timestamp: string;
  git_commit?: string;
  rollback_script?: string;
}

export class TaskMemoryDB {
  private dbPath: string;
  private tasks: Map<string, TaskState> = new Map();
  private initialized = false;

  constructor(dbPath = '.codecrucible-tasks.json') {
    this.dbPath = join(process.cwd(), dbPath);
  }

  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.dbPath, 'utf-8');
      const taskArray = JSON.parse(data) as TaskState[];

      for (const task of taskArray) {
        this.tasks.set(task.task_id, task);
      }

      logger.info(`TaskMemoryDB initialized with ${this.tasks.size} tasks`);
    } catch (error) {
      // File doesn't exist yet, start fresh
      logger.info('TaskMemoryDB initialized (new database)');
    }

    this.initialized = true;
  }

  async createTask(params: {
    title: string;
    priority: TaskState['priority'];
    estimated_duration?: string;
    total_phases: number;
    context_data?: Record<string, any>;
  }): Promise<TaskState> {
    const task_id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const task: TaskState = {
      task_id,
      title: params.title,
      status: 'pending',
      priority: params.priority,
      created_at: now,
      updated_at: now,
      estimated_duration: params.estimated_duration,
      current_phase: 1,
      total_phases: params.total_phases,
      completed_steps: [],
      failed_attempts: [],
      agent_assignments: [],
      context_data: params.context_data || {},
      results: {},
      checkpoints: [],
    };

    this.tasks.set(task_id, task);
    await this.persist();

    logger.info(`Created task: ${task_id} - ${params.title}`);
    return task;
  }

  async updateTask(task_id: string, updates: Partial<TaskState>): Promise<TaskState | null> {
    const task = this.tasks.get(task_id);
    if (!task) {
      logger.error(`Task not found: ${task_id}`);
      return null;
    }

    const updated = {
      ...task,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.tasks.set(task_id, updated);
    await this.persist();

    logger.info(`Updated task: ${task_id} - Status: ${updated.status}`);
    return updated;
  }

  async addCheckpoint(
    task_id: string,
    checkpoint: Omit<TaskCheckpoint, 'id' | 'timestamp'>
  ): Promise<boolean> {
    const task = this.tasks.get(task_id);
    if (!task) return false;

    const newCheckpoint: TaskCheckpoint = {
      ...checkpoint,
      id: `checkpoint_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    task.checkpoints.push(newCheckpoint);
    task.updated_at = new Date().toISOString();

    await this.persist();
    logger.info(`Added checkpoint for task ${task_id}: ${checkpoint.description}`);
    return true;
  }

  async recordFailedAttempt(
    task_id: string,
    step: string,
    error: string,
    agent_id?: string
  ): Promise<boolean> {
    const task = this.tasks.get(task_id);
    if (!task) return false;

    const existingAttempt = task.failed_attempts.find(
      a => a.step === step && a.agent_id === agent_id
    );

    if (existingAttempt) {
      existingAttempt.retry_count++;
      existingAttempt.timestamp = new Date().toISOString();
      existingAttempt.error = error;
    } else {
      task.failed_attempts.push({
        step,
        error,
        timestamp: new Date().toISOString(),
        agent_id,
        retry_count: 1,
      });
    }

    task.updated_at = new Date().toISOString();
    await this.persist();

    logger.warn(`Recorded failed attempt for task ${task_id}, step: ${step}`);
    return true;
  }

  async assignAgent(
    task_id: string,
    agent_id: string,
    role: string,
    steps: string[]
  ): Promise<boolean> {
    const task = this.tasks.get(task_id);
    if (!task) return false;

    const existingAssignment = task.agent_assignments.find(a => a.agent_id === agent_id);

    if (existingAssignment) {
      existingAssignment.assigned_steps = steps;
      existingAssignment.last_activity = new Date().toISOString();
    } else {
      task.agent_assignments.push({
        agent_id,
        role,
        status: 'assigned',
        assigned_steps: steps,
        last_activity: new Date().toISOString(),
      });
    }

    task.updated_at = new Date().toISOString();
    await this.persist();

    logger.info(`Assigned agent ${agent_id} to task ${task_id} with role: ${role}`);
    return true;
  }

  async getTask(task_id: string): Promise<TaskState | null> {
    return this.tasks.get(task_id) || null;
  }

  async getAllTasks(): Promise<TaskState[]> {
    return Array.from(this.tasks.values());
  }

  async getActiveTasks(): Promise<TaskState[]> {
    return Array.from(this.tasks.values()).filter(
      task => task.status === 'in_progress' || task.status === 'pending'
    );
  }

  async markStepCompleted(task_id: string, step: string, result?: any): Promise<boolean> {
    const task = this.tasks.get(task_id);
    if (!task) return false;

    if (!task.completed_steps.includes(step)) {
      task.completed_steps.push(step);
    }

    if (result) {
      task.results[step] = result;
    }

    task.updated_at = new Date().toISOString();
    await this.persist();

    logger.info(`Completed step for task ${task_id}: ${step}`);
    return true;
  }

  async getTaskProgress(task_id: string): Promise<{
    task: TaskState | null;
    progress_percentage: number;
    current_phase_progress: number;
    estimated_remaining: string;
    next_steps: string[];
  } | null> {
    const task = this.tasks.get(task_id);
    if (!task) return null;

    const total_steps = task.completed_steps.length + task.failed_attempts.length;
    const progress_percentage =
      total_steps > 0 ? (task.completed_steps.length / total_steps) * 100 : 0;

    const current_phase_progress = (task.current_phase / task.total_phases) * 100;

    // Get next steps from agent assignments
    const next_steps: string[] = [];
    for (const assignment of task.agent_assignments) {
      if (assignment.status === 'assigned' || assignment.status === 'working') {
        next_steps.push(
          ...assignment.assigned_steps.filter(s => !task.completed_steps.includes(s))
        );
      }
    }

    // Calculate estimated remaining time
    const estimated_remaining = this.calculateEstimatedRemainingTime(task, progress_percentage, current_phase_progress);

    return {
      task,
      progress_percentage,
      current_phase_progress,
      estimated_remaining,
      next_steps: next_steps.slice(0, 5), // Show next 5 steps
    };
  }

  /**
   * Calculate estimated remaining time for a task based on progress and historical data
   */
  private calculateEstimatedRemainingTime(
    task: TaskState, 
    progress_percentage: number, 
    current_phase_progress: number
  ): string {
    try {
      const now = new Date();
      const createdAt = new Date(task.created_at);
      const elapsedMs = now.getTime() - createdAt.getTime();
      const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

      // If we have an estimated duration, use it as baseline
      if (task.estimated_duration) {
        const estimatedTotalMinutes = this.parseDurationToMinutes(task.estimated_duration);
        if (estimatedTotalMinutes > 0) {
          const remainingMinutes = Math.max(0, estimatedTotalMinutes - elapsedMinutes);
          
          // Adjust based on actual progress vs expected progress
          const expectedProgress = Math.min(100, (elapsedMinutes / estimatedTotalMinutes) * 100);
          const progressDelta = progress_percentage - expectedProgress;
          
          // If we're ahead of schedule, reduce estimate; if behind, increase it
          const adjustmentFactor = progressDelta > 0 ? 0.9 : (progressDelta < -10 ? 1.2 : 1.0);
          const adjustedRemaining = Math.floor(remainingMinutes * adjustmentFactor);
          
          return this.formatDuration(adjustedRemaining);
        }
      }

      // Fallback: Calculate based on progress rate
      if (progress_percentage > 5 && elapsedMinutes > 0) {
        // Calculate rate: progress per minute
        const progressRate = progress_percentage / elapsedMinutes;
        const remainingProgress = 100 - progress_percentage;
        let estimatedRemainingMinutes = Math.floor(remainingProgress / progressRate);

        // Apply complexity adjustments based on task characteristics
        estimatedRemainingMinutes = this.applyComplexityAdjustments(task, estimatedRemainingMinutes);

        return this.formatDuration(estimatedRemainingMinutes);
      }

      // If no progress yet, use phase-based estimation
      if (task.total_phases > 0) {
        const remainingPhases = task.total_phases - task.current_phase + 1;
        const averagePhaseTime = elapsedMinutes / Math.max(1, task.current_phase - 1);
        const estimatedRemainingMinutes = Math.floor(remainingPhases * averagePhaseTime * 0.8); // Slightly optimistic
        
        return this.formatDuration(Math.max(estimatedRemainingMinutes, 5)); // Minimum 5 minutes
      }

      // Default fallback for new tasks
      return this.getDefaultEstimate(task, elapsedMinutes);
      
    } catch (error) {
      logger.error('Error calculating estimated remaining time:', error);
      return 'Unable to estimate';
    }
  }

  /**
   * Parse duration strings like "2h 30m", "45m", "1.5h" to minutes
   */
  private parseDurationToMinutes(duration: string): number {
    try {
      const timeRegex = /(?:(\d+(?:\.\d+)?)\s*h(?:our?s?)?)?(?:\s*(\d+)\s*m(?:in(?:ute)?s?)?)?/i;
      const match = duration.match(timeRegex);
      
      if (match) {
        const hours = parseFloat(match[1] || '0');
        const minutes = parseInt(match[2] || '0', 10);
        return Math.floor(hours * 60 + minutes);
      }

      // Try pure number (assume minutes)
      const numMatch = duration.match(/^\d+$/);
      if (numMatch) {
        return parseInt(duration, 10);
      }

      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Apply adjustments based on task complexity indicators
   */
  private applyComplexityAdjustments(task: TaskState, baseEstimate: number): number {
    let adjustmentFactor = 1.0;

    // More failed attempts = more complexity
    if (task.failed_attempts.length > 0) {
      adjustmentFactor += Math.min(0.5, task.failed_attempts.length * 0.1);
    }

    // High priority tasks often take longer due to thoroughness requirements
    if (task.priority === 'critical' || task.priority === 'high') {
      adjustmentFactor += 0.15;
    }

    // Multiple agents can slow things down due to coordination overhead
    if (task.agent_assignments.length > 2) {
      adjustmentFactor += 0.1;
    }

    // Tasks with many phases tend to have hidden complexity
    if (task.total_phases > 5) {
      adjustmentFactor += 0.2;
    }

    // Rich context data suggests complexity
    const contextKeys = Object.keys(task.context_data || {}).length;
    if (contextKeys > 10) {
      adjustmentFactor += 0.1;
    }

    return Math.floor(baseEstimate * adjustmentFactor);
  }

  /**
   * Format duration in minutes to human-readable string
   */
  private formatDuration(minutes: number): string {
    if (minutes < 1) return 'Less than 1 minute';
    if (minutes === 1) return '1 minute';
    if (minutes < 60) return `${minutes} minutes`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 1 && remainingMinutes === 0) return '1 hour';
    if (hours === 1) return `1 hour ${remainingMinutes} minutes`;
    if (remainingMinutes === 0) return `${hours} hours`;
    
    return `${hours} hours ${remainingMinutes} minutes`;
  }

  /**
   * Provide default estimates for new tasks
   */
  private getDefaultEstimate(task: TaskState, elapsedMinutes: number): string {
    // For very new tasks (< 5 minutes), give optimistic estimates
    if (elapsedMinutes < 5) {
      const baseEstimate = task.total_phases * 15; // 15 minutes per phase
      
      switch (task.priority) {
        case 'critical': return this.formatDuration(Math.floor(baseEstimate * 1.5));
        case 'high': return this.formatDuration(Math.floor(baseEstimate * 1.2));
        case 'medium': return this.formatDuration(baseEstimate);
        case 'low': return this.formatDuration(Math.floor(baseEstimate * 0.8));
        default: return this.formatDuration(baseEstimate);
      }
    }

    // For tasks with some elapsed time but no progress, be more conservative
    return this.formatDuration(Math.max(30, elapsedMinutes * 2));
  }

  private async persist(): Promise<void> {
    if (!this.initialized) return;

    try {
      const taskArray = Array.from(this.tasks.values());
      await fs.writeFile(this.dbPath, JSON.stringify(taskArray, null, 2));
    } catch (error) {
      logger.error('Failed to persist TaskMemoryDB:', error);
    }
  }

  async cleanup(): Promise<void> {
    // Remove completed tasks older than 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const [task_id, task] of this.tasks) {
      if (task.status === 'completed' && new Date(task.updated_at) < oneWeekAgo) {
        this.tasks.delete(task_id);
      }
    }

    await this.persist();
    logger.info('TaskMemoryDB cleanup completed');
  }
}

// Global task memory instance
export const taskMemoryDB = new TaskMemoryDB();
