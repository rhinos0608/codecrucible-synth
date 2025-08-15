# CodeCrucible Synth v2.0.0

> **Revolutionary Standalone Desktop CLI Agentic Coding Assistant**  
> *Complete local AI-powered development with multi-voice synthesis*

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/codecrucible/codecrucible-synth)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

**CodeCrucible Synth** is a completely self-contained, offline-first coding assistant that brings the power of multi-voice AI synthesis to your local development environment. No API keys, no external dependencies, no cloud services required.

## 🚀 What Makes This Special

### 🎭 Multi-Voice AI System
- **9 Specialized AI Voices** - Each with unique perspectives and expertise
- **Synthesis Engine** - Combines multiple viewpoints into superior solutions
- **Voice Archetypes** - Explorer, Maintainer, Security, Architect, Designer, and more
- **Configurable Presets** - Pre-tuned voice combinations for common tasks

### 🏠 Completely Local & Offline
- **No API Keys Required** - Uses local Ollama with gpt-oss-20b
- **Full Privacy** - Your code never leaves your machine
- **No Internet Dependencies** - Works completely offline
- **Zero Configuration** - Self-configuring with sensible defaults

### 🖥️ Multiple Interface Options
- **CLI Mode** - Rich terminal interface with colors and interactive prompts
- **Agentic Mode** - Cursor/Claude Code-like autonomous coding assistant
- **Desktop GUI** - Electron-based visual interface
- **Server Mode** - REST API for IDE integration

### 🔧 Advanced Features
- **File System Integration** - Safe, sandboxed file operations
- **Project Awareness** - Understands your codebase structure
- **Real-time File Watching** - Responds to code changes automatically
- **Multi-Language Support** - TypeScript, JavaScript, Python, and more
- **MCP Server Integration** - Extensible with Model Context Protocol

## 📋 Prerequisites

1. **Node.js 18+** - [Download Node.js](https://nodejs.org)
2. **Ollama** - Local AI model runtime (auto-installed during setup)

### Automatic Setup ✨

CodeCrucible now features **automatic setup**! Just install and run:

```bash
npm install -g codecrucible-synth
cc
```

The app will automatically:
- Install Ollama if needed
- Guide you through model selection
- Set up your preferred AI model
- Start the enhanced agentic client

### Manual Ollama Setup (Optional)

If you prefer manual setup:

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Download a recommended model
ollama pull qwq:32b-preview-q4_K_M

# Start Ollama server
ollama serve
```

## 🛠️ Installation

### Method 1: NPM (Recommended)

```bash
# Install globally
npm install -g codecrucible-synth

# Verify installation
cc --help
```

### Method 2: From Source

```bash
# Clone repository
git clone https://github.com/codecrucible/codecrucible-synth.git
cd codecrucible-synth

# Install dependencies
npm install

# Build application
npm run build

# Link globally
npm link

# Test installation
cc --help
```

### Method 3: Standalone Binaries

Download pre-built binaries from [Releases](https://github.com/codecrucible/codecrucible-synth/releases):

- **Windows**: `codecrucible-win.exe`
- **macOS**: `codecrucible-macos`
- **Linux**: `codecrucible-linux`

## 🎯 Quick Start

### Basic Usage

```bash
# Simple code generation
cc "Create a React component for user authentication"

# Multi-voice generation with specific voices
cc --voices explorer,security "Build a secure API endpoint"

# Full council mode (all voices)
cc --council "Design a microservices architecture"
```

### Interactive Mode

```bash
# Start interactive session
cc --interactive
# or
cc -i

# Interactive with specific voices
cc -i --voices explorer,maintainer
```

### File Operations

```bash
# Analyze a file
cc file analyze src/auth.ts

# Refactor code
cc file refactor components/Button.tsx

# Generate tests
cc file test utils/validation.js

# Explain complex code
cc file explain src/algorithm.py
```

### Project Operations

```bash
# Analyze entire project
cc project analyze

# Refactor with pattern matching
cc project refactor --pattern "src/**/*.ts"

# Generate documentation
cc project document

# Suggest testing strategy
cc project test
```

### Voice-Specific Consultation

```bash
# Security review
cc voice security "Review this authentication flow"

# Performance optimization
cc voice optimizer "Improve this function's performance"

# Architecture guidance
cc voice architect "Design a database schema"
```

## 🤖 Agentic Mode (Cursor/Claude Code-like)

Experience autonomous coding assistance with real-time project awareness:

```bash
# Start agentic mode with file watching
cc agent --watch

# With custom port
cc agent --port 3000

# The agentic client will:
# ✅ Watch your files for changes
# ✅ Understand your project structure
# ✅ Provide contextual assistance
# ✅ Execute commands safely
# ✅ Maintain conversation history
```

**Natural Language Commands:**
- "Create a new React component for user profiles"
- "Fix the authentication bug in auth.ts"
- "Optimize the database queries in this file"
- "Add comprehensive error handling"
- "Run the test suite"

## 🖥️ Desktop Application

Launch the visual interface for a more traditional app experience:

```bash
# Start desktop mode
cc desktop

# Custom port
cc desktop --port 3001
```

**Features:**
- **Visual Voice Selection** - Click to choose voices
- **Synthesis Mode Switching** - Competitive, Collaborative, Consensus
- **Real-time Generation** - See responses as they're generated
- **Code Export** - Save generated code to files
- **Project Integration** - Load and analyze project files

## 🌐 Server Mode (IDE Integration)

Run as a server for integration with VS Code, JetBrains IDEs, and other editors:

```bash
# Start server mode
cc serve --port 3002

# With CORS enabled for web integration
cc serve --port 3002 --cors

# Available endpoints:
# GET  /health
# GET  /api/model/status
# GET  /api/voices
# POST /api/generate
# POST /api/analyze
# POST /api/file/:operation
# WebSocket support for real-time communication
```

### VS Code Integration Example

```typescript
// In your VS Code extension
const response = await fetch('http://localhost:3002/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Optimize this function',
    voices: ['optimizer', 'maintainer'],
    mode: 'competitive',
    context: [{ path: 'file.ts', content: selectedText }]
  })
});

const result = await response.json();
// Use result.result.code
```

## 🎭 Voice Archetypes

### Analysis Engines (Perspectives)

| Voice | Focus | Temperature | Style |
|-------|-------|-------------|-------|
| **Explorer** | Innovation & creativity | 0.9 | Experimental |
| **Maintainer** | Stability & best practices | 0.5 | Conservative |
| **Analyzer** | Performance & patterns | 0.6 | Analytical |
| **Developer** | Developer experience | 0.7 | Pragmatic |
| **Implementor** | Practical delivery | 0.6 | Decisive |

### Specialization Engines (Roles)

| Voice | Focus | Temperature | Style |
|-------|-------|-------------|-------|
| **Security** | Secure coding practices | 0.3 | Defensive |
| **Architect** | Scalable system design | 0.5 | Systematic |
| **Designer** | UI/UX & interfaces | 0.7 | User-centric |
| **Optimizer** | Performance & efficiency | 0.4 | Efficiency-focused |

### Synthesis Modes

- **Competitive** - Selects best aspects from each voice
- **Collaborative** - Integrates perspectives into hybrid solutions
- **Consensus** - Finds common ground between all voices

## ⚙️ Configuration

Configuration is stored in `~/.codecrucible/config.yaml`:

```yaml
model:
  endpoint: "http://localhost:11434"
  name: "gpt-oss:20b"
  temperature: 0.7

voices:
  default: ["explorer", "maintainer"]
  maxConcurrent: 3

safety:
  commandValidation: true
  fileSystemRestrictions: true

performance:
  responseCache:
    enabled: true
    maxAge: 3600000  # 1 hour
```

### Configuration Commands

```bash
# View current configuration
cc config --list

# Set default voices
cc config --set voices.default=explorer,maintainer,security

# Update model settings
cc config --set model.temperature=0.8

# Reset to defaults
cc config --reset
```

## 🔒 Security Features

### File System Protection
- **Restricted Paths** - Blocks access to system directories
- **Safe Operations** - Sandboxed file read/write operations
- **User Consent** - Requires confirmation for destructive operations

### Command Validation
- **Allowed Commands** - Whitelist of safe terminal commands
- **Blocked Operations** - Prevents dangerous system operations
- **Safe Execution** - Timeout and resource limits

### Privacy First
- **No Telemetry** - Zero data collection
- **Local Processing** - All AI operations happen locally
- **Encrypted Storage** - Secure configuration and cache storage

## 📊 Usage Examples

### Web Development

```bash
# Create a modern React component
cc "Create a React component with TypeScript for a responsive navigation bar with dark mode support"

# API development
cc --voices security,architect "Build a RESTful API with authentication middleware"

# Performance optimization
cc voice optimizer "Optimize this React component for better rendering performance"
```

### Data Science

```bash
# Python data analysis
cc "Create a Python script to analyze CSV data and generate visualizations"

# Machine learning
cc --voices analyzer,optimizer "Implement a neural network for image classification"
```

### DevOps & Infrastructure

```bash
# Docker configuration
cc "Create a multi-stage Dockerfile for a Node.js application"

# CI/CD pipeline
cc voice architect "Design a GitHub Actions workflow for automated testing and deployment"
```

## 🧪 Advanced Features

### Custom Voice Presets

```bash
# Security-focused review
cc --preset security_review "Review this payment processing code"

# Performance optimization
cc --preset performance_optimization "Optimize this database query"

# UI component development
cc --preset ui_component "Create a reusable button component"
```

### Batch Processing

```bash
# Analyze multiple files
find src/ -name "*.ts" -exec cc file analyze {} \;

# Project-wide refactoring
cc project refactor --pattern "**/*.{js,ts}" --voices maintainer,architect
```

### Integration with Git

```bash
# Generate commit messages
git diff --staged | cc "Generate a conventional commit message for these changes"

# Code review assistance
cc voice security "Review this code for security vulnerabilities" < changes.diff
```

## 🔧 Development

### Building from Source

```bash
git clone https://github.com/codecrucible/codecrucible-synth.git
cd codecrucible-synth

# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### Creating Standalone Binaries

```bash
# Build all platforms
npm run package:all

# Individual platforms
npm run package:win    # Windows
npm run package:mac    # macOS  
npm run package:linux  # Linux
```

### Desktop Development

```bash
# Start desktop app in development
npm run desktop:dev

# Build desktop distributables
npm run desktop:build
```

## 🐛 Troubleshooting

### Model Not Available

```bash
# Automatic setup (recommended)
cc model --setup

# Check system status
cc model --status

# List available models
cc model --list

# Install specific model
cc model --pull qwq:32b-preview-q4_K_M

# Test model functionality
cc model --test
```

### Permission Issues

```bash
# Fix npm global permissions
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# Or use sudo (not recommended)
sudo npm install -g codecrucible-synth
```

### Performance Issues

```bash
# Clear cache
cc config --set performance.responseCache.enabled=false

# Reduce concurrent voices
cc config --set voices.maxConcurrent=1

# Use smaller/faster model
cc model --pull gemma2:9b
cc config --set model.name=gemma2:9b

# Check model performance
cc model --test
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 🛣️ Roadmap

### v2.1.0 - Enhanced Integration
- [ ] VS Code extension
- [ ] JetBrains plugin support
- [ ] Vim/Neovim integration
- [ ] Custom voice creation tools

### v2.2.0 - Advanced AI Features
- [ ] Fine-tuning interface for custom models
- [ ] Voice learning from user feedback
- [ ] Advanced context understanding
- [ ] Multi-model support

### v2.3.0 - Team Features
- [ ] Shared voice configurations
- [ ] Team collaboration tools
- [ ] Code review automation
- [ ] Knowledge base integration

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/codecrucible/codecrucible-synth/wiki)
- **Issues**: [GitHub Issues](https://github.com/codecrucible/codecrucible-synth/issues)
- **Discussions**: [GitHub Discussions](https://github.com/codecrucible/codecrucible-synth/discussions)
- **Discord**: [Join our community](https://discord.gg/codecrucible)

---

**Made with ❤️ by the CodeCrucible Team**

*Empowering developers with local AI that respects privacy and enhances creativity*