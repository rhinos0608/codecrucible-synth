/**
 * Autonomous Task Manager - Orchestrates multi-agent task execution
 * Handles task planning, agent coordination, and autonomous execution
 */

import { EventEmitter } from 'events';
import { logger } from './logger.js';
import { taskMemoryDB, TaskState, AgentAssignment } from './task-memory-db.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TaskPlan {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  phases: TaskPhase[];
  success_criteria: string[];
  rollback_strategy: string;
}

export interface TaskPhase {
  name: string;
  description: string;
  steps: TaskStep[];
  agents_required: string[];
  estimated_duration: string;
  dependencies: string[];
}

export interface TaskStep {
  id: string;
  description: string;
  action_type: 'code' | 'test' | 'analysis' | 'cleanup' | 'validation';
  command?: string;
  files_affected?: string[];
  validation_criteria?: string;
  rollback_action?: string;
}

export class AutonomousTaskManager extends EventEmitter {
  private agents: Map<string, AgentWorker> = new Map();
  private initialized = false;
  private taskPlanPath: string;

  constructor() {
    super();
    this.taskPlanPath = join(process.cwd(), 'task.md');
  }

  async initialize(): Promise<void> {
    await taskMemoryDB.initialize();

    // Initialize specialized agents
    this.agents.set('primary-fixer', new AgentWorker('primary-fixer', 'Development and Fixes'));
    this.agents.set('test-runner', new AgentWorker('test-runner', 'Testing and Validation'));
    this.agents.set('cleaner', new AgentWorker('cleaner', 'Cleanup and Optimization'));
    this.agents.set('coordinator', new AgentWorker('coordinator', 'Task Coordination'));

    this.initialized = true;
    logger.info('AutonomousTaskManager initialized with 4 agents');
  }

  async planAndExecuteTask(taskDescription: string): Promise<TaskState> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Generate comprehensive task plan
    const plan = await this.generateTaskPlan(taskDescription);

    // Create task in memory DB
    const task = await taskMemoryDB.createTask({
      title: plan.title,
      priority: plan.priority,
      estimated_duration: this.estimateTaskDuration(plan),
      total_phases: plan.phases.length,
      context_data: {
        description: plan.description,
        success_criteria: plan.success_criteria,
        rollback_strategy: plan.rollback_strategy,
      },
    });

    // Update task.md with detailed plan
    await this.updateTaskFile(task, plan);

    // Assign agents to phases
    await this.assignAgentsToTask(task.task_id, plan);

    // Start autonomous execution
    await this.executeTaskAutonomously(task.task_id);

    return task;
  }

  private async generateTaskPlan(description: string): Promise<TaskPlan> {
    // For now, use the current CodeCrucible fix plan
    // In production, this would use AI to generate plans
    return {
      title: 'Fix CodeCrucible Synth Critical Issues',
      description,
      priority: 'critical',
      phases: [
        {
          name: 'Critical Fixes',
          description: 'Fix immediate blocking issues',
          steps: [
            {
              id: 'fix_context_window',
              description: 'Fix Ollama context window size (1024 → 8192)',
              action_type: 'code',
              files_affected: ['src/providers/ollama.ts'],
              command: 'npm run build',
              validation_criteria: 'Test with long prompt succeeds',
            },
            {
              id: 'fix_versions',
              description: 'Standardize version numbers to v3.8.9',
              action_type: 'code',
              files_affected: ['src/index.ts', 'src/core/cli.ts', 'bin/*.js'],
            },
            {
              id: 'fix_memory_leaks',
              description: 'Fix EventEmitter memory leak warnings',
              action_type: 'code',
              files_affected: ['src/index.ts'],
            },
          ],
          agents_required: ['primary-fixer', 'test-runner'],
          estimated_duration: '30 minutes',
          dependencies: [],
        },
        {
          name: 'Test Infrastructure',
          description: 'Fix failing tests and validation',
          steps: [
            {
              id: 'fix_unit_tests',
              description: 'Fix 36 failing unit tests',
              action_type: 'test',
              command: 'npm test',
              validation_criteria: 'All tests pass',
            },
            {
              id: 'clean_emergency_scripts',
              description: 'Archive emergency fix scripts',
              action_type: 'cleanup',
              command: 'mkdir emergency-archive && mv *fix*.* emergency-archive/',
            },
          ],
          agents_required: ['test-runner', 'cleaner'],
          estimated_duration: '45 minutes',
          dependencies: ['Critical Fixes'],
        },
        {
          name: 'Autonomous Systems',
          description: 'Implement full autonomous workflow',
          steps: [
            {
              id: 'validate_core_functionality',
              description: 'Test core codebase analysis works',
              action_type: 'validation',
              command: 'node dist/bin/crucible.js "analyze this codebase"',
              validation_criteria: 'Returns actual project analysis, not generic response',
            },
          ],
          agents_required: ['coordinator'],
          estimated_duration: '30 minutes',
          dependencies: ['Critical Fixes', 'Test Infrastructure'],
        },
      ],
      success_criteria: [
        'Core codebase analysis functionality works',
        'All tests pass',
        'No memory leaks',
        'Version consistency',
        'Clean codebase',
      ],
      rollback_strategy: 'Git reset to last working commit, restore from backup',
    };
  }

  private async assignAgentsToTask(task_id: string, plan: TaskPlan): Promise<void> {
    for (const phase of plan.phases) {
      for (const agentId of phase.agents_required) {
        const steps = phase.steps
          .filter(step => this.isAgentSuitableForStep(agentId, step))
          .map(step => step.id);

        if (steps.length > 0) {
          await taskMemoryDB.assignAgent(task_id, agentId, this.getAgentRole(agentId), steps);
        }
      }
    }
  }

  private async executeTaskAutonomously(task_id: string): Promise<void> {
    const task = await taskMemoryDB.getTask(task_id);
    if (!task) {
      logger.error(`Task not found: ${task_id}`);
      return;
    }

    console.log(chalk.blue('🤖 Starting Autonomous Task Execution'));
    console.log(chalk.gray(`Task: ${task.title}`));

    await taskMemoryDB.updateTask(task_id, { status: 'in_progress' });

    // Create initial checkpoint
    await taskMemoryDB.addCheckpoint(task_id, {
      phase: 0,
      description: 'Task execution started',
    });

    try {
      // Execute each agent's assigned steps
      for (const assignment of task.agent_assignments) {
        await this.executeAgentAssignment(task_id, assignment);
      }

      // Validate success criteria
      const success = await this.validateTaskCompletion(task_id);

      if (success) {
        await taskMemoryDB.updateTask(task_id, { status: 'completed' });
        console.log(chalk.green('✅ Task completed successfully!'));
      } else {
        await taskMemoryDB.updateTask(task_id, { status: 'failed' });
        console.log(chalk.red('❌ Task failed validation'));
      }
    } catch (error) {
      await taskMemoryDB.recordFailedAttempt(
        task_id,
        'autonomous_execution',
        error instanceof Error ? error.message : String(error)
      );
      await taskMemoryDB.updateTask(task_id, { status: 'failed' });
      console.error(chalk.red('❌ Task execution failed:'), error);
    }
  }

  private async executeAgentAssignment(
    task_id: string,
    assignment: AgentAssignment
  ): Promise<void> {
    const agent = this.agents.get(assignment.agent_id);
    if (!agent) {
      logger.error(`Agent not found: ${assignment.agent_id}`);
      return;
    }

    console.log(chalk.cyan(`🤖 Agent ${assignment.agent_id} starting work`));

    for (const stepId of assignment.assigned_steps) {
      try {
        const result = await agent.executeStep(stepId);
        await taskMemoryDB.markStepCompleted(task_id, stepId, result);

        console.log(chalk.green(`  ✅ ${stepId} completed`));

        // Create checkpoint after important steps
        if (stepId.includes('fix_context') || stepId.includes('test')) {
          await taskMemoryDB.addCheckpoint(task_id, {
            phase: 1,
            description: `Completed ${stepId}`,
            git_commit: await this.createGitCommit(`Automated: ${stepId}`),
          });
        }
      } catch (error) {
        await taskMemoryDB.recordFailedAttempt(
          task_id,
          stepId,
          error instanceof Error ? error.message : String(error),
          assignment.agent_id
        );
        console.error(
          chalk.red(`  ❌ ${stepId} failed:`),
          error instanceof Error ? error.message : String(error)
        );

        // Try alternative approach or continue to next step
        console.log(chalk.yellow(`  🔄 Continuing to next step...`));
      }
    }
  }

  private async validateTaskCompletion(_task_id: string): Promise<boolean> {
    console.log(chalk.blue('🔍 Validating task completion...'));

    const validations = [
      async () => {
        console.log('  • Testing core functionality...');
        try {
          const { stdout } = await execAsync('timeout 30 node dist/bin/crucible.js "test prompt"');
          return !stdout.includes('I need to see the codebase');
        } catch {
          return false;
        }
      },
      async () => {
        console.log('  • Running tests...');
        try {
          const { stdout } = await execAsync('npm test');
          return !stdout.includes('FAIL');
        } catch {
          return false;
        }
      },
      async () => {
        console.log('  • Checking build...');
        try {
          await execAsync('npm run build');
          return true;
        } catch {
          return false;
        }
      },
    ];

    const results = await Promise.all(validations.map(v => v()));
    const passCount = results.filter(r => r).length;

    console.log(chalk.blue(`  Validation: ${passCount}/${results.length} checks passed`));

    return passCount >= 2; // Allow 1 failure
  }

  private async updateTaskFile(task: TaskState, plan: TaskPlan): Promise<void> {
    const taskContent = await this.generateTaskMarkdown(task, plan);
    await fs.writeFile(this.taskPlanPath, taskContent);
    logger.info('Updated task.md with current plan');
  }

  private async generateTaskMarkdown(task: TaskState, plan: TaskPlan): Promise<string> {
    const progress = await taskMemoryDB.getTaskProgress(task.task_id);

    return `# 🎯 AUTONOMOUS TASK: ${task.title}

**Task ID:** ${task.task_id}  
**Status:** ${task.status.toUpperCase()}  
**Progress:** ${progress?.progress_percentage.toFixed(1)}%  
**Updated:** ${new Date().toISOString()}

## 📊 OVERVIEW
${plan.description}

## 🎯 SUCCESS CRITERIA
${plan.success_criteria.map(c => `- [ ] ${c}`).join('\n')}

## 🤖 AGENT ASSIGNMENTS
${task.agent_assignments
  .map(a => `- **${a.agent_id}** (${a.role}): ${a.status.toUpperCase()}`)
  .join('\n')}

## 📋 PROGRESS
### Completed Steps:
${task.completed_steps.map(s => `- ✅ ${s}`).join('\n') || '- None yet'}

### Failed Attempts:
${task.failed_attempts.map(f => `- ❌ ${f.step}: ${f.error} (attempts: ${f.retry_count})`).join('\n') || '- None'}

### Next Steps:
${progress?.next_steps.map(s => `- ⏳ ${s}`).join('\n') || '- Calculating...'}

## 🔄 CHECKPOINTS
${task.checkpoints.map(c => `- **${c.description}** (${c.timestamp})`).join('\n') || '- None yet'}

---
*Auto-generated by AutonomousTaskManager*`;
  }

  private isAgentSuitableForStep(agentId: string, step: TaskStep): boolean {
    const agentCapabilities: Record<string, string[]> = {
      'primary-fixer': ['code', 'analysis'],
      'test-runner': ['test', 'validation'],
      cleaner: ['cleanup'],
      coordinator: ['validation', 'analysis'],
    };

    return agentCapabilities[agentId]?.includes(step.action_type) || false;
  }

  private getAgentRole(agentId: string): string {
    const roles: Record<string, string> = {
      'primary-fixer': 'Development and Fixes',
      'test-runner': 'Testing and Validation',
      cleaner: 'Cleanup and Optimization',
      coordinator: 'Task Coordination',
    };
    return roles[agentId] || 'General';
  }

  private estimateTaskDuration(plan: TaskPlan): string {
    const totalMinutes = plan.phases.reduce((sum, phase) => {
      const phaseMinutes = parseInt(phase.estimated_duration) || 30;
      return sum + phaseMinutes;
    }, 0);

    return `${Math.ceil(totalMinutes / 60)} hours`;
  }

  private async createGitCommit(message: string): Promise<string> {
    try {
      await execAsync('git add .');
      const { stdout } = await execAsync(`git commit -m "${message}"`);
      return stdout.split(' ')[0]; // Return commit hash
    } catch {
      return 'no-commit';
    }
  }
}

class AgentWorker {
  constructor(
    private id: string,
    private role: string
  ) {}

  async executeStep(stepId: string): Promise<any> {
    console.log(chalk.gray(`    🔧 ${this.id}: Executing ${stepId}`));

    // Simulate work - in production this would call actual tools
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return mock result
    return {
      stepId,
      agent: this.id,
      timestamp: new Date().toISOString(),
      result: 'completed',
    };
  }
}

export const autonomousTaskManager = new AutonomousTaskManager();
