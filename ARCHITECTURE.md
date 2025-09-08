# Architecture Overview

## Layers

- Domain: pure business logic, no infra dependencies.
- Application (Use-cases): orchestrates domain operations, transforms input/out.
- Adapters: translate between application and infrastructure (DB, HTTP clients).
- Infrastructure: concrete implementations (DB clients, external APIs, message
  brokers).

## Import rules

- Domain <- no imports from other layers
- Application <- may import Domain
- Adapters <- may import Application & Domain
- Infrastructure <- may import Adapters
- No cyclical imports. Prefer dependency injection to pass infra clients into
  adapters.

## Quick checklist

- Files that do DB/HTTP + business logic in same file should be split.
- Avoid module-level mutable state; use explicit state objects.

## Module Index

- `src/application/services/concrete-workflow-orchestrator.ts` – coordinates
  workflow execution. Streaming handled by
  `src/application/services/orchestrator/streaming-manager.ts` and tool routing
  by `src/application/services/orchestrator/tool-execution-router.ts`. Provider
  capabilities are tracked via `src/application/services/provider-capability-registry.ts`.
- `src/application/services/unified-cli-coordinator.ts` – orchestrates CLI
  operations with resilience events handled in
  `src/application/services/cli/resilience-manager.ts`.
- MCP server initialization centralized in
  `src/mcp-servers/mcp-bootstrap.ts` to avoid duplication.

## Bootstrapping & CLI (Updated)

- Entrypoint is intentionally minimal: `src/index.ts` only wires the CLI program.
- Bootstrap lives in `src/application/bootstrap/initialize.ts`.
- CLI program/commands configured in `src/application/cli/program.ts`.

## Event Bus & Metrics (Updated)

- Event bus creation centralized in `src/infrastructure/messaging/event-bus-factory.ts`.
- Performance profiling integrates with existing MetricsCollector.
- Plugin discovery paths resolved via `src/infrastructure/plugins/plugin-path-resolver.ts`.

## Rust Execution Bridge & Health (Updated)

- Native bridge management is encapsulated by `BridgeAdapter` wrapping `RustBridgeManager`.
- `RustExecutionBackend` prefers the bridge (with seamless TS fallback) and reads bridge metrics when available.
- Bridge health is exported as metrics via `src/infrastructure/observability/bridge-health-reporter.ts`:
  - `crucible_bridge_health` (gauge 1/0.5/0)
  - `crucible_bridge_response_time_ms` (gauge)
  - `crucible_bridge_errors_total` (counter)
