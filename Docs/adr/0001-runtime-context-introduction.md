# ADR 0001: Introduction of RuntimeContext Abstraction

Date: 2025-09-02

## Status
Accepted (Incremental rollout in progress)

## Context
The codebase historically relied on global singletons (e.g., event bus, resource coordinator) and ad-hoc dependency wiring. This created:
- Hidden coupling / difficult test isolation
- Order-dependent initialization
- Increased cognitive load and architectural drift

The newly added `RuntimeContext` provides an explicit aggregation of cross-cutting runtime services (event bus, resource coordination, optional security + config managers) to pass through orchestration layers without expanding global state.

## Decision
Introduce a lightweight `RuntimeContext` interface and factory (`createRuntimeContext`) in `src/application/runtime/runtime-context.ts`.
- Non-breaking: existing consumers still receive direct dependencies.
- Orchestrators prefer `runtimeContext` when supplied.
- No removal of existing global setters yet (backward compatibility).

## Consequences
Positive:
- Clear injection boundary for future services (telemetry, tracing, feature flags)
- Simplifies migration away from mutable globals
- Eases unit testing (can supply mock coordinators / event bus)

Negative / Risks:
- Transitional duplication (dependencies appear both at top-level and inside `runtimeContext`)
- Potential misuse if both diverge; documentation required

## Migration Plan
1. Add context (DONE) and ADR (DONE)
2. Gradually refactor services to accept `RuntimeContext` instead of multiple discrete parameters
3. Deprecate `setGlobalEventBus` once all consumers adopt context injection
4. Introduce a DI container adapter mapping registrations to `RuntimeContext`
5. Remove legacy globals in a major version bump

## Alternatives Considered
- Full DI container upfront: rejected (higher initial complexity)
- Keeping globals: rejected (testability + hidden coupling issues)

## Metrics for Success
- Reduced test setup boilerplate for orchestrator-related tests
- Elimination of direct global event bus access in new modules
- Measurable decrease in circular dependency risk

## Follow-Up ADRs
- ADR 0002: Cycle Detection & Orchestration Graph Validation (planned)
- ADR 0003: Security Policy Engine Interface (planned)
