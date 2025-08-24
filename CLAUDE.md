# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeCrucible Synth is an AI-powered code generation and analysis tool that implements a hybrid model architecture combining local AI providers (Ollama, LM Studio) with a multi-voice synthesis system and the "Living Spiral" development methodology.

🧪 **CURRENT STATUS**: Development and testing phase. Core functionality operational but not yet validated for complex long-running workflows. Enterprise security and MCP integration implemented but requires extensive real-world testing.

## Development Commands

### Build and Development
```bash
# Install dependencies (includes Smithery SDK)
npm install

# Configure MCP integration (optional)
cp .env.example .env
# Add SMITHERY_API_KEY=your_key_here to .env

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

# Current test status
# ✅ COMPILATION STATUS: Clean build achieved (TypeScript errors resolved)  
# ✅ Performance: 97% improvement in CLI responsiveness (<2s for simple commands)
# ✅ Core Systems: UnifiedModelClient, CLI, Multi-voice synthesis operational
# 🧪 TESTING PHASE: Basic functionality verified, complex workflows pending
# 🔒 Security: Enterprise components implemented, real-world testing needed  
# 🌐 MCP Integration: 10+ external servers via Smithery registry connected
# ⚠️ Long-running workflows: Not yet tested in production environments
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
   - Smithery registry integration for external MCP servers
   - Provides secure sandboxed tool execution

6. **Smithery Integration (`src/mcp-servers/smithery-registry-integration.ts`)**
   - Smithery AI registry discovery and server management
   - Bearer token authentication with environment variables
   - Auto-discovery of 10+ external MCP servers
   - Health monitoring and connection management

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

- **`package.json`**: Dependencies including Smithery SDK, scripts, and build configuration
- **`tsconfig.json`**: TypeScript compilation settings with path aliases
- **`config/default.yaml`**: Default application configuration
- **`config/hybrid-config.json`**: Hybrid model routing configuration
- **`.env.example`**: Template for environment variables (API keys)
- **`.env`**: Actual environment configuration (excluded from git)
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
- **API Key Management**: Environment variables for all sensitive data
- **Git Security**: Automatic .env exclusion from version control
- **Input Validation**: All user inputs are sanitized through SecurityUtils
- **MCP Security**: Bearer token authentication for external connections
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
- Optional: Smithery API key for external MCP integrations

### MCP Integration Setup
```bash
# Copy environment template
cp .env.example .env

# Add your Smithery API key for external MCP servers
echo "SMITHERY_API_KEY=your_smithery_api_key_here" >> .env

# Verify MCP integration
npm run build
node dist/index.js status
```

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
npm run dev

# Verify installation
npm test
crucible --version
```

## Troubleshooting

### Common Issues
1. **Build Failures**: Ensure TypeScript is installed globally and run `npm run dev`
2. **Test Failures**: Many tests require AI models; check model availability
3. **Permission Issues**: Run with appropriate permissions for file operations
4. **Memory Issues**: Configure performance monitoring thresholds

### Debug Mode
```bash
# Enable verbose logging
DEBUG=codecrucible:* npm run dev

# Check system status including MCP integration
crucible status

# Analyze specific files
crucible analyze src/core/cli.ts

# Test MCP integration
node dist/index.js "Show me available MCP tools"
```

## Notable Implementation Details

- **Production Security**: Environment-based API key management with git protection
- **MCP Registry Integration**: Smithery discovery with 10+ external servers
- **Graceful Model Handling**: System continues to work without AI models for basic operations
- **Streaming Responses**: Real-time token generation for better user experience
- **Memory Management**: Automatic cleanup and resource monitoring
- **Configuration Flexibility**: YAML-based configuration with environment overrides
- **External Tool Integration**: Task Manager, Terminal Controller, Remote Shell via MCP
- **Health Monitoring**: Built-in connection health checks and failover
- **Cross-Platform**: Designed to work on Windows, macOS, and Linux

The codebase follows a modular, event-driven architecture with enterprise security principles, comprehensive error handling, and extensible MCP integration. The Living Spiral methodology provides a structured approach to iterative development with AI assistance.

## ⚠️ Testing and Validation Status

**Current Capabilities (Verified):**
- ✅ CLI performance and responsiveness 
- ✅ Multi-voice AI synthesis system
- ✅ MCP integration with external tools
- ✅ Basic file analysis and code generation
- ✅ Security systems and input validation
- ✅ Error handling and graceful degradation

**Pending Validation (Requires Testing):**
- ⏳ Complex long-running AI workflows (>30 minutes)
- ⏳ High-volume concurrent request handling  
- ⏳ Extended collaboration sessions with multiple voices
- ⏳ Large-scale codebase analysis and generation
- ⏳ Production environment stability under load
- ⏳ Memory management in extended sessions

**Recommended Usage:**
- **Development/Testing**: Suitable for experimentation and short-to-medium tasks
- **Production**: Requires thorough testing of specific use cases before deployment
- **Complex Workflows**: Monitor system performance and implement appropriate timeouts

