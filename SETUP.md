# 🔥 CodeCrucible Synth - Complete Setup Guide

A standalone desktop CLI agentic coding assistant with local AI models, completely self-contained with no external dependencies.

## 🚀 Quick Start (Automated)

### Windows
```bash
# 1. Clone and navigate to the project
git clone <your-repo-url>
cd CodeCrucibleSynth

# 2. Run automated setup (installs Ollama, models, and dependencies)
scripts\setup-models.bat

# 3. Start the application
scripts\start-app.bat
```

### Linux/macOS
```bash
# 1. Clone and navigate to the project
git clone <your-repo-url>
cd CodeCrucibleSynth

# 2. Make scripts executable and run setup
chmod +x scripts/*.sh
./scripts/setup-models.sh

# 3. Start the application
./scripts/start-app.sh
```

## 📋 Manual Setup

### Prerequisites
- **Node.js 18+** - [Download from nodejs.org](https://nodejs.org/)
- **Ollama** - [Download from ollama.ai](https://ollama.ai/download)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Install and Configure Ollama

#### Install Ollama
- **Windows**: Download and run the installer from [ollama.ai](https://ollama.ai/download)
- **macOS**: `brew install ollama` or download from website
- **Linux**: `curl -fsSL https://ollama.com/install.sh | sh`

#### Start Ollama Service
```bash
ollama serve
```

#### Pull AI Models (choose one or more)
```bash
# Recommended models (in order of preference)
ollama pull gpt-oss:20b      # 20B parameter model (recommended)
ollama pull llama3.1:70b     # High-quality alternative
ollama pull qwen2.5:72b      # Another excellent option
ollama pull codellama:34b    # Code-specialized model
ollama pull mistral:7b       # Lightweight fallback
```

### Step 3: Build the Application
```bash
npm run build
```

### Step 4: Test the Installation
```bash
# Test basic functionality
npm run start -- --help

# Test voice system
npm run start -- voices --list

# Test configuration
npm run start -- config --list

# Run comprehensive test suite
scripts\full-test-audit.bat  # Windows
./scripts/full-test-audit.sh # Linux/macOS
```

## 🎯 Usage Examples

### Basic Usage
```bash
# Simple code generation
codecrucible "Create a React component for a todo list"

# Use specific voices
codecrucible -v explorer,security "Create a secure authentication system"

# Interactive mode
codecrucible --interactive

# Council mode (multiple voices)
codecrucible --council "Refactor this complex function for better performance"
```

### Advanced Features
```bash
# File operations
codecrucible file analyze src/app.js
codecrucible file refactor src/components/Header.jsx

# Project operations
codecrucible project analyze --pattern "**/*.ts"
codecrucible project document --pattern "src/**/*"

# Voice-specific consultations
codecrucible voice security "Review this authentication code"
codecrucible voice architect "Design a microservices architecture"

# Agentic mode (like Cursor/Claude Code)
codecrucible agent --watch --port 3000

# Desktop GUI
codecrucible desktop

# Server mode for IDE integration
codecrucible serve --port 3002
```

## 🔧 Configuration

Configuration is stored in `~/.codecrucible/config.yaml`. Key settings:

```yaml
model:
  endpoint: "http://localhost:11434"
  name: "gpt-oss:20b"
  timeout: 30000
  maxTokens: 4096
  temperature: 0.7

voices:
  default: ["explorer", "maintainer"]
  parallel: true
  maxConcurrent: 3

database:
  path: "codecrucible.db"
  inMemory: false
  enableWAL: true

safety:
  commandValidation: true
  fileSystemRestrictions: true
  requireConsent: ["delete", "execute"]
```

### Configure Different Models
```bash
# Set a different model
codecrucible config --set model.name llama3.1:70b

# Set custom endpoint (for remote Ollama or other services)
codecrucible config --set model.endpoint http://your-server:11434

# Reset to defaults
codecrucible config --reset
```

## 🎭 Voice System

CodeCrucible features 9 specialized AI voice archetypes:

- **Explorer** - Innovative and experimental approaches
- **Maintainer** - Reliable, tested, conservative solutions
- **Analyzer** - Deep technical analysis and performance focus
- **Developer** - Practical implementation and best practices
- **Implementor** - Execution-focused with detailed steps
- **Security** - Security-first approach and threat modeling
- **Architect** - System design and architectural patterns
- **Designer** - User experience and interface design
- **Optimizer** - Performance and efficiency optimization

### Voice Usage
```bash
# List available voices
codecrucible voices --list

# Use specific voice
codecrucible voice security "How to secure this API?"

# Combine multiple voices
codecrucible -v security,architect,optimizer "Design a scalable API"
```

## 🗂️ Project Structure

```
CodeCrucibleSynth/
├── src/
│   ├── core/              # Core application logic
│   │   ├── cli.ts         # Command-line interface
│   │   ├── local-model-client.ts  # Ollama integration
│   │   └── logger.ts      # Logging system
│   ├── voices/            # Voice archetype system
│   ├── config/            # Configuration management
│   ├── database/          # SQLite database management
│   ├── mcp-servers/       # Model Context Protocol servers
│   └── desktop/           # Desktop GUI (Electron)
├── scripts/               # Automation scripts
│   ├── setup-models.*     # Model installation automation
│   ├── start-app.*        # Application startup
│   └── full-test-audit.*  # Comprehensive testing
├── tests/                 # Test suite
└── config/                # Default configurations
```

## 🔍 Troubleshooting

### Common Issues

**1. "Model not found" errors**
```bash
# Check if Ollama is running
curl http://localhost:11434

# List available models
ollama list

# Pull a compatible model
ollama pull gpt-oss:20b
```

**2. Build failures**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Check Node.js version
node --version  # Should be 18+
```

**3. Permission errors on Linux/macOS**
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Fix npm permissions (if needed)
sudo chown -R $(whoami) ~/.npm
```

**4. Port conflicts**
```bash
# Check if port 11434 is in use
netstat -an | grep 11434

# Kill existing Ollama process
pkill ollama  # Linux/macOS
taskkill /f /im ollama.exe  # Windows
```

### Performance Optimization

**1. Model Selection**
- Use `gpt-oss:20b` for best balance of speed/quality
- Use `mistral:7b` for faster responses on slower hardware
- Use `llama3.1:70b` for highest quality (requires more resources)

**2. Hardware Requirements**
- **Minimum**: 8GB RAM, 4 CPU cores
- **Recommended**: 16GB RAM, 8 CPU cores
- **Optimal**: 32GB RAM, 16 CPU cores, SSD storage

**3. Configuration Tuning**
```yaml
# For faster responses
model:
  maxTokens: 2048
  temperature: 0.5

# For multiple voices
voices:
  maxConcurrent: 2  # Reduce if limited resources
```

## 🧪 Testing and Validation

Run the comprehensive test suite:

```bash
# Windows
scripts\full-test-audit.bat

# Linux/macOS
./scripts/full-test-audit.sh
```

This tests:
- ✅ Dependencies and build system
- ✅ Application startup and CLI
- ✅ Configuration system
- ✅ Voice archetype system
- ✅ Ollama integration
- ✅ Database functionality
- ✅ MCP server integration

## 🔐 Security Features

- **Local-only operation** - No external API calls
- **Sandbox restrictions** - Limited file system access
- **Command validation** - Dangerous commands require confirmation
- **Audit logging** - All operations logged to SQLite database
- **Permission system** - Granular access controls

## 📚 Advanced Usage

### MCP Server Integration
CodeCrucible integrates with Model Context Protocol servers for extended functionality:

```bash
# Available MCP servers:
# - Filesystem: File operations with safety restrictions
# - Git: Repository management and operations
# - Terminal: Safe command execution
# - Package Manager: NPM/package operations
# - Smithery: Web search and research capabilities
```

### API Server Mode
```bash
# Start as API server for IDE integration
codecrucible serve --port 3002 --host localhost

# Endpoints available:
# POST /generate - Generate code
# POST /analyze - Analyze code
# GET /voices - List available voices
# GET /config - Get configuration
```

### Desktop GUI Mode
```bash
# Launch Electron-based desktop interface
codecrucible desktop --port 3001
```

## 📈 Monitoring and Analytics

View usage statistics and performance metrics:

```bash
# View database statistics
codecrucible config --get database

# Check application logs
tail -f ~/.codecrucible/logs/app.log

# View interaction history
sqlite3 data/codecrucible.db "SELECT * FROM voice_interactions LIMIT 10;"
```

## 🤝 Support

For issues and support:
1. Check this documentation
2. Run the diagnostic script: `scripts/full-test-audit.*`
3. Check logs in `~/.codecrucible/logs/`
4. Verify Ollama is running: `curl http://localhost:11434`

## 🎉 You're Ready!

CodeCrucible Synth is now fully configured and ready for local AI-powered coding assistance. The application works completely offline with your local Ollama models.

Happy coding! 🚀