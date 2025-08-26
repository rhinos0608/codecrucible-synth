/**
 * Workflow Template Domain Entity
 * Pure business logic for AI workflow templates
 *
 * Living Spiral Council Applied:
 * - Domain-driven design with pure business entities  
 * - No external dependencies or infrastructure concerns
 * - Business rules for workflow template matching and execution
 */

import { Domain } from './execution-plan.js';

/**
 * Workflow Step Priority Value Object
 */
export class WorkflowStepPriority {
  private static readonly VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
  
  private constructor(private readonly _value: typeof WorkflowStepPriority.VALID_PRIORITIES[number]) {}

  static create(value: string): WorkflowStepPriority {
    const normalizedValue = value.toLowerCase();
    if (!this.VALID_PRIORITIES.includes(normalizedValue as any)) {
      return new WorkflowStepPriority('medium'); // Default
    }
    return new WorkflowStepPriority(normalizedValue as any);
  }

  static low(): WorkflowStepPriority {
    return new WorkflowStepPriority('low');
  }

  static medium(): WorkflowStepPriority {
    return new WorkflowStepPriority('medium');
  }

  static high(): WorkflowStepPriority {
    return new WorkflowStepPriority('high');
  }

  static critical(): WorkflowStepPriority {
    return new WorkflowStepPriority('critical');
  }

  get value(): string {
    return this._value;
  }

  equals(other: WorkflowStepPriority): boolean {
    return this._value === other._value;
  }

  isCritical(): boolean {
    return this._value === 'critical';
  }

  isHighOrAbove(): boolean {
    return this._value === 'high' || this._value === 'critical';
  }

  /**
   * Business rule: Calculate execution weight for scheduling
   */
  getExecutionWeight(): number {
    switch (this._value) {
      case 'critical': return 1.0;
      case 'high': return 0.8;
      case 'medium': return 0.5;
      case 'low': return 0.2;
      default: return 0.5;
    }
  }
}

/**
 * Required Tools Value Object
 */
export class RequiredTools {
  private constructor(private readonly _tools: readonly string[]) {}

  static create(tools: string[]): RequiredTools {
    const uniqueTools = Array.from(new Set(tools.filter(tool => tool && tool.trim().length > 0)));
    return new RequiredTools(Object.freeze(uniqueTools));
  }

  static empty(): RequiredTools {
    return new RequiredTools(Object.freeze([]));
  }

  get tools(): readonly string[] {
    return this._tools;
  }

  get count(): number {
    return this._tools.length;
  }

  isEmpty(): boolean {
    return this._tools.length === 0;
  }

  hasTool(toolName: string): boolean {
    return this._tools.includes(toolName);
  }

  /**
   * Business rule: Check if all required tools are available in the provided set
   */
  areAvailable(availableTools: string[]): boolean {
    return this._tools.every(requiredTool => 
      availableTools.some(available => 
        available.toLowerCase().includes(requiredTool.toLowerCase())
      )
    );
  }

  /**
   * Business rule: Get missing tools from available set
   */
  getMissingTools(availableTools: string[]): string[] {
    return this._tools.filter(requiredTool =>
      !availableTools.some(available => 
        available.toLowerCase().includes(requiredTool.toLowerCase())
      )
    );
  }

  withAdditionalTool(toolName: string): RequiredTools {
    if (!toolName || toolName.trim().length === 0 || this._tools.includes(toolName)) {
      return this;
    }
    return new RequiredTools(Object.freeze([...this._tools, toolName]));
  }
}

/**
 * Target Resources Value Object
 */
export class TargetResources {
  private constructor(private readonly _targets: readonly string[]) {}

  static create(targets: string[] = []): TargetResources {
    const validTargets = targets.filter(target => target && target.trim().length > 0);
    return new TargetResources(Object.freeze(validTargets));
  }

  static empty(): TargetResources {
    return new TargetResources(Object.freeze([]));
  }

  get targets(): readonly string[] {
    return this._targets;
  }

  get count(): number {
    return this._targets.length;
  }

  isEmpty(): boolean {
    return this._targets.length === 0;
  }

  hasTarget(targetName: string): boolean {
    return this._targets.includes(targetName);
  }

  /**
   * Business rule: Check if targets are file paths
   */
  areFilePaths(): boolean {
    return this._targets.some(target => 
      target.includes('/') || target.includes('\\') || target.includes('.')
    );
  }

  /**
   * Business rule: Check if targets are directory paths  
   */
  areDirectoryPaths(): boolean {
    return this._targets.some(target => 
      target.endsWith('/') || target.includes('src') || target.includes('lib')
    );
  }
}

/**
 * Workflow Trigger Value Object
 */
export class WorkflowTrigger {
  private constructor(private readonly _patterns: readonly string[]) {}

  static create(patterns: string[]): WorkflowTrigger {
    const validPatterns = patterns
      .filter(pattern => pattern && pattern.trim().length > 0)
      .map(pattern => pattern.toLowerCase().trim());
    
    if (validPatterns.length === 0) {
      throw new Error('Workflow trigger must have at least one pattern');
    }
    
    return new WorkflowTrigger(Object.freeze(validPatterns));
  }

  get patterns(): readonly string[] {
    return this._patterns;
  }

  /**
   * Business rule: Check if the provided prompt matches any trigger pattern
   */
  matches(prompt: string): boolean {
    const normalizedPrompt = prompt.toLowerCase();
    return this._patterns.some(pattern => 
      normalizedPrompt.includes(pattern)
    );
  }

  /**
   * Business rule: Calculate match confidence score
   */
  calculateMatchConfidence(prompt: string): number {
    const normalizedPrompt = prompt.toLowerCase();
    const matches = this._patterns.filter(pattern => 
      normalizedPrompt.includes(pattern)
    ).length;
    
    return Math.min(1.0, matches / this._patterns.length);
  }

  /**
   * Business rule: Get the best matching pattern
   */
  getBestMatch(prompt: string): string | null {
    const normalizedPrompt = prompt.toLowerCase();
    
    // Find longest matching pattern for best specificity
    let bestMatch = null;
    let bestMatchLength = 0;
    
    for (const pattern of this._patterns) {
      if (normalizedPrompt.includes(pattern) && pattern.length > bestMatchLength) {
        bestMatch = pattern;
        bestMatchLength = pattern.length;
      }
    }
    
    return bestMatch;
  }
}

/**
 * Workflow Step Entity - Individual step in a workflow template
 */
export class WorkflowStep {
  private readonly _stepNumber: number;
  private readonly _action: string;
  private readonly _requiredTools: RequiredTools;
  private readonly _targets: TargetResources;
  private readonly _context: string;
  private readonly _priority: WorkflowStepPriority;
  private readonly _isMandatory: boolean;

  constructor(
    stepNumber: number,
    action: string,
    requiredTools: RequiredTools,
    targets: TargetResources,
    context: string,
    priority: WorkflowStepPriority = WorkflowStepPriority.medium(),
    isMandatory: boolean = false
  ) {
    this.validateInputs(stepNumber, action, context);
    
    this._stepNumber = stepNumber;
    this._action = action;
    this._requiredTools = requiredTools;
    this._targets = targets;
    this._context = context;
    this._priority = priority;
    this._isMandatory = isMandatory;
  }

  // Getters
  get stepNumber(): number {
    return this._stepNumber;
  }

  get action(): string {
    return this._action;
  }

  get requiredTools(): RequiredTools {
    return this._requiredTools;
  }

  get targets(): TargetResources {
    return this._targets;
  }

  get context(): string {
    return this._context;
  }

  get priority(): WorkflowStepPriority {
    return this._priority;
  }

  get isMandatory(): boolean {
    return this._isMandatory;
  }

  // Business methods

  /**
   * Business rule: Check if this step can be executed with available tools
   */
  canExecute(availableTools: string[]): boolean {
    return this._requiredTools.areAvailable(availableTools);
  }

  /**
   * Business rule: Check if this step should be skipped based on constraints
   */
  shouldSkip(availableTools: string[], skipOptional: boolean = false): boolean {
    // Can't skip mandatory steps
    if (this._isMandatory) {
      return false;
    }
    
    // Skip if tools not available
    if (!this.canExecute(availableTools)) {
      return true;
    }
    
    // Skip optional steps if requested
    if (skipOptional && !this._isMandatory) {
      return true;
    }
    
    return false;
  }

  /**
   * Business rule: Calculate execution priority score for scheduling
   */
  calculateExecutionScore(): number {
    let score = this._priority.getExecutionWeight();
    
    // Mandatory steps get higher priority
    if (this._isMandatory) {
      score += 0.3;
    }
    
    // Steps with fewer tool requirements are easier to execute
    const toolComplexity = Math.min(0.3, this._requiredTools.count * 0.1);
    score -= toolComplexity;
    
    return Math.max(0.1, Math.min(1.0, score));
  }

  /**
   * Create step with updated priority
   */
  withPriority(newPriority: WorkflowStepPriority): WorkflowStep {
    return new WorkflowStep(
      this._stepNumber,
      this._action,
      this._requiredTools,
      this._targets,
      this._context,
      newPriority,
      this._isMandatory
    );
  }

  /**
   * Create step with additional required tool
   */
  withAdditionalTool(toolName: string): WorkflowStep {
    return new WorkflowStep(
      this._stepNumber,
      this._action,
      this._requiredTools.withAdditionalTool(toolName),
      this._targets,
      this._context,
      this._priority,
      this._isMandatory
    );
  }

  private validateInputs(stepNumber: number, action: string, context: string): void {
    if (stepNumber < 1) {
      throw new Error('Workflow step number must be positive');
    }
    
    if (!action || action.trim().length === 0) {
      throw new Error('Workflow step action cannot be empty');
    }
    
    if (!context || context.trim().length === 0) {
      throw new Error('Workflow step context cannot be empty');
    }
  }
}

/**
 * Workflow Template Entity - Core business object representing a reusable workflow
 */
export class WorkflowTemplate {
  private readonly _name: string;
  private readonly _domain: Domain;
  private readonly _description: string;
  private readonly _trigger: WorkflowTrigger;
  private readonly _steps: readonly WorkflowStep[];

  constructor(
    name: string,
    domain: Domain,
    description: string,
    trigger: WorkflowTrigger,
    steps: WorkflowStep[]
  ) {
    this.validateInputs(name, description, steps);
    
    this._name = name;
    this._domain = domain;
    this._description = description;
    this._trigger = trigger;
    this._steps = Object.freeze([...steps]);
  }

  // Getters
  get name(): string {
    return this._name;
  }

  get domain(): Domain {
    return this._domain;
  }

  get description(): string {
    return this._description;
  }

  get trigger(): WorkflowTrigger {
    return this._trigger;
  }

  get steps(): readonly WorkflowStep[] {
    return this._steps;
  }

  // Business methods

  /**
   * Business rule: Check if this template matches the given prompt
   */
  matches(prompt: string): boolean {
    return this._trigger.matches(prompt);
  }

  /**
   * Business rule: Calculate how well this template matches the prompt
   */
  calculateMatchScore(prompt: string): number {
    return this._trigger.calculateMatchConfidence(prompt);
  }

  /**
   * Business rule: Check if this template can be executed with available tools
   */
  canExecute(availableTools: string[]): boolean {
    const mandatorySteps = this._steps.filter(step => step.isMandatory);
    return mandatorySteps.every(step => step.canExecute(availableTools));
  }

  /**
   * Business rule: Get executable steps based on available tools
   */
  getExecutableSteps(availableTools: string[], skipOptional: boolean = false): WorkflowStep[] {
    return this._steps.filter(step => !step.shouldSkip(availableTools, skipOptional));
  }

  /**
   * Business rule: Get all required tools for this workflow
   */
  getAllRequiredTools(): string[] {
    const allTools = new Set<string>();
    this._steps.forEach(step => 
      step.requiredTools.tools.forEach(tool => allTools.add(tool))
    );
    return Array.from(allTools);
  }

  /**
   * Business rule: Get missing tools that prevent execution
   */
  getMissingTools(availableTools: string[]): string[] {
    const missingTools = new Set<string>();
    
    this._steps.forEach(step => {
      if (step.isMandatory) {
        step.requiredTools.getMissingTools(availableTools)
          .forEach(tool => missingTools.add(tool));
      }
    });
    
    return Array.from(missingTools);
  }

  /**
   * Business rule: Estimate execution time for this workflow
   */
  estimateExecutionTime(): number {
    // Base time per step: 2-8 minutes depending on complexity
    const baseTimePerStep = this._steps.reduce((total, step) => {
      const stepComplexity = step.requiredTools.count;
      const stepTime = Math.min(8, Math.max(2, stepComplexity * 2));
      return total + stepTime;
    }, 0);
    
    // Domain-specific adjustments
    let domainMultiplier = 1.0;
    if (this._domain.requiresHighPrecision()) {
      domainMultiplier = 1.3;
    }
    
    return Math.ceil(baseTimePerStep * domainMultiplier);
  }

  /**
   * Business rule: Calculate overall workflow complexity
   */
  calculateComplexity(): 'simple' | 'moderate' | 'complex' {
    const totalSteps = this._steps.length;
    const totalTools = this.getAllRequiredTools().length;
    const mandatorySteps = this._steps.filter(step => step.isMandatory).length;
    
    const complexityScore = (totalSteps * 0.3) + (totalTools * 0.4) + (mandatorySteps * 0.3);
    
    if (complexityScore > 8) return 'complex';
    if (complexityScore > 4) return 'moderate';
    return 'simple';
  }

  /**
   * Create an optimized version with reordered steps by priority
   */
  withOptimizedStepOrder(): WorkflowTemplate {
    const sortedSteps = [...this._steps].sort((a, b) => {
      // Mandatory steps first
      if (a.isMandatory && !b.isMandatory) return -1;
      if (!a.isMandatory && b.isMandatory) return 1;
      
      // Then by execution score (higher first)
      return b.calculateExecutionScore() - a.calculateExecutionScore();
    });
    
    // Renumber steps to maintain sequential order
    const renumberedSteps = sortedSteps.map((step, index) => 
      new WorkflowStep(
        index + 1,
        step.action,
        step.requiredTools,
        step.targets,
        step.context,
        step.priority,
        step.isMandatory
      )
    );
    
    return new WorkflowTemplate(
      this._name,
      this._domain,
      this._description,
      this._trigger,
      renumberedSteps
    );
  }

  private validateInputs(name: string, description: string, steps: WorkflowStep[]): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Workflow template name cannot be empty');
    }
    
    if (!description || description.trim().length === 0) {
      throw new Error('Workflow template description cannot be empty');
    }
    
    if (!steps || steps.length === 0) {
      throw new Error('Workflow template must have at least one step');
    }
    
    // Validate step numbering
    const stepNumbers = steps.map(step => step.stepNumber).sort((a, b) => a - b);
    for (let i = 0; i < stepNumbers.length; i++) {
      if (stepNumbers[i] !== i + 1) {
        throw new Error('Workflow steps must be numbered sequentially starting from 1');
      }
    }
  }

  // Factory methods
  
  static createProjectAnalysisTemplate(): WorkflowTemplate {
    const trigger = WorkflowTrigger.create([
      'analyze project', 'project structure', 'examine codebase',
      'review architecture', 'understand project', 'explore codebase'
    ]);
    
    const steps = [
      new WorkflowStep(
        1,
        'List root directory structure',
        RequiredTools.create(['filesystem_list_directory']),
        TargetResources.create(['.']),
        'Get overview of project organization and identify key directories',
        WorkflowStepPriority.critical(),
        true
      ),
      new WorkflowStep(
        2,
        'Read project metadata files',
        RequiredTools.create(['filesystem_read_file']),
        TargetResources.create(['README.md', 'package.json', 'tsconfig.json']),
        'Understand project purpose, dependencies, and configuration',
        WorkflowStepPriority.high(),
        true
      ),
      new WorkflowStep(
        3,
        'Examine source code structure',
        RequiredTools.create(['filesystem_list_directory', 'filesystem_find_files']),
        TargetResources.create(['src/', 'lib/', 'app/']),
        'Map source code organization and identify key modules',
        WorkflowStepPriority.high(),
        true
      ),
      new WorkflowStep(
        4,
        'Sample representative source files',
        RequiredTools.create(['filesystem_read_file']),
        TargetResources.empty(),
        'Read key source files to understand architecture patterns and implementation details',
        WorkflowStepPriority.medium(),
        false
      )
    ];
    
    return new WorkflowTemplate(
      'project_analysis',
      Domain.coding(),
      'Comprehensive project structure and architecture analysis',
      trigger,
      steps
    );
  }

  static createFileSystemExplorationTemplate(): WorkflowTemplate {
    const trigger = WorkflowTrigger.create([
      'explore files', 'browse directory', 'show me files',
      'what\'s in this project', 'file structure', 'directory contents'
    ]);
    
    const steps = [
      new WorkflowStep(
        1,
        'List current directory contents',
        RequiredTools.create(['filesystem_list_directory']),
        TargetResources.empty(),
        'Show all files and directories in the current location',
        WorkflowStepPriority.critical(),
        true
      ),
      new WorkflowStep(
        2,
        'Examine important files',
        RequiredTools.create(['filesystem_read_file', 'filesystem_file_stats']),
        TargetResources.empty(),
        'Read key configuration and documentation files',
        WorkflowStepPriority.medium(),
        false
      )
    ];
    
    return new WorkflowTemplate(
      'filesystem_exploration',
      Domain.general(),
      'Systematic file system navigation and content discovery',
      trigger,
      steps
    );
  }
}

/**
 * Configuration interface for external systems
 */
export interface WorkflowTemplateConfiguration {
  name: string;
  domain: string;
  description: string;
  triggers: string[];
  steps: {
    step: number;
    action: string;
    requiredTools: string[];
    targets?: string[];
    context: string;
    priority?: string;
    mandatory?: boolean;
  }[];
}