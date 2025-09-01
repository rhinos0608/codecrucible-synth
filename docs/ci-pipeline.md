# CI Pipeline Documentation

## Overview

This CI pipeline implements a strict order of operations to ensure code quality:

**Pipeline Order:** `lint` → `test` → `coverage` → `build`

## Pipeline Steps

### 1. Lint (Fail Fast)
- Runs ESLint with `--max-warnings=0` to ensure zero warnings
- Performs TypeScript type checking
- **Fails fast** - stops pipeline immediately if linting issues exist

### 2. Test
- Runs unit tests with coverage collection
- Only executes if lint step passes
- Uses Jest with `--passWithNoTests` to handle missing test scenarios

### 3. Coverage Check
- Validates coverage meets minimum threshold (configurable via `COVERAGE_THRESHOLD` env var)
- Default threshold: 80% for lines and statements
- **Fails if coverage below threshold** - prevents deployment of under-tested code
- Uploads coverage reports to Codecov

### 4. Build
- Compiles TypeScript code
- Copies assets
- Only executes if coverage check passes
- Uploads build artifacts

## Configuration

### Environment Variables
- `COVERAGE_THRESHOLD`: Minimum coverage percentage (default: 80)
- `NODE_VERSION`: Node.js version to use (default: 20)

### Coverage Thresholds
The pipeline enforces coverage thresholds via a custom script that:
- Reads Jest's `coverage-summary.json`
- Validates lines and statements coverage
- Fails CI if below threshold
- Provides clear error messages

## Usage

### Triggering the Pipeline
- **Pull Requests**: Automatically triggered on PRs to `main` or `develop`
- **Push Events**: Triggered on pushes to `main` or `develop` branches

### Local Testing
```bash
# Test lint step
npm run lint

# Test coverage check
npm run coverage:check

# Test TypeScript compilation
npx tsc --noEmit
```

### Configuring Coverage Threshold
Set in `.github/workflows/ci.yml`:
```yaml
env:
  COVERAGE_THRESHOLD: '80'  # Adjust as needed
```

## Quality Gates

The pipeline implements multiple quality gates:

1. **Linting Gate**: Zero warnings allowed
2. **Type Safety Gate**: All TypeScript must compile
3. **Coverage Gate**: Minimum 80% coverage required
4. **Build Gate**: Successful compilation required

Each gate must pass before proceeding to the next step, ensuring high code quality standards.