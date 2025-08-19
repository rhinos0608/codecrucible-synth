# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeCrucible Synth is an AI-powered code generation and analysis tool that implements a hybrid model architecture combining local AI providers (Ollama, LM Studio) with a multi-voice synthesis system and the "Living Spiral" development methodology.

## Development Commands

### Build and Development
```bash
# Install dependencies
npm install

# Development mode with TypeScript compilation
npm run dev

# Build the project (TypeScript compilation + asset copying)
npm run build

# Copy configuration and asset files
npm run copy-assets

# Create global CLI link after building
npm run install-global
```

### Testing
```bash
# Run all tests
npm test

# Run smoke tests only
npm run test:smoke

# Lint TypeScript files
npm run lint
```

### CLI Usage
```bash
# Basic help and status
node dist/index.js --help
node dist/index.js status
node dist/index.js models

# After building and linking globally
crucible --help
cc status
```

### Server Mode
```bash
# Start REST API server on port 3002
npm run start
# or
node dist/index.js --server --port 3002
```

## High-Level Architecture

### Core System Components

1. **Unified Model Client (`src/core/client.ts`)**
   - Consolidates all LLM provider integrations
   - Supports Ollama, LM Studio, HuggingFace
   - Handles provider failover and load balancing
   - Implements security sandboxing and input validation

2. **Living Spiral Coordinator (`src/core/living-spiral-coordinator.ts`)**
   - Implements the 5-phase iterative development methodology:
     - **Collapse**: Problem decomposition
     - **Council**: Multi-voice perspective gathering
     - **Synthesis**: Unified design creation
     - **Rebirth**: Implementation with testing
     - **Reflection**: Learning and quality assessment

3. **Voice Archetype System (`src/voices/voice-archetype-system.ts`)**
   - 10 specialized AI personalities with different expertise areas:
     - Explorer (innovation, creativity)
     - Maintainer (stability, quality)
     - Security (vulnerability assessment)
     - Architect (system design)
     - Developer (practical implementation)
     - Analyzer (performance, optimization)
     - Implementor (execution focus)
     - Designer (UI/UX)
     - Optimizer (efficiency)
     - Guardian (quality gates)

4. **CLI System (`src/core/cli.ts`)**
   - Main command-line interface
   - Handles multi-modal interactions (file analysis, code generation)
   - Integrates with all core systems
   - Supports both interactive and batch modes

5. **MCP Server Manager (`src/mcp-servers/mcp-server-manager.ts`)**
   - Model Context Protocol integration
   - Manages filesystem, git, terminal, and package manager servers
   - Provides secure sandboxed tool execution

### Architecture Patterns

- **Hybrid Model Architecture**: Combines fast local models (LM Studio) with high-quality reasoning models (Ollama)
- **Multi-Voice Synthesis**: Different AI personalities collaborate on complex problems
- **Security-First Design**: All operations are sandboxed with input validation
- **Graceful Degradation**: System works without AI models for basic operations
- **Event-Driven**: Uses EventEmitter patterns for real-time communication

## Project Structure

```
src/
├── core/                    # Core system components
│   ├── cli.ts              # Main CLI interface
│   ├── client.ts           # Unified model client
│   ├── agent.ts            # AI agent orchestration
│   ├── living-spiral-coordinator.ts  # Spiral methodology
│   ├── types.ts            # Core type definitions
│   ├── tools/              # Tool implementations
│   ├── streaming/          # Real-time response handling
│   ├── security/           # Security and validation
│   └── intelligence/       # Context-aware features
├── voices/                 # Voice archetype system
├── mcp-servers/           # Model Context Protocol servers
├── config/                # Configuration management
├── desktop/               # Electron desktop app (experimental)
└── providers/             # LLM provider implementations

config/                    # Configuration files
├── default.yaml          # Default configuration
├── hybrid-config.json    # Hybrid model settings
└── voices.yaml           # Voice archetype definitions

Docs/                      # Comprehensive documentation
├── Hybrid-LLM-Architecture.md
├── Quick-Start-Hybrid.md
├── Coding Grimoire and Implementation Guide - MUST READ FIRST
└── IMPLEMENTATION_STATUS_REPORT.md
```

## Key Configuration Files

- **`package.json`**: Dependencies, scripts, and build configuration
- **`tsconfig.json`**: TypeScript compilation settings with path aliases
- **`config/default.yaml`**: Default application configuration
- **`config/hybrid-config.json`**: Hybrid model routing configuration
- **`jest.config.cjs`**: Test configuration

## Development Guidelines

### Code Style and Patterns
- **TypeScript**: Strict mode disabled for compatibility, but type safety enforced
- **ES Modules**: Uses modern ES module syntax throughout
- **Event-Driven**: Extensive use of EventEmitter for component communication
- **Security**: All user inputs must be validated and sanitized
- **Error Handling**: Comprehensive error handling with graceful degradation

### Testing Approach
- **Unit Tests**: Located in `tests/unit/`
- **Integration Tests**: Located in `tests/integration/`
- **Smoke Tests**: Basic functionality verification
- **Mock Providers**: Extensive mocking for AI model dependencies

### Security Considerations
- **Input Validation**: All user inputs are sanitized through SecurityUtils
- **Sandboxing**: Tool execution is containerized and restricted
- **Path Restrictions**: File operations are limited to allowed directories
- **Command Whitelisting**: Terminal operations use approved command lists

## Common Development Tasks

### Adding a New Voice Archetype
1. Add voice definition to `src/voices/voice-archetype-system.ts`
2. Update voice configuration in `config/voices.yaml`
3. Add corresponding tests

### Adding a New Tool
1. Create tool class extending `BaseTool` in `src/core/tools/`
2. Register tool in appropriate MCP server
3. Add security validation for tool inputs
4. Write comprehensive tests

### Modifying the Living Spiral Process
1. Update phases in `src/core/living-spiral-coordinator.ts`
2. Ensure convergence detection works with changes
3. Update documentation in `Docs/` folder

### Adding a New LLM Provider
1. Implement provider interface in `src/providers/`
2. Add provider configuration to `UnifiedClientConfig`
3. Update fallback chain logic
4. Add provider-specific error handling

## Environment Setup

### Prerequisites
- Node.js 18+ (specified in package.json engines)
- Optional: Ollama for local AI models
- Optional: LM Studio for hybrid model architecture

### AI Model Setup
```bash
# Install Ollama (optional but recommended)
curl -fsSL https://ollama.ai/install.sh | sh

# Download coding models
ollama pull qwen2.5-coder:7b
ollama pull deepseek-coder:8b

# Verify model availability
crucible models
```

### Development Environment
```bash
# Clone and setup
git clone <repository-url>
cd codecrucible-synth
npm install
npm run build

# Verify installation
npm test
crucible --version
```

## Troubleshooting

### Common Issues
1. **Build Failures**: Ensure TypeScript is installed globally and run `npm run build`
2. **Test Failures**: Many tests require AI models; check model availability
3. **Permission Issues**: Run with appropriate permissions for file operations
4. **Memory Issues**: Configure performance monitoring thresholds

### Debug Mode
```bash
# Enable verbose logging
DEBUG=codecrucible:* npm run dev

# Check system status
crucible status

# Analyze specific files
crucible analyze src/core/cli.ts
```

## Notable Implementation Details

- **Graceful Model Handling**: System continues to work without AI models for basic operations
- **Streaming Responses**: Real-time token generation for better user experience
- **Memory Management**: Automatic cleanup and resource monitoring
- **Configuration Flexibility**: YAML-based configuration with environment overrides
- **Cross-Platform**: Designed to work on Windows, macOS, and Linux

The codebase follows a modular, event-driven architecture with strong security principles and comprehensive error handling. The Living Spiral methodology provides a structured approach to iterative development with AI assistance.

## 📋 MANDATORY: Session Documentation Requirements

**EVERY Claude instance MUST document their coding session** at the end of each work session by creating a comprehensive report in the `Docs/` folder.

### Session Documentation Protocol

#### 1. Create Session Report File
At the end of each coding session, create a new file in the `Docs/` folder:
```
Docs/SESSION_REPORT_YYYY-MM-DD_HH-MM.md
```
Example: `Docs/SESSION_REPORT_2025-01-15_14-30.md`

#### 2. Required Report Structure

```markdown
# Coding Session Report
**Date:** YYYY-MM-DD  
**Time:** HH:MM - HH:MM  
**Claude Instance:** [Your instance identifier]  
**Session Duration:** X hours Y minutes

## 🎯 Session Overview
Brief 2-3 sentence summary of what was accomplished this session.

## 📊 Current Project Status
### Overall Health: [Excellent/Good/Fair/Poor]
- **Build Status**: [✅ Working / ⚠️ Issues / ❌ Broken]
- **Test Status**: [X/Y tests passing (Z% success rate)]
- **Core Functionality**: [Fully Working/Mostly Working/Partially Working/Broken]
- **AI Integration**: [Connected/Degraded/Offline]
- **Documentation**: [Current/Needs Update/Outdated]

## 🔄 Changes Made This Session
### Files Modified
- `path/to/file1.ts` - Brief description of changes
- `path/to/file2.js` - What was modified and why
- `config/file.yaml` - Configuration updates

### New Files Created
- `path/to/new-file.ts` - Purpose and functionality
- `docs/new-doc.md` - Documentation added

### Files Deleted/Moved
- `old/path/file.ts` → `new/path/file.ts` - Reason for move
- `deprecated/file.js` - DELETED - Reason for removal

### Key Architectural Changes
- Describe any significant architectural modifications
- New patterns or approaches introduced
- Breaking changes and migration notes

## ✅ Accomplishments
1. **[Priority]** Task description - outcome achieved
2. **[Priority]** Another task - what was completed
3. **[Priority]** Bug fixes, improvements, etc.

## 🚨 Errors and Issues Found
### Critical Issues (Must Fix Immediately)
- **Error Description**: Details, stack trace, impact
- **Location**: File:line where error occurs
- **Proposed Solution**: How to fix it

### Non-Critical Issues (Address Soon)
- **Issue Description**: What's wrong and why it matters
- **Impact**: How it affects functionality
- **Suggested Fix**: Recommended approach

### Technical Debt Identified
- **Debt Item**: Description of technical debt
- **Interest Cost**: Impact on development velocity
- **Refactor Needed**: Suggested improvements

## 🔬 Testing Results
### Test Summary
- **Total Tests**: X
- **Passing**: Y (Z%)
- **Failing**: A (B%)
- **Skipped**: C

### Test Failures
- `test/file.test.ts:123` - Test name - Reason for failure
- `test/other.test.ts:456` - Another test - Why it's broken

### New Tests Added
- `test/new.test.ts` - What this test covers
- Coverage improvement: +X%

## 🛠️ Current Build/Runtime Status
### Build Process
- **TypeScript Compilation**: [✅ Clean / ⚠️ Warnings / ❌ Errors]
- **Asset Copying**: [✅ Working / ❌ Failed]
- **Dependencies**: [✅ All Installed / ⚠️ Some Issues / ❌ Missing]

### Runtime Functionality
- **CLI Commands**: [✅ All Working / ⚠️ Some Issues / ❌ Broken]
- **AI Model Connection**: [✅ Connected / ⚠️ Degraded / ❌ Offline]
- **Server Mode**: [✅ Working / ❌ Not Tested / ❌ Broken]
- **File Operations**: [✅ Working / ⚠️ Limited / ❌ Broken]

## 📋 Immediate Next Steps (Priority Order)
1. **[P0 - Critical]** Task description - why it's critical
2. **[P1 - High]** Next important task - expected effort
3. **[P2 - Medium]** Medium priority item - when to address
4. **[P3 - Low]** Lower priority task - for later consideration

## 🗺️ Roadmap for Next Sessions
### Short Term (Next 1-2 Sessions)
- [ ] Specific task 1 - estimated effort
- [ ] Specific task 2 - dependencies
- [ ] Bug fix X - impact if not fixed

### Medium Term (Next Week)
- [ ] Feature development Y
- [ ] Refactoring Z
- [ ] Documentation updates

### Long Term (This Month)
- [ ] Major feature addition
- [ ] Performance optimizations
- [ ] Production readiness tasks

## 🏗️ Architecture Evolution
### Current Architecture State
- Describe the current architectural patterns
- What's working well
- What needs improvement

### Proposed Changes
- Architectural improvements identified
- Patterns to introduce or modify
- Technical debt to address

## 📈 Metrics and Performance
### Performance Indicators
- **Build Time**: X seconds (±Y from last session)
- **Test Execution**: X seconds for Y tests
- **Memory Usage**: Baseline/Peak measurements
- **Startup Time**: CLI initialization speed

### Quality Metrics
- **Code Coverage**: X% (change from last session)
- **TypeScript Strictness**: Current compliance level
- **Linting Issues**: X warnings, Y errors

## 🎯 Recommendations for Next Claude
### Priority Focus Areas
1. **Most Important**: What the next Claude should focus on first
2. **Technical Debt**: Which debt items to prioritize
3. **Testing**: Which tests need attention

### Helpful Context
- Key decisions made this session and reasoning
- Patterns or approaches that work well
- Areas that need special attention or care

### Things to Avoid
- Approaches that didn't work
- Known problematic areas
- Configuration issues to watch out for

## 📚 Documentation Updates Needed
- [ ] Update README if functionality changed
- [ ] Update API documentation
- [ ] Update configuration examples
- [ ] Update troubleshooting guides

## 🔗 Related Files and Context
### Key Files Modified This Session
- `file1.ts:123-456` - Functions modified
- `file2.js:78-90` - Classes updated

### Configuration Changes
- `config/default.yaml` - Settings modified
- `package.json` - Dependencies updated

### Important Code Locations
- `src/core/component.ts:200-250` - Core logic for feature X
- `src/utils/helper.ts:50-100` - Utility functions for Y

## 💡 Lessons Learned
- Key insights gained during this session
- Patterns that worked well
- Approaches to avoid in the future
- Technical discoveries or revelations

---
**End of Session Report**  
**Next Claude: Please read this report before starting work and update the status.**
```

#### 3. Documentation Enforcement Rules

🚨 **CRITICAL REQUIREMENTS:**

1. **ALWAYS create a session report** - No exceptions
2. **Be brutally honest** about current status - don't hide problems
3. **Include specific file paths and line numbers** for issues
4. **Prioritize next steps clearly** - help the next Claude focus
5. **Document ALL errors found** - even minor ones
6. **Update status accurately** - don't overstate progress
7. **Include actionable next steps** - not vague suggestions

#### 4. Status Update Protocol

Before starting any new work:
1. **Read the most recent session report** in `Docs/`
2. **Verify the current status** by running tests and builds
3. **Update the project status** if anything has changed
4. **Follow the roadmap** from the previous session unless priorities change

#### 5. Emergency Documentation

If you encounter critical errors or system-breaking issues:
1. **Immediately document the error** in a `CRITICAL_ISSUE_YYYY-MM-DD.md` file
2. **Include full stack traces** and reproduction steps
3. **Document any emergency fixes** applied
4. **Create rollback instructions** if needed

#### 6. Handoff Protocol

When ending a session:
1. **Ensure all changes are saved** and buildable
2. **Run tests and document current state**
3. **Create the session report** with full details
4. **Clearly mark the highest priority item** for next Claude
5. **Include any time-sensitive issues** that need immediate attention

### Session Documentation Examples

#### Good Session Report Indicators:
- ✅ Specific file paths and line numbers
- ✅ Honest assessment of current status
- ✅ Clear next steps with priorities
- ✅ All errors documented with solutions
- ✅ Test results included
- ✅ Actionable recommendations

#### Poor Session Report Indicators:
- ❌ Vague descriptions without file paths
- ❌ Overly optimistic status reporting
- ❌ Missing error documentation
- ❌ No clear next steps
- ❌ No test status or results
- ❌ Generic recommendations

**Remember: The next Claude instance depends on your documentation to understand the current state and continue productive work. Comprehensive documentation is essential for project continuity and success.**