# CLI Worker Pool

**Location**: `src/application/cli/cli-commands.ts`

## Summary

Add a worker pool to handle analysis tasks concurrently without blocking the
CLI.

## Rationale

A worker pool prevents the main thread from blocking during heavy analysis and
improves responsiveness for large projects.

## Tasks

- Design worker pool interface and task queue.
- Implement worker threads for analysis execution.
- Update CLI commands to dispatch tasks to the pool.
- Provide tests simulating concurrent analysis jobs.
