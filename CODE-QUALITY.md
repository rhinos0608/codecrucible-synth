# Code Quality Standards & Tools

## Overview

CodeCrucible Synth uses a modern, pragmatic approach to code quality with ESLint, Prettier, and Jest configured for gradual improvement without blocking development velocity.

## 🔧 Tool Configuration

### ESLint (Flat Config)

**Configuration**: `eslint.config.js` - Modern ESLint flat config
**Philosophy**: Start with warnings, escalate to errors gradually

#### Key Features
- **CLI-Optimized Rules**: `no-console` disabled for CLI application
- **Test-Friendly**: Relaxed rules for test files
- **TypeScript-First**: Full TypeScript support with type-aware rules
- **Security-Focused**: Strict security-related rules (eval, injection)

#### Rule Strategy
```javascript
// Production code: Warnings first, then escalate
'@typescript-eslint/no-explicit-any': 'warn'

// Security: Always error
'no-eval': 'error'

// CLI-specific: Relaxed for console usage
'no-console': 'off'

// Tests: Very permissive for mocking and setup
'@typescript-eslint/no-explicit-any': 'off' // in test files
```

### Prettier

**Configuration**: `.prettierrc.json` - Comprehensive formatting
**Philosophy**: Consistent, readable, minimally opinionated

#### Settings
- **Print Width**: 100 characters (balance readability vs line length)
- **Quotes**: Single quotes (consistent with most TypeScript codebases)
- **Semicolons**: Always (explicit is better than implicit)
- **Trailing Commas**: ES5 style (maximum compatibility)

#### File-Specific Overrides
- **TypeScript**: Full formatting
- **JSON**: 80-character lines (denser data)
- **Markdown**: 80-character with prose wrapping
- **YAML**: 2-space indentation

### Jest Testing

**Configurations**: Multiple Jest configs for different test types
- `jest.config.cjs` - Comprehensive testing
- `jest.config.unit.cjs` - Fast unit tests only
- `jest.config.integration.cjs` - Integration tests

#### Coverage Strategy
```yaml
Global Targets: (Realistic & Achievable)
  lines: 60%
  functions: 55% 
  branches: 50%
  statements: 60%

Security Modules: (Higher Standards)
  lines: 75%
  functions: 70%
  branches: 65%
```

## 🚀 Available Scripts

### Linting

```bash
# Lint all files with flat config
npm run lint

# Lint only source code
npm run lint:src

# Lint only test files  
npm run lint:tests

# Auto-fix all linting issues
npm run lint:fix

# Auto-fix only source code
npm run lint:fix:src
```

### Formatting

```bash
# Format all files
npm run format

# Check formatting without changing files
npm run format:check

# Format only source code
npm run format:src
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Open coverage report in browser
npm run test:coverage:open

# Fast unit tests only
npm run test:fast

# Watch mode for development
npm run test:unit:watch

# CI-optimized testing
npm run test:ci
```

### Integrated Workflows

```bash
# Format + lint + typecheck (recommended workflow)
npm run fix-code

# Check code quality (all checks, no fixes)
npm run code-quality

# Pre-commit checks (format + lint only)
npm run pre-commit

# Full development check (includes smoke tests)
npm run dev-check
```

## 📁 File Structure & Ignore Patterns

### Linting Scope
**Included**:
- `src/**/*.ts` - All source TypeScript
- `tests/**/*.ts` - All test files
- Configuration files

**Ignored**:
- `dist/` - Build output
- `node_modules/` - Dependencies
- `coverage/` - Test coverage reports
- `build/` - Packaging output
- `target/` - Rust build artifacts

### Prettier Scope
**Included**:
- `**/*.{ts,js,json}` - TypeScript, JavaScript, JSON
- `**/*.{md,yml,yaml}` - Documentation and config
- Configuration files

**Ignored**: Comprehensive ignore list including:
- Build outputs (`dist/`, `build/`, `target/`)
- Dependencies (`node_modules/`)
- Generated files (`*.d.ts`, `*.min.js`)
- Binary files (`*.node`, `*.dll`, `*.so`)
- IDE files (`.vscode/`, `.idea/`)
- Archives and media files

## 🔍 Integration with Development Workflow

### Pre-Commit Workflow
1. **Format** code with Prettier
2. **Lint** and auto-fix with ESLint
3. **Type check** with TypeScript
4. **Test** critical paths with smoke tests

### CI/CD Integration
Scripts are designed to work in CI environments:
- `npm run test:ci` - Optimized for CI with proper timeouts
- `npm run code-quality` - Non-destructive quality checks
- Coverage reporting via lcov format

### IDE Integration

#### VS Code (Recommended)
```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

#### Extensions
- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- Jest Test Explorer (`kavod-io.vscode-jest-test-adapter`)

## 📈 Quality Metrics & Monitoring

### Coverage Tracking
- **HTML Reports**: `coverage/lcov-report/index.html`
- **LCOV Data**: `coverage/lcov.info` (for CI integration)
- **Console Summary**: Always visible during test runs

### ESLint Error Tracking
Monitor linting issues over time:
```bash
# Get current linting status
npm run lint > lint-report.txt

# Track warnings vs errors
npm run lint 2>&1 | grep -c "warning"
npm run lint 2>&1 | grep -c "error"
```

### Performance Monitoring
```bash
# Track test performance
npm run test:perf

# Monitor build times
time npm run build
```

## 🎯 Quality Improvement Strategy

### Phase 1: Stabilize (Current)
- ✅ Remove linting rule conflicts
- ✅ Make all rules warnings (no build failures)
- ✅ Achieve basic formatting consistency
- ✅ Establish baseline test coverage

### Phase 2: Gradual Escalation (Next 2-4 weeks)
- [ ] Convert high-impact warnings to errors
- [ ] Increase coverage thresholds by 5%
- [ ] Add more TypeScript strict checks
- [ ] Implement pre-commit hooks

### Phase 3: Strict Standards (Future)
- [ ] Enable all TypeScript strict mode checks
- [ ] Achieve 80%+ coverage on critical paths
- [ ] Zero-tolerance for security-related violations
- [ ] Full type safety without `any`

## 🛠️ Troubleshooting

### Common Issues

#### "ESLint configuration not found"
- Ensure `eslint.config.js` exists
- Check that legacy `.eslintrc.*` files are removed
- Verify ESLint 8+ is installed

#### "Prettier conflicts with ESLint"
- Run `npm run format` before `npm run lint:fix`
- Check `.prettierignore` includes generated files
- Ensure both tools use same line ending settings

#### "Test coverage too low"
- Review `jest.config.cjs` thresholds
- Use `npm run test:coverage:open` to see uncovered areas
- Focus on testing critical business logic first

#### "Linting takes too long"
- Use `npm run lint:src` for source-only linting
- Check ESLint cache is enabled (automatic in modern versions)
- Consider using `--max-warnings` flag in development

### Performance Optimization

```bash
# Clear caches if linting becomes slow
rm -rf node_modules/.cache
npm run build

# Parallel test execution
npm run test:fast

# Skip heavy integration tests in development
npm run test:unit
```

## 📚 References

### External Documentation
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files-new)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)
- [Jest Configuration](https://jestjs.io/docs/configuration)
- [TypeScript ESLint](https://typescript-eslint.io/docs/)

### Internal Documentation
- `CLAUDE.md` - Development guidelines
- `CI-CD.md` - Continuous integration setup
- `BUILD.md` - Build and packaging instructions

---

**Maintained by**: CodeCrucible Team  
**Last Updated**: September 2025  
**Version**: v4.2.4+