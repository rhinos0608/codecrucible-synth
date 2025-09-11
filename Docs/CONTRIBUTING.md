# Contributing to CodeCrucible Synth

Thank you for your interest in contributing to CodeCrucible Synth! This guide will help you understand the project structure and development workflow.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment Setup](#development-environment-setup)
- [Project Architecture](#project-architecture)
- [Development Workflow](#development-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Code Style and Standards](#code-style-and-standards)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)

## Getting Started

### Prerequisites

- **Node.js**: Version 18+ (check with `node --version`)
- **npm**: Version 8+ (check with `npm --version`)
- **Git**: For version control
- **Optional**: Ollama or LM Studio for local AI model support

### Quick Setup

```bash
# Clone the repository
git clone <repository-url>
cd codecrucible-synth

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Test the CLI
node dist/index.js --help
```

## Development Environment Setup

### Required Dependencies

```bash
# Core dependencies are already in package.json
npm install

# For development
npm install --save-dev
```

### Optional AI Model Setup

```bash
# Install Ollama for local models
curl -fsSL https://ollama.ai/install.sh | sh

# Download a coding model
ollama pull qwen2.5-coder:7b

# Verify setup
npm run dev -- models
```

## Project Architecture

### Core Components

```
src/
├── core/                      # Core system components
│   ├── cli.ts                # Main CLI interface
│   ├── client.ts             # Unified model client
│   ├── agent.ts              # AI agent orchestration
│   └── living-spiral-coordinator.ts  # Development methodology
├── voices/                    # AI voice archetype system
├── providers/                 # LLM provider implementations
├── mcp-servers/              # Model Context Protocol servers
├── security/                  # Security and authentication
└── tools/                     # Tool implementations
```

### Key Systems

1. **Living Spiral Methodology**: 5-phase iterative development
   - Collapse → Council → Synthesis → Rebirth → Reflection

2. **Voice Archetype System**: 10 specialized AI personalities
   - Explorer, Maintainer, Security, Architect, Developer, etc.

3. **Hybrid Model Architecture**: Combines multiple AI providers
   - Ollama, LM Studio, HuggingFace integration

4. **Security Framework**: Enterprise-grade security
   - RBAC, JWT authentication, encryption, audit logging

## Development Workflow

### Branch Strategy

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Create bugfix branch  
git checkout -b bugfix/issue-description

# Create hotfix branch
git checkout -b hotfix/critical-fix
```

### Development Process

1. **Start with Tests** (TDD approach)
   ```bash
   # Create test file first
   touch tests/unit/your-feature.test.ts
   
   # Write failing tests
   # Implement feature
   # Ensure tests pass
   npm test
   ```

2. **Follow TypeScript Strict Mode**
   ```bash
   # Check for type errors
   npx tsc --noEmit --strict
   
   # Build should be clean
   npm run build
   ```

3. **Implement Security-First**
   - All user inputs must be validated
   - Use existing security utilities
   - Follow principle of least privilege

### Build Process

```bash
# Development build with watching
npm run dev

# Production build
npm run build

# Copy assets (configs, etc.)
npm run copy-assets

# Full build pipeline
npm run build && npm run copy-assets
```

## Testing Guidelines

### Test Structure

```typescript
// tests/unit/your-component.test.ts
import { YourComponent } from '../../src/your-component.js';

describe('YourComponent', () => {
  let component: YourComponent;
  
  beforeEach(() => {
    component = new YourComponent();
  });
  
  describe('Core Functionality', () => {
    test('should perform basic operation', () => {
      expect(component.basicOperation()).toBe(expectedResult);
    });
  });
  
  describe('Error Handling', () => {
    test('should handle invalid input gracefully', () => {
      expect(() => component.operation(invalidInput))
        .toThrow('Expected error message');
    });
  });
});
```

### Test Categories

1. **Unit Tests**: Test individual components in isolation
   - Location: `tests/unit/`
   - Pattern: `*.test.ts`

2. **Integration Tests**: Test component interactions
   - Location: `tests/integration/`
   - Pattern: `*.integration.test.ts`

3. **Security Tests**: Test security boundaries
   - Location: `tests/security/`
   - Pattern: `*.security.test.ts`

4. **Smoke Tests**: Basic functionality verification
   - Location: `tests/smoke.test.ts`

### Running Tests

```bash
# All tests
npm test

# Specific test file
npx jest tests/unit/your-component.test.ts

# Watch mode for development
npx jest --watch

# Coverage report
npx jest --coverage
```

## Code Style and Standards

### TypeScript Guidelines

1. **Use Strict Type Safety**
   ```typescript
   // Good
   interface UserData {
     id: string;
     name: string;
     email?: string;
   }
   
   function processUser(user: UserData): Result<string, Error> {
     // Implementation
   }
   
   // Avoid
   function processUser(user: any): any {
     // Implementation
   }
   ```

2. **Error Handling**
   ```typescript
   // Use structured error system
   import { ErrorHandler, ErrorCategory } from '../core/error-handling';
   
   try {
     // Operation
   } catch (error) {
     return ErrorHandler.handleError(error, { context: 'operation' });
   }
   ```

3. **Async/Await Pattern**
   ```typescript
   // Good
   async function fetchData(): Promise<Data> {
     try {
       const response = await apiCall();
       return response.data;
     } catch (error) {
       throw new Error(`Failed to fetch: ${error.message}`);
     }
   }
   ```

### Security Guidelines

1. **Input Validation**
   ```typescript
   import { SecurityUtils } from '../core/security';
   
   function processInput(input: string): Result<string> {
     const validation = SecurityUtils.validateInput(input);
     if (!validation.allowed) {
       return ErrorHandler.createError('Invalid input', 
         ErrorCategory.VALIDATION);
     }
     return { success: true, data: validation.sanitized };
   }
   ```

2. **Authentication/Authorization**
   ```typescript
   // Check permissions before operations
   if (!rbacSystem.hasPermission(userId, 'read', 'documents')) {
     throw new AuthorizationError('Insufficient permissions');
   }
   ```

### Documentation

1. **JSDoc Comments**
   ```typescript
   /**
    * Process user data with validation and transformation
    * @param userData - Raw user input data
    * @param options - Processing options
    * @returns Processed user object or error
    * @throws {ValidationError} When user data is invalid
    */
   async function processUserData(
     userData: RawUserData,
     options: ProcessingOptions
   ): Promise<ProcessedUser> {
     // Implementation
   }
   ```

2. **README Updates**
   - Update relevant documentation
   - Include code examples for new features
   - Update API documentation

## Pull Request Process

### Before Submitting

1. **Code Quality Checks**
   ```bash
   # TypeScript compilation
   npm run build
   
   # All tests pass
   npm test
   
   # Linting (if configured)
   npm run lint
   ```

2. **Documentation Updates**
   - Update README.md if needed
   - Add/update JSDoc comments
   - Update CHANGELOG.md

3. **Security Review**
   - Check for secrets in code
   - Verify input validation
   - Test security boundaries

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Security improvement

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Security Checklist
- [ ] No secrets committed
- [ ] Input validation implemented
- [ ] Authorization checks added
- [ ] Security tests updated

## Documentation
- [ ] Code comments updated
- [ ] README updated
- [ ] API docs updated
```

### Review Process

1. **Automated Checks**
   - Build passes
   - Tests pass
   - Type checking passes

2. **Code Review**
   - Architecture consistency
   - Security considerations
   - Performance implications
   - Code clarity

3. **Testing Review**
   - Test coverage adequate
   - Edge cases covered
   - Security tests included

## Issue Guidelines

### Bug Reports

```markdown
## Bug Report

**Describe the Bug**
Clear description of the issue

**To Reproduce**
1. Step 1
2. Step 2
3. See error

**Expected Behavior**
What should happen

**Environment**
- OS: [e.g. macOS, Windows, Linux]
- Node.js version: [e.g. 18.17.0]
- CodeCrucible version: [e.g. 3.9.0]

**Additional Context**
Logs, screenshots, etc.
```

### Feature Requests

```markdown
## Feature Request

**Problem Description**
What problem does this solve?

**Proposed Solution**
Detailed description of the feature

**Alternatives Considered**
Other approaches considered

**Implementation Notes**
Technical considerations

**Security Implications**
Security review needed?
```

## Advanced Development Topics

### Adding New Voice Archetypes

1. Define voice characteristics in `src/voices/voice-archetype-system.ts`
2. Add voice configuration to `config/voices.yaml`
3. Add comprehensive tests
4. Update documentation

### Adding New LLM Providers

1. Implement provider interface in `src/providers/`
2. Add configuration support
3. Update fallback chain logic
4. Add provider-specific tests

### Extending Security Framework

1. Follow existing patterns in `src/infrastructure/security/`
2. Integrate with audit logging
3. Add comprehensive security tests
4. Update compliance documentation

### Performance Considerations

1. **Memory Management**
   - Monitor for memory leaks
   - Use proper cleanup patterns
   - Test with large inputs

2. **Concurrency**
   - Handle concurrent requests safely
   - Use appropriate locking mechanisms
   - Test race conditions

3. **Caching**
   - Implement caching where appropriate
   - Consider cache invalidation
   - Monitor cache hit rates

## Getting Help

### Resources

- **Documentation**: Check `Docs/` folder
- **Examples**: Look at existing code patterns
- **Tests**: Reference test files for usage examples

### Communication

- **Issues**: Use GitHub issues for bugs and features
- **Questions**: Start with documentation and code examples
- **Security Issues**: Follow responsible disclosure

## Development Philosophy

### The Living Spiral Approach

CodeCrucible follows the Living Spiral methodology:

1. **Collapse**: Break down complex problems
2. **Council**: Multi-perspective analysis using voice archetypes
3. **Synthesis**: Create unified solutions
4. **Rebirth**: Implement with iterative testing
5. **Reflection**: Learn and improve

Apply this to your contributions by:
- Breaking down features into manageable parts
- Considering multiple approaches
- Creating well-tested implementations
- Learning from the process

### Quality Standards

- **Security First**: All code should be secure by default
- **Test Coverage**: Aim for 80%+ test coverage
- **Documentation**: Code should be self-documenting
- **Performance**: Consider scalability and efficiency
- **Maintainability**: Write code for future contributors

## Conclusion

Contributing to CodeCrucible Synth means joining a project focused on AI-powered development tools with enterprise-grade security and architecture. Your contributions help build the future of AI-assisted software development.

Thank you for contributing! 🚀

---

*This contributing guide is a living document. Please suggest improvements as you work with the codebase.*