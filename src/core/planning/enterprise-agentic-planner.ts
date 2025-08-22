/**
 * Enterprise Agentic Planner - Enhanced version following Claude Code patterns
 * Integrates security validation, TodoWrite patterns, and enterprise standards
 */

import {
  EnterpriseSecurityFramework,
  SecurityContext,
} from '../security/enterprise-security-framework.js';
import { logger } from '../logger.js';

export interface EnterprisePlan {
  id: string;
  objective: string;
  securityValidated: boolean;
  tasks: EnterpriseTask[];
  estimatedTime: number;
  context: ExecutionContext;
  toolRequirements: string[];
  mcpCapabilities: MCPCapability[];
  qualityGates: QualityGate[];
  rollbackStrategy: RollbackStrategy;
  riskAssessment: RiskAssessment;
}

export interface EnterpriseTask {
  id: string;
  description: string;
  dependencies: string[];
  estimatedDuration: number;
  requiredTools: string[];
  successCriteria: string[];
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  assignedVoice?: string;
  qualityGate?: QualityGate;
}

export interface ExecutionContext {
  workingDirectory: string;
  gitRepository: boolean;
  branch: string;
  environment: 'development' | 'testing' | 'production';
  permissions: string[];
  constraints: ExecutionConstraint[];
}

export interface MCPCapability {
  serverId: string;
  tools: ToolCapability[];
  resources: any[];
  prompts: any[];
}

export interface ToolCapability {
  name: string;
  description: string;
  schema: any;
  reliability: number;
  securityLevel: 'safe' | 'restricted' | 'dangerous';
  dependencies: string[];
}

export interface QualityGate {
  id: string;
  name: string;
  criteria: QualityCriteria[];
  threshold: number;
  automated: boolean;
  blocking: boolean;
}

export interface QualityCriteria {
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number | string;
  weight: number;
}

export interface RollbackStrategy {
  enabled: boolean;
  checkpoints: string[];
  automatedRollback: boolean;
  rollbackTriggers: string[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  mitigations: string[];
  contingencyPlans: ContingencyPlan[];
}

export interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  impact: number;
  description: string;
}

export interface ContingencyPlan {
  trigger: string;
  actions: string[];
  escalation: boolean;
}

export interface ExecutionConstraint {
  type: 'time' | 'resource' | 'security' | 'quality';
  value: any;
  enforcement: 'advisory' | 'blocking';
}

export class EnterpriseAgenticPlanner {
  private securityFramework: EnterpriseSecurityFramework;
  private modelClient: any;

  constructor(modelClient: any) {
    this.securityFramework = new EnterpriseSecurityFramework();
    this.modelClient = modelClient;
  }

  async createPlan(
    objective: string,
    context: ExecutionContext,
    securityContext: SecurityContext
  ): Promise<EnterprisePlan> {
    logger.info('Creating enterprise plan', { objective, context });

    // Step 1: Security validation of objective
    const securityValidation = await this.securityFramework.validateAgentAction(
      'enterprise-planner',
      {
        type: 'code_generation',
        agentId: 'enterprise-planner',
        payload: { objective },
        timestamp: new Date(),
      },
      securityContext
    );

    if (!securityValidation.allowed) {
      throw new Error(
        `Security validation failed: ${securityValidation.violations.map(v => v.description).join(', ')}`
      );
    }

    // Step 2: Task breakdown using TodoWrite pattern
    const taskBreakdown = await this.generateTaskBreakdown(objective, context);

    // Step 3: Risk assessment
    const riskAssessment = await this.assessRisks(objective, taskBreakdown, context);

    // Step 4: Tool and capability discovery
    const toolRequirements = this.identifyRequiredTools(taskBreakdown);
    const mcpCapabilities = await this.discoverMCPCapabilities();

    // Step 5: Quality gates definition
    const qualityGates = this.defineQualityGates(objective, taskBreakdown);

    // Step 6: Rollback strategy
    const rollbackStrategy = this.createRollbackStrategy(taskBreakdown, riskAssessment);

    // Step 7: Create structured plan
    const plan: EnterprisePlan = {
      id: this.generatePlanId(),
      objective,
      securityValidated: true,
      tasks: taskBreakdown,
      estimatedTime: this.calculateEstimatedTime(taskBreakdown),
      context,
      toolRequirements,
      mcpCapabilities,
      qualityGates,
      rollbackStrategy,
      riskAssessment,
    };

    logger.info('Enterprise plan created', {
      planId: plan.id,
      taskCount: plan.tasks.length,
      estimatedTime: plan.estimatedTime,
      riskLevel: plan.riskAssessment.overallRisk,
    });

    return plan;
  }

  private async generateTaskBreakdown(
    objective: string,
    context: ExecutionContext
  ): Promise<EnterpriseTask[]> {
    const planningPrompt = `# ENTERPRISE TASK BREAKDOWN REQUEST

Objective: ${objective}

Context:
- Working Directory: ${context.workingDirectory}
- Environment: ${context.environment}
- Git Repository: ${context.gitRepository}
- Branch: ${context.branch}

Create a detailed task breakdown following enterprise patterns:

## 1. Research Phase
- Understand existing codebase and patterns
- Identify security requirements and constraints
- Analyze dependencies and integration points
- Review compliance and policy requirements

## 2. Planning Phase  
- Define implementation approach and architecture
- Identify required tools and MCP capabilities
- Plan testing strategy and quality gates
- Design rollback and contingency strategies

## 3. Implementation Phase
- Code implementation following security best practices
- Progressive testing and validation at each step
- Documentation and compliance artifact updates
- Performance monitoring and optimization

## 4. Verification Phase
- Comprehensive testing (unit, integration, security)
- Quality gate validation and compliance checks
- Performance benchmarking and optimization
- Security audit and vulnerability assessment

## 5. Deployment Phase
- Staged deployment with canary releases
- Monitoring and alerting configuration
- Rollback verification and testing
- Documentation and knowledge transfer

Return tasks in structured JSON format with:
- Clear, actionable descriptions (TodoWrite compatible)
- Dependencies between tasks with explicit ordering
- Estimated duration in minutes
- Required tools/capabilities with security levels
- Success criteria and quality gates
- Security level classification
- Assigned voice recommendations

Ensure all tasks follow the "fewer than 4 lines" conciseness requirement for CLI environments.`;

    try {
      const response = await this.modelClient.processRequest({
        prompt: planningPrompt,
        temperature: 0.2,
        maxTokens: 4000,
      });

      return this.parseTaskBreakdown(response.content, context);
    } catch (error) {
      logger.error('Failed to generate task breakdown', { error });
      return this.createFallbackTasks(objective, context);
    }
  }

  private parseTaskBreakdown(response: string, context: ExecutionContext): EnterpriseTask[] {
    try {
      // Extract JSON from response (handling markdown code blocks)
      const jsonMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : response;

      const tasks = JSON.parse(jsonContent);

      return tasks.map((task: any, index: number) => ({
        id: `task_${index + 1}`,
        description: task.description || `Task ${index + 1}`,
        dependencies: task.dependencies || [],
        estimatedDuration: task.estimatedDuration || 30,
        requiredTools: task.requiredTools || [],
        successCriteria: task.successCriteria || ['Task completed successfully'],
        securityLevel: task.securityLevel || 'medium',
        status: 'pending' as const,
        assignedVoice: task.assignedVoice,
        qualityGate: task.qualityGate,
      }));
    } catch (error) {
      logger.warn('Failed to parse task breakdown, using fallback', { error });
      return this.createFallbackTasks('Parse task breakdown', context);
    }
  }

  private createFallbackTasks(objective: string, context: ExecutionContext): EnterpriseTask[] {
    return [
      {
        id: 'task_1',
        description: `Research and analyze requirements for: ${objective}`,
        dependencies: [],
        estimatedDuration: 15,
        requiredTools: ['grep', 'find', 'read'],
        successCriteria: ['Requirements documented', 'Constraints identified'],
        securityLevel: 'low' as const,
        status: 'pending' as const,
        assignedVoice: 'explorer',
      },
      {
        id: 'task_2',
        description: `Plan implementation approach for: ${objective}`,
        dependencies: ['task_1'],
        estimatedDuration: 20,
        requiredTools: ['TodoWrite'],
        successCriteria: ['Implementation plan created', 'Dependencies identified'],
        securityLevel: 'medium' as const,
        status: 'pending' as const,
        assignedVoice: 'architect',
      },
      {
        id: 'task_3',
        description: `Implement solution for: ${objective}`,
        dependencies: ['task_2'],
        estimatedDuration: 45,
        requiredTools: ['write', 'edit', 'bash'],
        successCriteria: ['Code implemented', 'Tests passing'],
        securityLevel: 'high' as const,
        status: 'pending' as const,
        assignedVoice: 'implementor',
      },
      {
        id: 'task_4',
        description: `Verify and test solution for: ${objective}`,
        dependencies: ['task_3'],
        estimatedDuration: 20,
        requiredTools: ['bash', 'read'],
        successCriteria: ['All tests pass', 'Quality gates satisfied'],
        securityLevel: 'medium' as const,
        status: 'pending' as const,
        assignedVoice: 'guardian',
      },
    ];
  }

  private async assessRisks(
    objective: string,
    tasks: EnterpriseTask[],
    context: ExecutionContext
  ): Promise<RiskAssessment> {
    const riskFactors: RiskFactor[] = [];

    // Assess security risks
    const highSecurityTasks = tasks.filter(
      t => t.securityLevel === 'high' || t.securityLevel === 'critical'
    );
    if (highSecurityTasks.length > 0) {
      riskFactors.push({
        type: 'security',
        severity: 'high',
        probability: 0.3,
        impact: 0.8,
        description: `${highSecurityTasks.length} high-security tasks require careful validation`,
      });
    }

    // Assess complexity risks
    const complexTasks = tasks.filter(t => t.dependencies.length > 2);
    if (complexTasks.length > tasks.length / 2) {
      riskFactors.push({
        type: 'complexity',
        severity: 'medium',
        probability: 0.4,
        impact: 0.6,
        description: 'High task interdependency may cause cascading delays',
      });
    }

    // Assess environment risks
    if (context.environment === 'production') {
      riskFactors.push({
        type: 'environment',
        severity: 'critical',
        probability: 0.2,
        impact: 0.9,
        description: 'Production environment changes require enhanced validation',
      });
    }

    // Calculate overall risk
    const averageSeverity =
      riskFactors.reduce((sum, factor) => {
        const severityScore = { low: 1, medium: 2, high: 3, critical: 4 }[factor.severity];
        return sum + severityScore * factor.probability * factor.impact;
      }, 0) / riskFactors.length;

    const overallRisk: 'low' | 'medium' | 'high' | 'critical' =
      averageSeverity > 3
        ? 'critical'
        : averageSeverity > 2
          ? 'high'
          : averageSeverity > 1
            ? 'medium'
            : 'low';

    return {
      overallRisk,
      riskFactors,
      mitigations: this.generateRiskMitigations(riskFactors),
      contingencyPlans: this.createContingencyPlans(riskFactors),
    };
  }

  private generateRiskMitigations(riskFactors: RiskFactor[]): string[] {
    const mitigations: string[] = [];

    for (const factor of riskFactors) {
      switch (factor.type) {
        case 'security':
          mitigations.push('Enhanced security validation at each step');
          mitigations.push('Security expert review for high-risk tasks');
          break;
        case 'complexity':
          mitigations.push('Break complex tasks into smaller subtasks');
          mitigations.push('Implement dependency validation checks');
          break;
        case 'environment':
          mitigations.push('Staged deployment with rollback capability');
          mitigations.push('Enhanced monitoring and alerting');
          break;
      }
    }

    return [...new Set(mitigations)]; // Remove duplicates
  }

  private createContingencyPlans(riskFactors: RiskFactor[]): ContingencyPlan[] {
    const plans: ContingencyPlan[] = [];

    if (riskFactors.some(f => f.type === 'security')) {
      plans.push({
        trigger: 'Security validation failure',
        actions: [
          'Halt execution immediately',
          'Escalate to security team',
          'Review and remediate security issues',
          'Re-validate before proceeding',
        ],
        escalation: true,
      });
    }

    if (riskFactors.some(f => f.type === 'complexity')) {
      plans.push({
        trigger: 'Task dependency failure',
        actions: [
          'Identify failed dependency',
          'Execute fallback task sequence',
          'Notify stakeholders of delay',
          'Adjust timeline and expectations',
        ],
        escalation: false,
      });
    }

    return plans;
  }

  private identifyRequiredTools(tasks: EnterpriseTask[]): string[] {
    const tools = new Set<string>();

    tasks.forEach(task => {
      task.requiredTools.forEach(tool => tools.add(tool));
    });

    // Add standard enterprise tools
    tools.add('TodoWrite');
    tools.add('security-validator');
    tools.add('quality-gate-checker');

    return Array.from(tools);
  }

  private async discoverMCPCapabilities(): Promise<MCPCapability[]> {
    // In a full implementation, this would query the MCP server manager
    return [
      {
        serverId: 'filesystem',
        tools: [
          {
            name: 'read_file',
            description: 'Read file contents',
            schema: {},
            reliability: 0.95,
            securityLevel: 'safe',
            dependencies: [],
          },
          {
            name: 'write_file',
            description: 'Write file contents',
            schema: {},
            reliability: 0.9,
            securityLevel: 'restricted',
            dependencies: [],
          },
        ],
        resources: [],
        prompts: [],
      },
      {
        serverId: 'git',
        tools: [
          {
            name: 'git_status',
            description: 'Get git repository status',
            schema: {},
            reliability: 0.98,
            securityLevel: 'safe',
            dependencies: [],
          },
        ],
        resources: [],
        prompts: [],
      },
    ];
  }

  private defineQualityGates(objective: string, tasks: EnterpriseTask[]): QualityGate[] {
    const gates: QualityGate[] = [];

    // Security gate
    if (tasks.some(t => t.securityLevel === 'high' || t.securityLevel === 'critical')) {
      gates.push({
        id: 'security_gate',
        name: 'Security Validation Gate',
        criteria: [
          { metric: 'security_score', operator: '>=', value: 90, weight: 1.0 },
          { metric: 'vulnerability_count', operator: '=', value: 0, weight: 1.0 },
        ],
        threshold: 90,
        automated: true,
        blocking: true,
      });
    }

    // Quality gate
    gates.push({
      id: 'quality_gate',
      name: 'Code Quality Gate',
      criteria: [
        { metric: 'test_coverage', operator: '>=', value: 80, weight: 0.4 },
        { metric: 'complexity_score', operator: '<=', value: 10, weight: 0.3 },
        { metric: 'documentation_coverage', operator: '>=', value: 70, weight: 0.3 },
      ],
      threshold: 75,
      automated: true,
      blocking: false,
    });

    return gates;
  }

  private createRollbackStrategy(
    tasks: EnterpriseTask[],
    riskAssessment: RiskAssessment
  ): RollbackStrategy {
    const highRisk =
      riskAssessment.overallRisk === 'high' || riskAssessment.overallRisk === 'critical';

    return {
      enabled: true,
      checkpoints: tasks
        .filter(t => t.securityLevel === 'high' || t.securityLevel === 'critical')
        .map(t => t.id),
      automatedRollback: highRisk,
      rollbackTriggers: [
        'security_validation_failure',
        'quality_gate_failure',
        'critical_error',
        ...(highRisk ? ['test_failure', 'performance_degradation'] : []),
      ],
    };
  }

  private calculateEstimatedTime(tasks: EnterpriseTask[]): number {
    // Calculate critical path through task dependencies
    const totalTime = tasks.reduce((sum, task) => sum + task.estimatedDuration, 0);

    // Add overhead for enterprise processes (15% buffer)
    return Math.ceil(totalTime * 1.15);
  }

  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
