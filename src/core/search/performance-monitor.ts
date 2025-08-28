/**
 * Search Performance Monitor
 * Monitors search system performance and optimization
 */

import { logger } from '../logger.js';
import { EventEmitter } from 'events';

export interface SearchMetrics {
  queryCount: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  indexSize: number;
  lastOptimization: number;
}

export interface SearchQuery {
  query: string;
  timestamp: number;
  responseTime: number;
  resultCount: number;
  cacheHit: boolean;
  success: boolean;
}

export class SearchPerformanceMonitor extends EventEmitter {
  private metrics: SearchMetrics;
  private queryHistory: SearchQuery[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.metrics = {
      queryCount: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      indexSize: 0,
      lastOptimization: 0
    };
  }

  recordQuery(query: SearchQuery): void {
    this.queryHistory.push(query);
    this.metrics.queryCount++;
    
    // Keep only last 1000 queries
    if (this.queryHistory.length > 1000) {
      this.queryHistory.shift();
    }
    
    this.updateMetrics();
  }

  getMetrics(): SearchMetrics {
    return { ...this.metrics };
  }

  getRecentQueries(count: number = 10): SearchQuery[] {
    return this.queryHistory.slice(-count);
  }

  private updateMetrics(): void {
    if (this.queryHistory.length === 0) return;

    const recentQueries = this.queryHistory.slice(-100); // Last 100 queries
    
    this.metrics.averageResponseTime = recentQueries.reduce((sum, q) => sum + q.responseTime, 0) / recentQueries.length;
    this.metrics.cacheHitRate = (recentQueries.filter(q => q.cacheHit).length / recentQueries.length) * 100;
    this.metrics.errorRate = (recentQueries.filter(q => !q.success).length / recentQueries.length) * 100;
    
    this.emit('metricsUpdated', this.metrics);
  }
}

export const searchPerformanceMonitor = new SearchPerformanceMonitor();