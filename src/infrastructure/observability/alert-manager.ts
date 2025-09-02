import { createLogger } from '../logger.js';
import { ILogger } from '../../domain/interfaces/logger.js';

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

export interface AlertAction {
  type: 'log' | 'email' | 'webhook' | 'slack';
  configuration: Record<string, any>;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'silenced';
  triggeredAt: Date;
  resolvedAt?: Date;
  message: string;
  details: Record<string, any>;
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
  private active: Map<string, Alert> = new Map();
  private history: Alert[] = [];
  private logger: ILogger = createLogger('AlertManager');

  constructor(private config: AlertConfig) {}

  async initialize(): Promise<void> {
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
      const shouldTrigger = Math.random() < 0.01; // placeholder
      if (shouldTrigger && !this.active.has(rule.id)) {
        this.trigger(rule);
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

  private trigger(rule: AlertRule): void {
    const alert: Alert = {
      id: Math.random().toString(36).slice(2),
      ruleId: rule.id,
      severity: rule.severity,
      status: 'active',
      triggeredAt: new Date(),
      message: `Alert triggered: ${rule.name}`,
      details: {},
    };
    this.active.set(rule.id, alert);
    this.history.push(alert);
    for (const action of rule.actions) {
      if (!action.enabled) continue;
      this.logger.warn(`Executing alert action ${action.type} for ${rule.name}`);
    }
  }
}
