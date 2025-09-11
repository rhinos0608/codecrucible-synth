Tool Suite Architecture (Built-in)

Overview
- The CLI exposes a compact, first-class tool suite designed for coding workflows:
  - bash_run: Execute shell commands with explicit consent gating
  - file_read: Read file contents within the workspace
  - file_write: Write content to files within the workspace
  - glob_search: Resolve files matching glob patterns
  - grep_search: Search for patterns within files
  - agent_spawn: Spawn an internal sub-agent (placeholder; non-destructive)

Security and Consent
- bash_run is disabled by default. Enable at runtime by either:
  - Passing consent=true in the tool arguments, or
  - Setting environment variable ALLOW_SHELL_TOOL=true
- Paths are constrained to the current workspace root. Attempts to escape the workspace are rejected.
- Dangerous commands (e.g., rm, rmdir, del, mkfs, reboot, shutdown) are blocked.

Integration
- Tools are registered via ToolIntegration and exposed to models as OpenAI-style functions.
- Domain-aware selection prioritizes the new core suite for coding tasks while retaining compatibility with legacy tools.

Function Signatures (LLM-facing)
- bash_run
  - input: { command: string; args?: string[]; cwd?: string; timeoutMs?: number; consent?: boolean }
- file_read
  - input: { path: string; encoding?: string }
- file_write
  - input: { path: string; content: string; encoding?: string }
- glob_search
  - input: { patterns: string[]; cwd?: string; ignore?: string[]; maxResults?: number }
- grep_search
  - input: { pattern: string; files?: string[]; glob?: string[]; literal?: boolean; ignore?: string[]; maxResults?: number }
- agent_spawn
  - input: { goal: string; context?: object }

Notes
- agent_spawn is a non-destructive placeholder. It returns a structured success with the provided goal.
- For high-performance file operations, the legacy FilesystemTools remain available alongside the new suite.

