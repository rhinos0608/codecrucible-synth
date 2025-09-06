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
