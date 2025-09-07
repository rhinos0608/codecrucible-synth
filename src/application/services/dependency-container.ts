/**
 * Dependency Injection Container - Application Layer
 *
 * Simple dependency injection container following clean architecture principles.
 * Manages creation and lifecycle of application services and use cases.
 */

import { IWorkflowOrchestrator } from '../../domain/interfaces/workflow-orchestrator.js';
import {
  AnalyzeDirectoryUseCase,
  AnalyzeFileUseCase,
  GenerateCodeUseCase,
  IAnalyzeDirectoryUseCase,
  IAnalyzeFileUseCase,
  IGenerateCodeUseCase,
} from '../use-cases/index.js';
import { logger } from '../../infrastructure/logging/logger.js';

export interface UseCaseDependencies {
  analyzeFileUseCase: IAnalyzeFileUseCase;
  generateCodeUseCase: IGenerateCodeUseCase;
  analyzeDirectoryUseCase: IAnalyzeDirectoryUseCase;
}

export class DependencyContainer {
  private _orchestrator?: IWorkflowOrchestrator;
  private _useCases?: UseCaseDependencies;

  /**
   * Initialize the container with required dependencies
   */
  public initialize(orchestrator: Readonly<IWorkflowOrchestrator>): void {
    this._orchestrator = orchestrator;
    this._useCases = this.createUseCases();
    logger.info('Dependency container initialized');
  }

  /**
   * Get the workflow orchestrator
   */
  public get orchestrator(): IWorkflowOrchestrator {
    if (!this._orchestrator) {
      throw new Error('Dependency container not initialized. Call initialize() first.');
    }
    return this._orchestrator;
  }

  /**
   * Get all use cases
   */
  public get useCases(): UseCaseDependencies {
    if (!this._useCases) {
      throw new Error('Dependency container not initialized. Call initialize() first.');
    }
    return this._useCases;
  }

  /**
   * Get analyze file use case
   */
  public get analyzeFileUseCase(): IAnalyzeFileUseCase {
    return this.useCases.analyzeFileUseCase;
  }

  /**
   * Get generate code use case
   */
  public get generateCodeUseCase(): IGenerateCodeUseCase {
    return this.useCases.generateCodeUseCase;
  }

  /**
   * Get analyze directory use case
   */
  public get analyzeDirectoryUseCase(): IAnalyzeDirectoryUseCase {
    return this.useCases.analyzeDirectoryUseCase;
  }

  /**
   * Create and configure all use cases
   */
  private createUseCases(): UseCaseDependencies {
    if (!this._orchestrator) {
      throw new Error('Orchestrator must be set before creating use cases');
    }

    return {
      analyzeFileUseCase: new AnalyzeFileUseCase(this._orchestrator),
      generateCodeUseCase: new GenerateCodeUseCase(this._orchestrator),
      analyzeDirectoryUseCase: new AnalyzeDirectoryUseCase(this._orchestrator),
    };
  }

  /**
   * Check if container is initialized
   */
  public get isInitialized(): boolean {
    return !!(this._orchestrator && this._useCases);
  }

  /**
   * Clear all dependencies (for cleanup)
   */
  public cleanup(): void {
    this._orchestrator = undefined;
    this._useCases = undefined;
    logger.info('Dependency container cleaned up');
  }
}

// Singleton instance
let containerInstance: DependencyContainer | undefined;

/**
 * Get the global dependency container instance
 */
export function getDependencyContainer(): DependencyContainer {
  if (!containerInstance) {
    containerInstance = new DependencyContainer();
  }
  return containerInstance;
}

/**
 * Initialize the global dependency container
 */
export function initializeDependencyContainer(
  orchestrator: Readonly<IWorkflowOrchestrator>
): DependencyContainer {
  const container = getDependencyContainer();
  container.initialize(orchestrator);
  return container;
}
