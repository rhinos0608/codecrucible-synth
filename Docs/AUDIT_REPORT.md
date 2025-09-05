# Repository Audit Overview

## Repository Index

- `src/` – core TypeScript sources organized by domain, application, and
  infrastructure layers.
- `tests/` – unit and integration test suites.
- `config/` – runtime YAML configuration.
- `Docs/` – project documentation.

## Architectural Overview

The project follows a layered architecture:

- **Domain** – pure business logic and interfaces.
- **Application** – orchestration and coordination of domain operations.
- **Infrastructure/Adapters** – concrete I/O implementations.
- **CLI/Server** – entry points for user interaction.

Recent refactoring splits orchestration concerns:

- Workflow streaming and tool registry management live in dedicated modules
  under `src/application/services/orchestrator/`.
- CLI resilience event wiring is handled in
  `src/application/services/cli/resilience-manager.ts`.

## Tooling Issues

- Large orchestration classes (`ConcreteWorkflowOrchestrator`,
  `UnifiedCLICoordinator`) hinder readability and testing.
- Mixed concerns (streaming, registry, resilience) previously co-located in
  single files.

## Layered Audit Passes

- **Semantic** – Verified module responsibilities align with architectural
  layers.
- **Procedural** – Checked initialization sequences for dependency injection and
  event wiring.
- **Structural** – Ensured new modules use kebab-case filenames and ESM imports
  with `.js` extensions.
- **Behavioral** – Streaming fallback and resilience policies maintain previous
  runtime behavior.

## Refactoring Recommendations

- Continue decomposing remaining large methods into cohesive services.
- Introduce targeted unit tests for new modules to guard against regressions.
- Monitor coupling between CLI coordinator and orchestrator to maintain clear
  boundaries.
