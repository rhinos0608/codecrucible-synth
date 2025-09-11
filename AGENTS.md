# Repository Guidelines

## Project Structure & Module Organization
- Source lives in `src/` by layers: `application/`, `domain/`, `adapters/`, `infrastructure/`, `utils/`, `voices/`, `mcp-tools/`. Entry: `src/index.ts`.
- Tests in `tests/`: `unit/`, `integration/`, `performance/`, `security/`, `e2e/` plus `__mocks__/` for heavy deps.
- Config in `config/` (e.g., `unified-config.yaml`, `voices.yaml`). Build output: `dist/`. CLI shims in `bin/` → compiled to `dist/bin/`.
- Docs, migrations, deployment assets: `Docs/`, `migrations/`, `deployment/`.

## Build, Test, and Development Commands
- `npm run dev`: Hot dev from `src/` (tsx).
- `npm run build`: Compile to `dist/` and copy assets.
- `npm start`: Run compiled app (`node dist/index.js`).
- `npm run cli`: Build, then invoke CLI (`bin/crucible.js`, alias `bin/cc.js`).
- `npm test`: Unit + integration. Focused: `npm run test:unit`, `npm run test:integration`, quick: `npm run test:fast`.
- Lint/format/type: `npm run lint`, `lint:fix`, `format`, `format:check`, `typecheck`.

## Coding Style & Naming Conventions
- Language: TypeScript, ESM (`"type": "module"`). Keep `.js` extension in TS relative imports.
- Node ≥ 18. Formatting via Prettier; lint via ESLint (flat) + `@typescript-eslint`.
- Rules: `no-explicit-any` (error in `src/`, warn in tests), `prefer-const`, `no-var`, modern TS/ES best practices.
- Naming: files `kebab-case.ts`; classes `PascalCase`; interfaces prefixed `I` (e.g., `ILogger`); functions/vars `camelCase`.

## Testing Guidelines
- Framework: Jest + ts-jest (ESM). Tests named `*.test.ts` under `tests/<category>/`.
- Coverage targets: ~70% lines / 65% functions / 60% branches globally.
- Key configs: `jest.config.unit.cjs`, `jest.config.integration.cjs`, `jest.config.cjs`; setup: `tests/setup/unit.setup.ts`.

## Architecture Overview
- Layered architecture (Domain, Application, Infrastructure/Adapters, CLI/Server).
- Orchestrator: `src/application/services/unified-orchestration-service.ts`.
- Config manager: `src/domain/services/unified-configuration-manager.ts`.
- Logging: `src/infrastructure/logging/logger-adapter.ts` (`createLogger('Context')`).

## Commit & Pull Request Guidelines
- Conventional Commits (e.g., `feat(scope): ...`, `fix(scope): ...`, `docs: ...`, `test: ...`, `refactor: ...`, `chore: ...`).
- Before pushing: `npm run fix-code` (lint:fix + format + typecheck) and `npm test`.
- PRs: clear description (what/why), link issues (`#123`), note breaking changes, include updated tests and sample CLI output when UX changes. All CI checks must pass.

## Security & Configuration Tips
- No secrets in repo. Configure providers/models in `config/*.yaml`. See `Docs/ENVIRONMENT_SETUP_GUIDE.md`.
- Validate inputs and follow existing security patterns; keep imports/validations consistent across services.

## End-of-Session Checklist
- Run: `npm run lint:fix && npm run format && npm run typecheck`.
- Execute tests: `npm test` (or `npm run test:fast` while iterating).
