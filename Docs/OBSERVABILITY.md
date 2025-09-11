# Observability (Metrics, Health, Alerts)

This repo ships a lightweight observability stack wired around `MetricsCollector`, `HealthMonitor`, and `AlertManager`, orchestrated by `ObservabilityCoordinator`.

## Key Components
- `src/infrastructure/observability/observability-coordinator.ts`: central entry; exposes `getMetricsCollector()` and registers a global instance for integrations.
- `src/infrastructure/observability/bridge-health-reporter.ts`: emits periodic health metrics for the Rust bridge.

## Bridge Health Metrics
The Rust execution bridge is measured via the following metrics:
- `crucible_bridge_health` (gauge): 1=healthy, 0.5=degraded, 0=failed
- `crucible_bridge_response_time_ms` (gauge): latest health check latency
- `crucible_bridge_errors_total` (counter): cumulative errors observed

These metrics are emitted every 30s by default (configurable in the reporter options).

## How It’s Wired
- `ServiceFactory.ensureRustBackend()` constructs a `BridgeAdapter`, initializes it, and starts the bridge health reporter.
- If an `ObservabilityCoordinator` is active, the reporter uses the coordinator’s `MetricsCollector`; otherwise a local collector is used in dev.

## Consuming Metrics
- Programmatically: use `ObservabilityCoordinator.getMetricsSummary()`.
- Export: `MetricsCollector` supports OTLP/Prometheus/StatsD/file (see `metrics-collector.ts`).

