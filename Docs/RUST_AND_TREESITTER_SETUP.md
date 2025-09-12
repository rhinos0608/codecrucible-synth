Rust Execution + Tree‑sitter WASM Setup

Overview
- Rust executes all external commands and long‑running sessions via the N‑API bridge.
- TypeScript orchestrates requests and normalizes results; no direct spawn/exec for core paths.
- Tree‑sitter (WebAssembly) provides AST chunking for Go, Rust, Java, C#, and Ruby.

Rust Bridge Startup
- The bridge initializes at app startup (see src/index.ts). Failures are logged.
- Session streaming (file and command) uses src/infrastructure/streaming/rust-streaming-client.ts.
- Interactive input
  - TS exposes sendInput(sessionId, input) which calls the Rust bridge’s send_input if available.
  - Ensure the Rust executor implements send_input(sessionId, input) for full interactivity.

Migrating Tools to Rust
- Terminal MCP server, Git MCP server, Package manager MCP server, cross‑platform commands, and core execute_command are routed via Rust (toolId: command).
- E2B terminal now uses the RustProcessManager for interactive sessions.
- Legacy AdvancedProcessTool remains for backward compatibility but is superseded by RustProcessManager.

Tree‑sitter WASM Grammars
Location
- Place WASM grammars under vendor/ts-wasm/ with these filenames:
  - tree-sitter-go.wasm
  - tree-sitter-rust.wasm
  - tree-sitter-java.wasm
  - tree-sitter-c_sharp.wasm
  - tree-sitter-ruby.wasm

Automatic Fetch (postinstall)
- Set TS_WASM_BASE_URL to a base URL hosting the WASM files.
- On install: node scripts/fetch-tree-sitter-grammars.js downloads to vendor/ts-wasm/.

Local Build (optional)
- Place grammar sources under vendor/ts-grammars/<repo>/ (e.g., tree-sitter-go, tree-sitter-rust, etc.).
- Build with: npm run build:ts-grammars
  - Uses npx tree-sitter build-wasm inside each repo dir and copies to vendor/ts-wasm/.
- If tree-sitter CLI is not available, the build step is skipped.

Indexer Integration
- The repo indexer uses async chunking with tree-sitter where available.
- Missing grammars degrade gracefully to paragraph/window chunking.

Notes
- Docker/Podman/Firecracker backends can optionally route through Rust; some paths remain environment‑specific.
- For high‑trust environments, enable a feature flag to prefer Rust execution in those backends as well.

