/**
 * Unified metrics interface shared across layers (TS and Rust bridge).
 * Keep minimal and portable: counters, gauges, histograms, timers.
 */

export type MetricKind = 'counter' | 'gauge' | 'histogram' | 'timer';

export interface MetricTags {
  readonly [key: string]: string;
}

export interface IUnifiedMetrics {
  counter(name: string, value?: number, tags?: MetricTags): void;
  gauge(name: string, value: number, tags?: MetricTags): void;
  histogram(name: string, value: number, tags?: MetricTags): void;
  /** Start a timer; returns a function to stop and record duration in seconds. */
  startTimer(name: string, tags?: MetricTags): () => void;
}

