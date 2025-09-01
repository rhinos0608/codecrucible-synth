/**
 * Rust Execution Backend - Production Implementation
 *
 * Integrates the complete Rust executor with comprehensive security, performance,
 * and tool execution capabilities. Replaces TypeScript executors with blazing-fast Rust.
 */
import { logger } from '../../logger.js';
import * as path from 'path';
/**
 * Production Rust-backed execution backend replacing all TypeScript executors
 */
export class RustExecutionBackend {
    constructor(options = {}, tsOrchestrator) {
        this.rustExecutor = null;
        this.initialized = false;
        this.performanceStats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageExecutionTime: 0,
        };
        this.options = {
            enableProfiling: true,
            maxConcurrency: 4,
            timeoutMs: 30000,
            logLevel: 'info',
            ...options,
        };
        this.tsOrchestrator = tsOrchestrator;
    }
    /**
     * Inject TypeScript tool orchestrator for fallback execution
     */
    setTypescriptOrchestrator(orchestrator) {
        this.tsOrchestrator = orchestrator;
    }
    /**
     * Initialize the Rust executor NAPI module
     */
    async initialize() {
        try {
            // Initialize logging for Rust module
            if (typeof global !== 'undefined') {
                const { initLogging } = await import('./rust-native-module.js').catch(async () => {
                    try {
                        // Try alternative import paths
                        const napiModule = await import('codecrucible-rust-executor').catch(() => {
                            // Try direct NAPI build output
                            const directPath = path.join(process.cwd(), 'rust-executor.node');
                            return import(directPath);
                        });
                        return napiModule;
                    }
                    catch {
                        // Return empty module as fallback
                        return {};
                    }
                });
                if (initLogging) {
                    await initLogging(this.options.logLevel);
                    logger.info('🚀 Rust executor logging initialized');
                }
            }
            // Load the Rust executor NAPI module
            const { RustExecutor, createRustExecutor } = await import('./rust-native-module.js').catch(async () => {
                try {
                    // Try the NAPI module name from package.json
                    const napiModule = await import('codecrucible-rust-executor').catch(() => {
                        // Try direct build output path
                        const directPath = path.join(process.cwd(), 'rust-executor.node');
                        return import(directPath);
                    });
                    return napiModule;
                }
                catch {
                    // Return empty module as fallback
                    return {};
                }
            });
            if (RustExecutor || createRustExecutor) {
                this.rustExecutor = RustExecutor ? RustExecutor.create() : createRustExecutor();
                // Initialize the Rust executor
                const initResult = await this.rustExecutor.initialize();
                if (initResult) {
                    this.initialized = true;
                    logger.info('🚀 RustExecutionBackend initialized successfully', {
                        executorId: this.rustExecutor.getId(),
                        supportedTools: this.rustExecutor.getSupportedTools(),
                        performanceMetrics: this.options.enableProfiling,
                    });
                }
                else {
                    logger.error('❌ Rust executor initialization failed');
                    this.initialized = false;
                    throw new Error('Rust executor initialization failed');
                }
                this.initialized = true;
                logger.info('🚀 RustExecutionBackend initialized successfully', {
                    executorId: this.rustExecutor.getId(),
                    supportedTools: this.rustExecutor.getSupportedTools(),
                    performanceMetrics: this.options.enableProfiling,
                });
                return true;
            }
            logger.warn('Rust module not found or invalid - falling back to TypeScript');
            this.initialized = false;
            return false;
        }
        catch (error) {
            logger.error('RustExecutionBackend initialization error:', error);
            this.initialized = false;
            return false;
        }
    }
    /**
     * Execute a tool request using Rust backend with comprehensive error handling
     */
    async execute(request) {
        const startTime = Date.now();
        this.performanceStats.totalRequests++;
        // Fallback to TypeScript if Rust not available
        if (!this.initialized || !this.rustExecutor) {
            logger.debug('🔄 Using TypeScript fallback for tool execution');
            return this.executeTypescriptFallback(request);
        }
        try {
            // Determine execution strategy based on request
            let result;
            if (request.toolId === 'filesystem' || request.toolId?.startsWith('file')) {
                // File system operations
                result = await this.executeFilesystemOperation(request);
            }
            else if (request.toolId === 'command' || request.toolId?.startsWith('cmd')) {
                // Command operations
                result = await this.executeCommandOperation(request);
            }
            else {
                // Generic tool execution
                result = await this.executeGenericOperation(request);
            }
            // Update performance stats
            this.performanceStats.successfulRequests++;
            this.updateAverageExecutionTime(Date.now() - startTime);
            logger.debug('✅ Rust execution completed', {
                toolId: request.toolId,
                executionTime: result.execution_time_ms,
                success: result.success,
            });
            return {
                success: result.success,
                result: result.result,
                error: result.error
                    ? {
                        code: 'RUST_EXECUTION_ERROR',
                        message: result.error,
                    }
                    : undefined,
                metadata: {
                    executionTimeMs: result.execution_time_ms,
                    executor: 'rust',
                    performanceMetrics: result.performance_metrics,
                    ...request.metadata,
                },
                executionTimeMs: result.execution_time_ms,
            };
        }
        catch (error) {
            this.performanceStats.failedRequests++;
            logger.error('Rust execution failed:', error);
            return {
                success: false,
                result: undefined,
                error: {
                    code: 'RUST_EXECUTION_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown Rust execution error',
                    details: error instanceof Error ? { stack: error.stack } : error,
                },
                metadata: {
                    executionTimeMs: Date.now() - startTime,
                    executor: 'rust',
                    ...request.metadata,
                },
                executionTimeMs: Date.now() - startTime,
            };
        }
    }
    /**
     * Check if Rust backend is available
     */
    isAvailable() {
        return this.initialized && this.rustExecutor !== null;
    }
    /**
     * Get executor strategy identifier
     */
    getStrategy() {
        return 'rust';
    }
    /**
     * Cleanup resources
     */
    async destroy() {
        if (this.rustExecutor) {
            try {
                // Cleanup Rust resources if needed
                this.rustExecutor = null;
                this.initialized = false;
                logger.info('RustExecutionBackend cleaned up');
            }
            catch (error) {
                logger.error('Error cleaning up Rust executor:', error);
            }
        }
    }
    // Private helper methods
    async executeTypescriptFallback(request) {
        const startTime = Date.now();
        this.performanceStats.totalRequests++;
        if (!this.tsOrchestrator) {
            this.performanceStats.failedRequests++;
            return {
                success: false,
                result: undefined,
                error: {
                    code: 'TYPESCRIPT_ORCHESTRATOR_UNAVAILABLE',
                    message: 'No TypeScript tool orchestrator provided',
                },
                metadata: {
                    executionTimeMs: Date.now() - startTime,
                    executor: 'typescript-fallback',
                    ...request.metadata,
                },
                executionTimeMs: Date.now() - startTime,
            };
        }
        try {
            const result = await this.tsOrchestrator.execute(request);
            this.performanceStats.successfulRequests++;
            this.updateAverageExecutionTime(Date.now() - startTime);
            return {
                ...result,
                metadata: {
                    ...result.metadata,
                    executor: 'typescript-fallback',
                    ...request.metadata,
                },
                executionTimeMs: result.executionTimeMs ?? Date.now() - startTime,
            };
        }
        catch (error) {
            this.performanceStats.failedRequests++;
            return {
                success: false,
                result: undefined,
                error: {
                    code: 'TYPESCRIPT_FALLBACK_ERROR',
                    message: error instanceof Error ? error.message : 'TypeScript fallback failed',
                    details: error instanceof Error ? { stack: error.stack } : error,
                },
                metadata: {
                    executionTimeMs: Date.now() - startTime,
                    executor: 'typescript-fallback',
                    ...request.metadata,
                },
                executionTimeMs: Date.now() - startTime,
            };
        }
    }
    mapSecurityLevel(level) {
        switch (level) {
            case 'low':
            case 'medium':
            case 'high':
                return level;
            default:
                return 'medium';
        }
    }
    extractCapabilities(request) {
        // Extract capabilities from request context or permissions
        const capabilities = [];
        if (request.context?.permissions) {
            capabilities.push(...request.context.permissions.map(p => `${p.type}:${p.resource}`));
        }
        return capabilities;
    }
    async executeFilesystemOperation(request) {
        if (!this.rustExecutor) {
            throw new Error('Rust executor not initialized');
        }
        const operation = request.arguments?.operation || 'read';
        const path = request.arguments?.path || request.arguments?.filePath || '';
        const content = request.arguments?.content;
        const options = {
            securityLevel: this.mapSecurityLevel(request.context?.securityLevel),
            capabilities: this.extractCapabilities(request),
            workingDirectory: request.context?.workingDirectory || process.cwd(),
        };
        return await this.rustExecutor.executeFilesystem(operation, path, content, options);
    }
    async executeCommandOperation(request) {
        if (!this.rustExecutor) {
            throw new Error('Rust executor not initialized');
        }
        const command = request.arguments?.command || request.arguments?.cmd || '';
        const args = request.arguments?.args || request.arguments?.arguments || [];
        const options = {
            securityLevel: this.mapSecurityLevel(request.context?.securityLevel),
            capabilities: this.extractCapabilities(request),
            workingDirectory: request.context?.workingDirectory || process.cwd(),
            environment: request.context?.environment || {},
            timeoutMs: this.options.timeoutMs,
        };
        return await this.rustExecutor.executeCommand(command, args, options);
    }
    async executeGenericOperation(request) {
        if (!this.rustExecutor) {
            throw new Error('Rust executor not initialized');
        }
        const toolId = request.toolId;
        const argsStr = JSON.stringify(request.arguments || {});
        const options = {
            securityLevel: this.mapSecurityLevel(request.context?.securityLevel),
            capabilities: this.extractCapabilities(request),
            workingDirectory: request.context?.workingDirectory || process.cwd(),
            environment: request.context?.environment || {},
            timeoutMs: this.options.timeoutMs,
        };
        return await this.rustExecutor.execute(toolId, argsStr, options);
    }
    updateAverageExecutionTime(executionTime) {
        const totalTime = this.performanceStats.averageExecutionTime * this.performanceStats.successfulRequests;
        this.performanceStats.averageExecutionTime =
            (totalTime + executionTime) / (this.performanceStats.successfulRequests + 1);
    }
    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        return {
            ...this.performanceStats,
            rustExecutorAvailable: this.isAvailable(),
            supportedTools: this.rustExecutor?.getSupportedTools() || [],
        };
    }
    /**
     * Reset performance metrics
     */
    async resetPerformanceMetrics() {
        this.performanceStats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageExecutionTime: 0,
        };
        if (this.rustExecutor) {
            await this.rustExecutor.resetPerformanceMetrics();
        }
    }
}
