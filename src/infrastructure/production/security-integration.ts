export type PolicyDecision = 'allow' | 'deny' | 'audit';

export interface SecurityPolicy {
  id: string;
  description: string;
  match: (input: Record<string, unknown>) => boolean;
  decision: PolicyDecision | ((input: Record<string, unknown>) => PolicyDecision);
}

export class SecurityIntegration {
  private policies: SecurityPolicy[] = [];

  registerPolicy(policy: SecurityPolicy): void {
    this.policies.push(policy);
  }

  evaluate(input: Record<string, unknown>): PolicyDecision {
    for (const p of this.policies) {
      if (p.match(input)) {
        return typeof p.decision === 'function' ? p.decision(input) : p.decision;
      }
    }
    return 'allow';
  }

  async enforce(input: Record<string, unknown>, onAudit?: (p: SecurityPolicy, input: Record<string, unknown>) => Promise<void> | void): Promise<PolicyDecision> {
    for (const policy of this.policies) {
      if (!policy.match(input)) continue;
      const decision = typeof policy.decision === 'function' ? policy.decision(input) : policy.decision;
      if (decision === 'deny') return 'deny';
      if (decision === 'audit' && onAudit) await onAudit(policy, input);
    }
    return 'allow';
  }
}
