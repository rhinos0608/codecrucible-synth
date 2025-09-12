export interface DeploymentRecord {
  id: string;
  version: string;
  timestamp: number;
  status: 'deployed' | 'failed' | 'rolled_back';
  metadata?: Record<string, unknown>;
}

export interface RollbackStepResult {
  step: string;
  success: boolean;
  message?: string;
}

export type RollbackExecutor = (version: string) => Promise<RollbackStepResult[]>;

/**
 * RollbackManager tracks deployments and coordinates safe rollback plans.
 * It does not execute system commands directly; callers provide an executor.
 */
export class RollbackManager {
  private history: DeploymentRecord[] = [];

  registerDeployment(version: string, status: DeploymentRecord['status'] = 'deployed', metadata?: Record<string, unknown>): DeploymentRecord {
    const rec: DeploymentRecord = {
      id: `${version}-${Date.now()}`,
      version,
      timestamp: Date.now(),
      status,
      metadata,
    };
    this.history.push(rec);
    return rec;
  }

  getHistory(limit = 20): DeploymentRecord[] {
    return this.history.slice(-limit).reverse();
  }

  canRollbackTo(version: string): boolean {
    // Allow rollback to any previously deployed version that isn't current
    const idx = this.history.findIndex(h => h.version === version && h.status === 'deployed');
    return idx !== -1 && this.getCurrentVersion() !== version;
  }

  getCurrentVersion(): string | undefined {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].status === 'deployed') return this.history[i].version;
    }
    return undefined;
  }

  /**
   * Plan steps for rollback (idempotent description).
   */
  planRollback(version: string): string[] {
    return [
      `Verify artifacts for ${version}`,
      `Drain traffic from current version ${this.getCurrentVersion() ?? 'unknown'}`,
      `Switch traffic to ${version}`,
      `Run smoke checks on ${version}`,
      `Decommission previous version`,
    ];
  }

  /**
   * Execute rollback using a provided executor (e.g., invokes CI/CD or MCP tools).
   */
  async rollbackTo(version: string, executor: RollbackExecutor): Promise<{ steps: RollbackStepResult[]; success: boolean }>{
    if (!this.canRollbackTo(version)) {
      return { steps: [], success: false };
    }
    const steps = await executor(version);
    const success = steps.every(s => s.success);
    if (success) {
      this.registerDeployment(version, 'deployed');
      // Mark any later deployments as rolled_back
      for (const rec of this.history) {
        if (rec.version !== version && rec.status === 'deployed') {
          rec.status = 'rolled_back';
        }
      }
    }
    return { steps, success };
  }
}
