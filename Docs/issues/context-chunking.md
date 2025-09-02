# Context Chunking Enhancement

**Location**: `src/application/context/context-window-manager.ts`

## Summary

Implement dependency graph analysis to enable true semantic chunking. Currently,
the system falls back to priority-based chunking.

## Rationale

Semantic chunking improves relevance and reduces token usage by grouping related
files based on dependencies.

## Tasks

- Parse import/require statements to build dependency graph.
- Group files into context chunks using graph relationships.
- Add tests covering complex dependency scenarios.
