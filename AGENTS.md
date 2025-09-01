# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript source organized by layers — `application/`, `domain/`, `adapters/`, `infrastructure/`, `utils/`, `voices/`, `mcp-tools/`. Entry: `src/index.ts`.
- `tests/`: `unit/`, `integration/`, `performance/`, `security/`, `e2e/` plus `__mocks__/` for heavy deps.
- `config/`: Runtime YAML (e.g., `unified-config.yaml`, `voices.yaml`).
- `scripts/`: Build/test helpers; `bin/`: CLI entry (compiled to `dist/bin`).
- `Docs/`, `migrations/`, `deployment/`, `dist/` (build output).

## Architecture Overview
- Layered: Domain (entities/interfaces/services), Application (use-cases/coordinators), Infrastructure/Adapters (I/O, logging), CLI/Server.
- Orchestration: `UnifiedOrchestrationService` coordinates Agent, Server, Security, and Performance systems via an event bus.
- Configuration: `UnifiedConfigurationManager` loads/merges YAML from `config/` and exposes runtime configuration.
- Logging: `LoggerAdapter` implements `ILogger`; use `createLogger('Context')` for scoped logs.

## Build, Test, and Development Commands
- `npm run dev`: Run from `src/` with tsx (hot dev).
- `npm run build`: Compile TypeScript to `dist/` and copy assets.
- `npm start`: Run compiled app (`node dist/index.js`).
- `npm run cli`: Build, then invoke CLI.
- `npm test`: Unit + integration. Focused: `npm run test:unit`, `npm run test:integration`, quick: `npm run test:fast`.
- `npm run lint` / `lint:fix`: ESLint check/fix. `npm run format` / `format:check`: Prettier.
- `npm run typecheck`: TypeScript no-emit validation.

## Coding Style & Naming Conventions
- Formatting: Prettier; Linting: ESLint (flat config) + `@typescript-eslint`.
- Rules: `no-explicit-any` (error in src, warn in tests), `prefer-const`, `no-var`, modern TS/ES best practices.
- Naming: files `kebab-case.ts`; classes `PascalCase`; interfaces prefixed `I` (e.g., `ILogger`); functions/vars `camelCase`.
- Modules: ESM (`"type": "module"`). In TS, keep `.js` extension in relative imports (compiled output expects it). Node >= 18.

## Testing Guidelines
- Framework: Jest + ts-jest (ESM). Tests named `*.test.ts` under `tests/<category>/`.
- Coverage (enforced): ~70% lines / 65% functions / 60% branches globally; higher for critical modules. Use `npm run test:all` for full run with coverage.
- Use `tests/__mocks__/` for heavy modules; prefer fast, isolated unit tests; add integration tests for cross-layer behavior.

## Quick References
- Entry: `src/index.ts`; CLI wrappers: `bin/crucible.js`, `bin/cc.js` (bin points to `dist/bin/crucible.js`).
- Orchestrator: `src/application/services/unified-orchestration-service.ts`.
- Config manager: `src/domain/services/unified-configuration-manager.ts`.
- Logging: `src/infrastructure/logging/logger-adapter.ts` (`createLogger`).
- Config: `config/unified-config.yaml`, `config/voices.yaml`.
- Tests/Coverage: `jest.config.unit.cjs`, `jest.config.integration.cjs`, `jest.config.cjs`, `tests/setup/unit.setup.ts`.
- Tooling: `eslint.config.js`, `tsconfig.json`, `scripts/copy-assets.js`.

## Commit & Pull Request Guidelines
- Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `docs: ...`, `test: ...`, `refactor: ...`, `chore: ...`.
- Before pushing: `npm run fix-code` (lint:fix + format + typecheck) and `npm test`.
- PRs: clear description (what/why), link issues (`#123`), note breaking changes, include test updates and sample CLI output if UX changes. All CI checks must pass.

## End-of-Session Checklist
- Always run: `npm run lint:fix && npm run format && npm run typecheck`.
- Run tests: `npm test` (or `npm run test:fast` while iterating).
- Ensure imports keep `.js` extensions in TS sources for ESM.

## Security & Configuration Tips
- No secrets in repo. Configure providers/models in `config/*.yaml`; see `Docs/ENVIRONMENT_SETUP_GUIDE.md`.
- Follow safe patterns in security-sensitive code; keep imports and validations consistent with existing services.
