# CodeCrucible Synth Overview

This file is generated at startup to summarize the architecture.

## Layers
- Domain: Core interfaces and types under `src/domain`.
- Application: Orchestrators, services, CLI under `src/application`.
- Infrastructure: Providers, tools, logging, MCP, Rust backend under `src/infrastructure`.
- Providers: Local and hybrid model providers under `src/providers`.

## Orchestration
- Main orchestrator: ConcreteWorkflowOrchestrator.
- Sub-agent: SubAgentOrchestrator (own context window) via `agent_spawn`.
- Request execution: RequestExecutionManager with Rust backend.

## Tools
- Built-in suite: bash_run, file_read, file_write, glob_search, grep_search, agent_spawn.
- Tool calls prefer MCP (JSON-RPC 2.0) via MCPServerManager.
- Domain-aware selection narrows tools for accuracy/performance.

## Rust Execution
- High-performance ops via `RustExecutionBackend` (N-API).
- Integrated through RequestExecutionManager and FilesystemTools.

For details, see ARCHITECTURE.md and docs/TOOL_SUITE.md.
