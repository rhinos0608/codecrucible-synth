# CI/CD Pipeline Documentation

## Overview

CodeCrucible Synth uses a comprehensive CI/CD pipeline with 9 specialized GitHub Actions workflows to ensure code quality, security, and reliable deployments.

## Workflow Matrix

| Workflow | Trigger | Purpose | Status |
|----------|---------|---------|--------|
| `ci.yml` | Push/PR to main/develop | Core CI pipeline with build/test/lint | ✅ Active |
| `test-pipeline.yml` | Manual dispatch | Comprehensive integration testing | ✅ Active |
| `release.yml` | Version tags (v*.*.*) | Automated release with multi-platform builds | ✅ Active |
| `security.yml` | Push/PR + Weekly cron | Security scanning (CodeQL, Snyk, Semgrep) | ✅ Active |
| `ci-cd-enterprise.yml` | Push/PR to main/develop | Enterprise deployment pipeline | ✅ Active |
| `performance-monitor.yml` | Scheduled | Performance benchmarking | ✅ Active |
| `codeql.yml` | Push/PR | Static code analysis | ✅ Active |
| `codacy.yml` | Push/PR | Code quality analysis | ✅ Active |
| `build-desktop.yml` | Manual/Release | Desktop application packaging | ✅ Active |

## Environment Requirements

### Node.js Version
- **Standardized**: Node.js 20.x across all workflows
- **Package.json**: Requires Node.js >=18.0.0
- **Rationale**: Node 20 provides optimal performance and latest features

### Rust Toolchain
- **Version**: Stable Rust toolchain
- **Components**: rustfmt, clippy (for release builds)
- **Native Module**: Required for `rust-executor` addon
- **Cross-platform**: Builds for Windows, macOS, Linux

## Workflow Details

### 1. Core CI Pipeline (`ci.yml`)

**Triggers**: Push/PR to main/develop branches

**Jobs**:
1. **Lint & Type Check**: ESLint + TypeScript validation
2. **Test**: Unit + integration tests with coverage upload
3. **Build**: Rust native module + TypeScript compilation
4. **Security Audit**: npm audit + Snyk scanning

**Key Features**:
- Rust dependency caching for faster builds
- Coverage reporting to Codecov
- Artifact upload for downstream workflows
- Comprehensive security scanning

### 2. Test Pipeline (`test-pipeline.yml`)

**Triggers**: Manual dispatch with scope selection (quick/full)

**Comprehensive Testing**:
- TypeScript compilation verification
- CLI functionality testing
- Configuration validation
- Package structure verification
- Application mode testing
- Workflow YAML validation

**Outputs**: Detailed test report with system information

### 3. Release Pipeline (`release.yml`)

**Triggers**: Git tags matching `v*.*.*` pattern

**Multi-Platform Build Matrix**:
- **Linux**: Ubuntu latest
- **Windows**: Windows latest with code signing
- **macOS**: macOS latest

**Release Process**:
1. Version validation (semantic versioning)
2. Pre-release testing
3. Cross-platform package building
4. NPM publishing
5. GitHub release creation with assets
6. Automated release notes generation

### 4. Security Pipeline (`security.yml`)

**Triggers**: Push/PR + Weekly automated scans

**Security Tools**:
- **NPM Audit**: Dependency vulnerability scanning
- **Snyk**: Advanced security analysis
- **CodeQL**: Static application security testing (SAST)
- **Semgrep**: Pattern-based security scanning
- **TruffleHog**: Secret detection
- **License Check**: License compliance validation

### 5. Enterprise CI/CD (`ci-cd-enterprise.yml`)

**Triggers**: Push/PR to main/develop

**Enterprise Features**:
- **Coverage Thresholds**: 60% lines, 55% functions, 50% branches
- **Multi-stage Deployment**: Staging → Production
- **Docker Integration**: Container builds with vulnerability scanning
- **Performance Validation**: Load time benchmarking
- **Blue-Green Deployment**: Zero-downtime production updates

## Test Configuration

### Jest Setup

**Configurations**:
- `jest.config.cjs`: Main configuration with ESM support
- `jest.config.unit.cjs`: Unit tests only
- `jest.config.integration.cjs`: Integration tests
- `jest.config.comprehensive.cjs`: Full test suite

**Coverage Targets**:
- **Global**: 80% lines, 75% functions, 70% branches
- **Security Modules**: 90% lines, 85% functions, 80% branches
- **Core Components**: 85% lines, 80% functions, 75% branches

**Test Structure**:
```
tests/
├── unit/           # Isolated unit tests
├── integration/    # System integration tests
├── e2e/           # End-to-end tests
├── __mocks__/     # Test mocks and fixtures
└── setup/         # Test environment setup
```

## Package Scripts

### Build Scripts
```bash
npm run build              # Full build (Rust + TypeScript)
npm run build:rust         # Rust native module only
npm run build:all          # Complete build pipeline
```

### Test Scripts
```bash
npm test                   # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:smoke         # Smoke tests
```

### Package Scripts
```bash
npm run package:all        # Multi-platform packaging
npm run package:win        # Windows package
npm run package:mac        # macOS package
npm run package:linux      # Linux package
npm run desktop:package    # Electron desktop build
```

### Development Scripts
```bash
npm run dev                # Development mode
npm run lint               # ESLint checking
npm run typecheck          # TypeScript validation
npm run fix-code           # Auto-fix linting issues
```

## Environment Variables & Secrets

### Required Secrets
- `GITHUB_TOKEN`: GitHub API access (auto-provided)
- `NPM_TOKEN`: NPM publishing
- `SNYK_TOKEN`: Snyk security scanning
- `WIN_CSC_LINK`: Windows code signing certificate
- `WIN_CSC_KEY_PASSWORD`: Windows signing key password

### Environment Configuration
- `NODE_ENV`: Set to `test` in CI environments
- `CI`: Set to `true` for CI-specific behavior
- Coverage reporting enabled automatically

## Performance Optimizations

### Caching Strategy
- **Node Modules**: NPM cache for dependency installation
- **Rust Dependencies**: Cargo cache for native module compilation
- **Build Artifacts**: Intermediate build caching

### Parallel Execution
- **Jest Workers**: 50% CPU utilization
- **Matrix Builds**: Parallel platform building
- **Test Sharding**: Distributed test execution

## Deployment Environments

### Staging (`staging.codecrucible.dev`)
- **Branch**: `develop`
- **Purpose**: Integration testing and QA
- **Features**: Full feature preview with monitoring

### Production (`codecrucible.dev`)
- **Branch**: `main`
- **Purpose**: Live production environment
- **Features**: Blue-green deployment, rollback capability

## Troubleshooting Guide

### Common Issues

1. **Rust Build Failures**
   - Ensure Rust toolchain is properly installed
   - Check Cargo.lock for dependency conflicts
   - Verify platform-specific build requirements

2. **Test Timeouts**
   - Increase Jest timeout for heavy operations
   - Check for hanging async operations
   - Verify mock configurations

3. **Coverage Failures**
   - Review coverage thresholds in CI configuration
   - Add tests for uncovered code paths
   - Update .gitignore to exclude test files from coverage

4. **Security Scan Failures**
   - Update vulnerable dependencies
   - Review and approve security exceptions
   - Check secret scanning false positives

### Debugging Commands

```bash
# Local CI simulation
npm run build:rust && npm run build && npm test

# Coverage analysis
npm test -- --coverage --verbose

# Security audit
npm audit --audit-level moderate

# Package validation
npm pack --dry-run
```

## Maintenance

### Weekly Tasks
- Review security scan results
- Update dependencies
- Monitor performance metrics
- Check disk space usage for artifacts

### Monthly Tasks
- Review and update coverage thresholds
- Audit workflow performance
- Update documentation
- Clean up old artifacts and caches

## Contact & Support

- **Issues**: [GitHub Issues](https://github.com/rhinos0608/codecrucible-synth/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rhinos0608/codecrucible-synth/discussions)
- **Documentation**: Check `CLAUDE.md` for development guidelines

---

**Last Updated**: September 2025  
**Pipeline Version**: v4.2.4+  
**Maintained By**: CodeCrucible Team