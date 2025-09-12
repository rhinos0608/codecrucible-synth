import { ILogger, createConsoleLogger } from '../../domain/interfaces/logger.js';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  threshold: AlertThreshold;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number;
  actions: AlertAction[];
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'change';
  timeWindow: number;
  aggregation: 'avg' | 'sum' | 'max' | 'min' | 'count';
}

export interface AlertThreshold {
  warning: number;
  critical: number;
  unit: string;
}

type AlertActionType = 'log' | 'email' | 'webhook' | 'slack';

interface LogActionConfig {
  level?: 'info' | 'warn' | 'error';
  messageTemplate?: string;
}

interface EmailActionConfig {
  to: string[];
  subject: string;
  templateId?: string;
  cc?: string[];
  bcc?: string[];
}

interface WebhookActionConfig {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  timeoutMs?: number;
}

interface SlackActionConfig {
  channel: string;
  username?: string;
  iconEmoji?: string;
}

interface AlertActionBase<TType extends AlertActionType, TConfig> {
  type: TType;
  configuration: TConfig;
  enabled: boolean;
}

export type AlertAction =
  | AlertActionBase<'log', LogActionConfig>
  | AlertActionBase<'email', EmailActionConfig>
  | AlertActionBase<'webhook', WebhookActionConfig>
  | AlertActionBase<'slack', SlackActionConfig>;

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'silenced';
  triggeredAt: Date;
  resolvedAt?: Date;
  message: string;
  details: Record<string, unknown>;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface AlertStats {
  totalRules: number;
  activeAlerts: number;
  alertsLast24h: number;
  criticalAlerts: number;
  resolvedAlertsLast24h: number;
}

export interface AlertConfig {
  rules: AlertRule[];
  defaultCooldown: number;
  enabled: boolean;
}

export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private readonly active: Map<string, Alert> = new Map();
  private history: Alert[] = [];
  private logger: ILogger = createConsoleLogger('AlertManager');
  private metricProvider?: (metric: string, aggregation: AlertCondition['aggregation'], windowMs: number) => number | Promise<number>;

  constructor(private config: AlertConfig) {}

  public initialize(): void {
    for (const rule of this.config.rules || []) {
      this.addRule(rule);
    }
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  evaluateRules(): void {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      try {
        const metricValue = this.getMetricValue(rule.condition);
        const { warning, critical } = rule.threshold;
        const shouldTrigger =
          rule.condition.operator === 'gt'
            ? metricValue > (rule.severity === 'critical' ? critical : warning)
            : rule.condition.operator === 'gte'
              ? metricValue >= (rule.severity === 'critical' ? critical : warning)
              : rule.condition.operator === 'lt'
                ? metricValue < (rule.severity === 'critical' ? critical : warning)
                : rule.condition.operator === 'lte'
                  ? metricValue <= (rule.severity === 'critical' ? critical : warning)
                  : rule.condition.operator === 'eq'
                    ? metricValue === (rule.severity === 'critical' ? critical : warning)
                    : false;
        if (shouldTrigger && !this.active.has(rule.id)) {
          this.trigger(rule, metricValue);
        }
      } catch (e) {
        this.logger.warn(`Alert evaluation error for rule ${rule.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.active.values());
  }

  acknowledgeAlert(id: string, by: string): void {
    const alert = this.active.get(id);
    if (alert) {
      alert.acknowledgedBy = by;
      alert.acknowledgedAt = new Date();
    }
  }

  exportData(timeRange?: { start: Date; end: Date }): Alert[] {
    if (!timeRange) return [...this.history];
    return this.history.filter(
      a => a.triggeredAt >= timeRange.start && a.triggeredAt <= timeRange.end
    );
  }

  getStats(): AlertStats {
    const recent = this.history.filter(
      a => a.triggeredAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    return {
      totalRules: this.rules.size,
      activeAlerts: this.active.size,
      alertsLast24h: recent.length,
      criticalAlerts: Array.from(this.active.values()).filter(a => a.severity === 'critical')
        .length,
      resolvedAlertsLast24h: recent.filter(a => a.status === 'resolved').length,
    };
  }

  async shutdown(): Promise<void> {}

  public setMetricProvider(provider: (metric: string, aggregation: AlertCondition['aggregation'], windowMs: number) => number | Promise<number>): void {
    this.metricProvider = provider;
  }

  private getMetricValue(condition: AlertCondition): number {
    const { metric, aggregation, timeWindow } = condition;
    if (this.metricProvider) {
      const v = this.metricProvider(metric, aggregation, timeWindow);
      if (typeof (v as any)?.then === 'function') {
        // Note: evaluateRules is sync; for now, use best-effort by ignoring async resolution.
        // In a future iteration, we can make evaluation async.
        return NaN;
      }
      return v as number;
    }
    // Default provider: use process/os metrics
    if (metric === 'cpu.load1') {
      try { return require('os').loadavg?.()[0] ?? 0; } catch { return 0; }
    }
    if (metric === 'memory.heapUsedMB') {
      try { return Math.round((process.memoryUsage?.().heapUsed ?? 0) / (1024 * 1024)); } catch { return 0; }
    }
    if (metric === 'alerts.active') {
      return this.active.size;
    }
    return 0;
  }

  private trigger(rule: AlertRule, metricValue?: number): void {
    const alert: Alert = {
      id: Math.random().toString(36).slice(2),
      ruleId: rule.id,
      severity: rule.severity,
      status: 'active',
      triggeredAt: new Date(),
      message: `Alert triggered: ${rule.name}`,
      details: metricValue !== undefined ? { metric: rule.condition.metric, value: metricValue } : {},
    };
    this.active.set(rule.id, alert);
    this.history.push(alert);
    for (const action of rule.actions) {
      if (!action.enabled) continue;
      this.logger.warn(`Executing alert action ${action.type} for ${rule.name}`);
    }
  }
}
