# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeCrucible Synth is a next-generation AI coding assistant with advanced caching, intelligent model persistence, and comprehensive optimizations for enterprise-scale performance. It's a completely self-contained, offline-first coding assistant that brings multi-voice AI synthesis to local development environments.

## Key Architecture Components

### Core Architecture
- **LocalModelClient** (`src/core/local-model-client.ts`) - Primary interface for Ollama model communication
- **VoiceArchetypeSystem** (`src/voices/voice-archetype-system.ts`) - Multi-voice AI synthesis engine with 9 specialized voices
- **EnhancedAgenticClient** (`src/core/enhanced-agentic-client.ts`) - Main agentic interface similar to Cursor/Claude Code
- **MCPServerManager** (`src/mcp-servers/mcp-server-manager.ts`) - Model Context Protocol server management
- **CLI** (`src/core/cli.ts`) - Command-line interface with comprehensive subcommands

### Voice System
The system uses 9 specialized AI voices with different perspectives:
- **Analysis Engines**: Explorer, Maintainer, Analyzer, Developer, Implementor
- **Specialization Engines**: Security, Architect, Designer, Optimizer
- **Synthesis Modes**: Competitive, Collaborative, Consensus

### Model Integration
- **Hybrid Architecture**: Supports both local (Ollama) and cloud API models
- **Multi-LLM Provider**: Can orchestrate multiple model providers simultaneously
- **Model Persistence**: Advanced caching and session management

## Common Development Commands

### Building and Testing
```bash
# Build the project
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Development mode (TypeScript compilation + hot reload)
npm run dev

# Start built application
npm start
```

### Package Management
```bash
# Install dependencies
npm install

# Install globally for CLI usage
npm run install-global

# Test installation
npm run test-install
```

### Binary Packaging
```bash
# Package for all platforms
npm run package:all

# Individual platforms
npm run package:win    # Windows
npm run package:mac    # macOS
npm run package:linux  # Linux
```

### Desktop Application
```bash
# Development mode
npm run desktop:dev

# Build desktop distributables
npm run desktop:build
```

## Development Environment Setup

### Prerequisites
- Node.js 18+
- Ollama (for local AI models)
- TypeScript 5.3+

### Configuration
- Main config: `config/default.yaml` - Contains model endpoints, voice settings, MCP servers
- Hybrid config: `config/hybrid.yaml` - Advanced multi-model configurations
- Voice config: `config/voices.yaml` - Voice archetype definitions

### Testing Framework
- **Jest** with TypeScript support
- ESM module configuration
- Mock system for external dependencies (chalk, ora, inquirer)
- Test timeout: 30 seconds
- Coverage reporting enabled

## Project Structure

### Core Modules
- `src/core/` - Main application logic, agents, and orchestration
- `src/voices/` - Voice archetype system implementation
- `src/mcp-servers/` - MCP server integrations
- `src/config/` - Configuration management
- `src/desktop/` - Electron desktop application
- `src/server/` - Server mode for IDE integration

### Agent System
- `src/core/agents/` - Specialized AI agents (code analyzer, explorer, git manager, etc.)
- `src/core/tools/` - Tool system for file operations, code execution, research
- `src/core/memory/` - Conversation and project memory systems

### Advanced Features
- `src/core/e2b/` - E2B sandbox integration for secure code execution
- `src/core/performance/` - Performance optimization systems
- `src/core/security/` - Security validation and input sanitization
- `src/core/planning/` - Enhanced agentic planning capabilities

## CLI Usage Patterns

### Basic Generation
```bash
crucible "Create a React component for user authentication"
crucible --voices explorer,security "Build a secure API endpoint"
```

### Agentic Mode (Default)
```bash
crucible agent              # Start ReAct agent mode
crucible --agentic          # Alternative syntax
crucible                    # Defaults to agentic mode if no prompt
```

### File Operations
```bash
crucible file analyze src/auth.ts
crucible file refactor components/Button.tsx
crucible file test utils/validation.js
```

### Model Management
```bash
crucible model --status     # Check model availability
crucible model --setup      # Auto-setup Ollama and models
crucible model --test       # Test model functionality
```

## Integration Points

### MCP Servers
- **Filesystem MCP**: Safe file operations with path restrictions
- **Git MCP**: Version control integration with safety checks
- **Terminal MCP**: Controlled command execution
- **Package Manager MCP**: Dependency management with security scanning

### External Integrations
- **E2B Code Interpreter**: Sandboxed code execution
- **Smithery AI**: Optional enhanced MCP server integration
- **Hugging Face**: Model discovery and recommendations

## AI Development Guidelines for Full-Stack Coding

### Working as an Agentic AI Developer
You are working with a sophisticated agentic coding assistant similar to Claude Code, Cursor, and Gemini CLI. Follow these patterns for effective collaboration:

#### Context-Aware Development
- Always analyze the entire project structure before making changes
- Use the `globalRAGSystem` for comprehensive codebase understanding
- Leverage voice archetypes for specialized perspectives (security, architecture, performance)
- Consider multi-file dependencies when refactoring

#### Agentic Workflow Patterns
- **Terminal-First Approach**: Prioritize CLI operations over GUI interactions
- **Natural Language Commands**: Use descriptive prompts that specify intent, not just technical steps
- **Iterative Refinement**: Use the `--iterative` mode for complex tasks requiring multiple passes
- **Voice Synthesis**: Combine multiple AI perspectives (e.g., `--voices security,architect`) for comprehensive solutions

#### Best Practices from Claude Code & Similar Tools
- **Project Context**: Always include project-wide context for complex refactoring
- **Safety First**: Use confirmation systems for destructive operations
- **Incremental Changes**: Make atomic, testable changes rather than large refactors
- **Documentation Integration**: Maintain CLAUDE.md files for project-specific guidance

### Code Organization
- All TypeScript with strict mode enabled
- ESM modules throughout
- Path aliases: `@/*` for `src/*`, `@/config/*` for `config/*`
- Comprehensive error handling with structured error system

### Configuration Management
- YAML-based configuration with environment variable support
- Hierarchical config loading (default → user → environment)
- Runtime configuration validation with Zod schemas

### Testing Strategy
- Unit tests in `tests/unit/`
- Integration tests in `tests/integration/`
- Mocked external dependencies for deterministic testing
- Coverage reporting for quality assurance

### Performance Considerations
- Response caching system (1-hour default TTL)
- VRAM optimization for large models
- Request deduplication for efficiency
- Configurable timeout management

### AI-Assisted Development Patterns

#### Multi-Voice Development
When working on complex features, leverage different AI perspectives:
```bash
# Security-focused development
crucible --voices security,maintainer "Implement OAuth 2.0 with security best practices"

# Performance optimization
crucible --voices optimizer,analyzer "Optimize database queries for large datasets"

# Full architecture review
crucible --council "Design microservices architecture for user management"
```

#### Agentic Mode Usage
- Start agent mode for complex, multi-step tasks: `crucible agent`
- Use file watching for real-time development: `crucible agent --watch`
- Leverage project context for informed decisions
- Allow autonomous planning for architectural changes

#### Tool Integration
- **E2B Sandbox**: Use for safe code execution and testing
- **MCP Servers**: Leverage filesystem, git, and terminal integrations
- **RAG System**: Automatically indexes project for context-aware assistance
- **Edit Confirmation**: Review all changes before application

## Security Features

### Sandboxing
- E2B integration for isolated code execution
- Configurable resource limits (memory, CPU, disk)
- Network access controls
- Process spawning restrictions

### File System Protection
- Restricted path access (blocks `/etc`, `/sys`, `/proc`)
- Safe operation validation
- User consent requirements for destructive operations
- Audit logging for all file operations

### Input Validation
- Command validation with allowlists
- Code validation before execution
- SQL injection prevention
- XSS protection for web interfaces

## Troubleshooting

### Model Issues
- Check Ollama service: `ollama serve`
- Verify model availability: `crucible model --list`
- Test connectivity: `crucible model --test`

### Build Issues
- Clear dist folder: `rm -rf dist/`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check TypeScript compilation: `npx tsc --noEmit`

### Performance Issues
- Disable response cache: Set `performance.responseCache.enabled: false`
- Reduce concurrent voices: Lower `voices.maxConcurrent`
- Use smaller models: Switch to `gemma2:9b` or similar

### Agent Mode Issues
- Ensure proper tool access permissions
- Check working directory permissions
- Verify MCP server configurations
- Review edit confirmation system settings

## Agentic AI Development Mindset

### Understanding the Role
You are working with CodeCrucible Synth as a **full-stack AI developer** with comprehensive knowledge of modern agentic tools. Your approach should mirror the capabilities and patterns found in:

- **Claude Code**: Context-aware terminal coding with natural language commands
- **Cursor**: AI-first IDE with intelligent code suggestions and refactoring
- **Gemini CLI**: High-context development with 1M+ token understanding
- **GitHub Copilot**: Inline code generation and completion

### Core Principles for AI-Assisted Development

#### 1. Context-First Development
- Always understand the full project before making changes
- Use RAG system (`globalRAGSystem`) for comprehensive codebase analysis
- Consider architectural implications of every change
- Maintain awareness of dependencies across multiple files

#### 2. Voice-Driven Architecture
- **Explorer Voice**: For innovative solutions and creative problem-solving
- **Security Voice**: For authentication, validation, and security concerns
- **Architect Voice**: For system design and scalability decisions
- **Maintainer Voice**: For code quality, documentation, and long-term sustainability
- **Optimizer Voice**: For performance improvements and efficiency

#### 3. Iterative Refinement Pattern
```bash
# Start with high-level analysis
crucible --voices explorer,architect "Analyze the requirements for user authentication system"

# Implement with security focus
crucible --voices security,maintainer "Implement OAuth 2.0 with proper error handling"

# Optimize and finalize
crucible --voices optimizer,maintainer "Review and optimize the authentication implementation"
```

#### 4. Safety-First Operations
- Use edit confirmation system for all destructive changes
- Leverage E2B sandbox for testing potentially unsafe code
- Implement proper error handling and validation
- Maintain backup strategies for critical changes

#### 5. Natural Language Programming
- Express intentions clearly in natural language
- Use descriptive prompts that explain the "why" not just the "what"
- Leverage the multi-voice system for comprehensive solutions
- Allow the system to suggest better approaches

### Advanced Agentic Patterns

#### Multi-Agent Orchestration
The system supports sophisticated agent orchestration patterns:
- **Problem Decomposition**: Break complex tasks into manageable sub-problems
- **Specialized Agent Assignment**: Route tasks to appropriate AI voices
- **Synthesis and Integration**: Combine multiple perspectives into cohesive solutions
- **Quality Assurance**: Use auditor patterns for code review and validation

#### Autonomous Planning and Execution
- Let the system plan complex multi-step operations
- Review and approve autonomous suggestions
- Use iterative improvement loops for quality enhancement
- Leverage real-time file watching for responsive development

### Integration with Modern Development Workflows

#### Git Integration
- Intelligent commit message generation
- Automated code review and suggestions
- Branch management with AI assistance
- Merge conflict resolution

#### CI/CD Pipeline Integration
- Automated testing strategy development
- Performance optimization suggestions
- Security vulnerability scanning
- Documentation generation

#### MCP Server Ecosystem
- Leverage Model Context Protocol for extensible tool integration
- Use Smithery AI for enhanced capabilities
- Integrate with external APIs and services
- Maintain secure boundaries for external tool access

## Recent Optimizations (v3.2.0)

### Performance Improvements
- **Fast Mode**: Sub-second startup with `--fast` flag for immediate responses
- **Lazy RAG Loading**: Reduced initial indexing scope for faster startup times
- **Test Suite Fixes**: All smoke tests now passing with proper Jest configuration
- **Memory Optimization**: Reduced concurrent workers and improved timeout handling

### Enhanced Agentic Capabilities
- **Multi-Voice System**: Validated with 9 specialized AI voices working correctly
- **MCP Integration**: Filesystem, Git, Terminal, and Package Manager servers operational
- **Execution Backends**: Local process execution with safety guards enabled
- **VRAM Optimization**: Advanced GPU detection and model loading improvements

### Development Experience
- **CLI Response Time**: Examples command shows comprehensive usage patterns
- **Error Handling**: Improved timeout management and graceful failure handling
- **Configuration**: YAML-based config with environment variable support
- **Testing**: Updated Jest config removes deprecation warnings and prevents hanging tests

### Usage Recommendations
- Use `crucible --fast "prompt"` for immediate template-based responses
- Use `crucible model --status` to verify Ollama and model availability
- Use `crucible examples` to see comprehensive usage patterns
- Use `crucible execution --status` to verify execution backend health