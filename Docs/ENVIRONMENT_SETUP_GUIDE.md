# Environment Setup & Configuration Guide - CodeCrucible Synth v4.2.4

**Purpose**: Complete environment setup and configuration guide for production deployment  
**Target Audience**: Developers, System Administrators, DevOps Engineers  
**Prerequisites**: Node.js 18+, Git, Terminal/Command Prompt access  

## Quick Start Checklist

```bash
# 1. Clone and install
git clone <repository-url>
cd codecrucible-synth
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings

# 3. Build and install
npm run build
npm run install-global

# 4. Verify installation
crucible --version
crucible status
```

---

## Detailed Environment Configuration

### 1. Core System Requirements

#### 1.1 Node.js Environment
```bash
# Required: Node.js 18.0.0 or later
node --version  # Should show v18.x.x or higher

# Recommended: Use latest LTS version
nvm install --lts
nvm use --lts
```

#### 1.2 System Dependencies
```bash
# Windows (PowerShell as Administrator)
winget install Git.Git
winget install OpenJS.NodeJS

# macOS  
brew install node git

# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm git

# Verify installations
git --version
npm --version
```

### 2. Environment Configuration File Setup

#### 2.1 Create Environment Configuration

**File**: `.env` (create from `.env.example`)

```bash
# Copy template
cp .env.example .env

# Edit with your preferred editor
# Windows
notepad .env

# macOS/Linux  
nano .env
# or
code .env
```

#### 2.2 Complete Environment Configuration

**File**: `.env` - **Required Settings**

```bash
# ===========================================
# CORE AI PROVIDER CONFIGURATION
# ===========================================

# Ollama Configuration (Recommended for local AI)
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_TIMEOUT=110000

# LM Studio Configuration (Alternative local AI)  
LM_STUDIO_ENDPOINT=http://localhost:1234
LM_STUDIO_TIMEOUT=180000

# Model Configuration
MODEL_MAX_TOKENS=3000
MODEL_TEMPERATURE=0.7

# ===========================================
# MCP (MODEL CONTEXT PROTOCOL) CONFIGURATION
# ===========================================

# Smithery Registry API (Optional but recommended for external tools)
# Get your API key from: https://smithery.ai/registry
SMITHERY_API_KEY=your_smithery_api_key_here

# External MCP Server APIs (Optional)
MCP_TERMINAL_API_KEY=your_terminal_controller_api_key_here  
MCP_TASK_MANAGER_API_KEY=your_task_manager_api_key_here

# ===========================================
# SECURITY CONFIGURATION
# ===========================================

# Security Settings (Recommended: Keep strict for production)
STRICT_MODE=true
VALIDATE_INPUTS=true
ENABLE_RATE_LIMITING=true

# ===========================================
# PERFORMANCE CONFIGURATION  
# ===========================================

# Request Timeouts (milliseconds)
REQUEST_TIMEOUT=30000
TOOL_EXECUTION_TIMEOUT=30000
MEMORY_MONITORING_TIMEOUT=300000
CACHE_TTL=300000

# Concurrent Processing
MAX_CONCURRENT_REQUESTS=10
RESPONSE_CACHE_SIZE=100
MEMORY_WARNING_THRESHOLD=512

# ===========================================
# SERVER CONFIGURATION (Optional)
# ===========================================

# API Server Ports (for server mode)
SERVER_PORT=3002
INTERNAL_API_PORT=3000

# ===========================================
# DEVELOPMENT CONFIGURATION
# ===========================================

# Environment
NODE_ENV=development

# Logging
LOG_LEVEL=info
DEBUG_MODE=false

# ===========================================
# OPTIONAL INTEGRATIONS
# ===========================================

# E2B API (for secure code execution - Optional)
E2B_API_KEY=your_e2b_api_key_here
```

### 3. AI Provider Setup (Optional but Recommended)

#### 3.1 Ollama Setup (Recommended)

Ollama provides local AI models for enhanced privacy and performance.

**Installation**:
```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows (PowerShell as Administrator)
winget install Ollama.Ollama

# Alternative: Download from https://ollama.ai/download
```

**Model Installation**:
```bash
# Download coding-optimized models
ollama pull qwen2.5-coder:7b      # Fast, efficient coding model  
ollama pull deepseek-coder:8b     # Advanced reasoning model
ollama pull llama3.2:3b           # General purpose model

# Verify models are installed
ollama list
```

**Start Ollama Service**:
```bash
# Start Ollama service (runs on localhost:11434)
ollama serve

# Test connection
curl http://localhost:11434/api/tags
```

#### 3.2 LM Studio Setup (Alternative)

LM Studio provides a GUI for local model management.

**Installation**:
1. Download from https://lmstudio.ai/
2. Install and run LM Studio
3. Download models through LM Studio interface
4. Start local server (usually on localhost:1234)

**Configuration**:
```bash
# Update .env if using different port
LM_STUDIO_ENDPOINT=http://localhost:1234
```

### 4. External Service Configuration (Optional)

#### 4.1 Smithery Registry Setup

Smithery provides access to external MCP servers for enhanced tooling.

**Get API Key**:
1. Visit https://smithery.ai/registry
2. Create account and generate API key
3. Add to `.env`:
   ```bash
   SMITHERY_API_KEY=your_actual_api_key_here
   ```

**Benefits of Smithery Integration**:
- Access to 10+ external MCP servers
- Advanced tooling (terminal, task management, remote shells)
- Automatic server discovery and health monitoring
- Enhanced development capabilities

#### 4.2 E2B Code Execution (Optional)

E2B provides secure sandboxed code execution environments.

**Setup**:
1. Visit https://e2b.dev/
2. Create account and get API key
3. Add to `.env`:
   ```bash
   E2B_API_KEY=your_e2b_api_key_here
   ```

### 5. Configuration Validation

#### 5.1 Environment Validation Script

Create a validation script to test your configuration:

**File**: `scripts/validate-config.js`

```javascript
#!/usr/bin/env node
/**
 * Configuration Validation Script
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import axios from 'axios';

async function validateConfiguration() {
  console.log('🔍 Validating CodeCrucible Synth Configuration...\n');
  
  // Check .env file exists
  if (!existsSync('.env')) {
    console.log('❌ .env file not found. Run: cp .env.example .env');
    process.exit(1);
  }
  console.log('✅ .env file found');

  // Load environment variables
  const envContent = await readFile('.env', 'utf-8');
  const hasSmitheryKey = envContent.includes('SMITHERY_API_KEY=') && 
                        !envContent.includes('your_smithery_api_key_here');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion >= 18) {
    console.log(`✅ Node.js version: ${nodeVersion}`);
  } else {
    console.log(`❌ Node.js version ${nodeVersion} is too old. Require 18+`);
    process.exit(1);
  }

  // Test Ollama connection (optional)
  try {
    const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
    await axios.get(`${ollamaEndpoint}/api/tags`, { timeout: 5000 });
    console.log('✅ Ollama connection successful');
  } catch (error) {
    console.log('⚠️  Ollama not running (optional) - local AI models unavailable');
  }

  // Test LM Studio connection (optional)  
  try {
    const lmStudioEndpoint = process.env.LM_STUDIO_ENDPOINT || 'http://localhost:1234';
    await axios.get(`${lmStudioEndpoint}/v1/models`, { timeout: 5000 });
    console.log('✅ LM Studio connection successful');
  } catch (error) {
    console.log('⚠️  LM Studio not running (optional) - alternative AI provider unavailable');
  }

  // Check Smithery configuration
  if (hasSmitheryKey) {
    console.log('✅ Smithery API key configured');
  } else {
    console.log('⚠️  Smithery API key not configured (optional) - external MCP servers unavailable');
  }

  console.log('\n🎉 Configuration validation complete!');
  console.log('\nNext steps:');
  console.log('1. npm run build');
  console.log('2. npm run install-global');  
  console.log('3. crucible --version');
}

validateConfiguration().catch(console.error);
```

**Run Validation**:
```bash
node scripts/validate-config.js
```

### 6. Build and Installation Process

#### 6.1 Development Build
```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Verify build completed
ls -la dist/
```

#### 6.2 Global Installation  
```bash
# Link for global access
npm run install-global

# Alternative: Manual linking
npm link

# Verify global installation
which crucible    # Unix
where crucible    # Windows
```

#### 6.3 Verification Tests
```bash
# Test version
crucible --version

# Test help
crucible --help

# Test system status
crucible status

# Test basic functionality
crucible "Hello, can you help me?"

# Test interactive mode
crucible interactive
```

### 7. Advanced Configuration

#### 7.1 Voice System Configuration

The system includes 9 specialized AI voice archetypes. Configuration is in `config/voices.yaml`.

**Voice Types Available**:
- **Explorer**: Innovation and creative solutions
- **Maintainer**: Stability and long-term maintenance  
- **Analyzer**: Performance and architectural insights
- **Developer**: Developer experience and usability
- **Implementor**: Practical implementation and delivery
- **Security**: Secure coding practices
- **Architect**: Scalable architecture and design patterns
- **Designer**: UI/UX and user experience
- **Optimizer**: Performance and efficiency

**Preset Combinations**:
```yaml
# Security-focused analysis
security_review:
  voices: ["security", "maintainer", "analyzer"]
  
# Performance optimization
performance_optimization:
  voices: ["optimizer", "analyzer", "architect"]
  
# Complete analysis
full_council:
  voices: ["explorer", "maintainer", "analyzer", "developer", "security"]
```

#### 7.2 Security Policy Configuration

Security policies are configured in `config/security-policies.yaml`.

**Key Security Settings**:
- Input validation rules
- Command whitelist/blacklist
- Path access restrictions  
- Rate limiting configuration
- Authentication requirements

#### 7.3 MCP Server Configuration

MCP servers provide tool execution capabilities:

**Built-in MCP Servers**:
- **Filesystem**: File operations with security sandboxing
- **Git**: Repository operations with safety checks
- **Terminal**: Command execution with input filtering
- **Package Manager**: NPM operations with security scanning

**Configuration Options**:
```typescript
const mcpConfig: MCPServerConfig = {
  filesystem: { 
    enabled: true, 
    restrictedPaths: ['/etc', '/usr/bin'],
    allowedPaths: ['/home/user', '/workspace']
  },
  terminal: { 
    enabled: true, 
    allowedCommands: ['ls', 'git', 'npm'],
    blockedCommands: ['rm', 'sudo', 'curl']
  }
};
```

### 8. Production Environment Setup

#### 8.1 Production Environment Variables

**File**: `.env` (production settings)

```bash
# Production Configuration
NODE_ENV=production
LOG_LEVEL=warn
DEBUG_MODE=false

# Enhanced Security
STRICT_MODE=true
VALIDATE_INPUTS=true
ENABLE_RATE_LIMITING=true

# Performance Optimization
MAX_CONCURRENT_REQUESTS=20
RESPONSE_CACHE_SIZE=500
MEMORY_WARNING_THRESHOLD=1024

# Reduced Timeouts for Production
REQUEST_TIMEOUT=15000
TOOL_EXECUTION_TIMEOUT=15000
```

#### 8.2 Process Management

**Using PM2 (Recommended)**:
```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
echo 'module.exports = {
  apps: [{
    name: "codecrucible-synth",
    script: "dist/index.js",
    instances: 1,
    env: {
      NODE_ENV: "production"
    }
  }]
};' > ecosystem.config.js

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 8.3 Monitoring and Logging

**Log Configuration**:
```bash
# Production logging
LOG_LEVEL=info
DEBUG_MODE=false

# Log rotation (PM2)
pm2 install pm2-logrotate
```

**Health Monitoring**:
```bash
# System health endpoint (if running in server mode)
curl http://localhost:3002/health

# PM2 monitoring
pm2 monit
```

### 9. Troubleshooting Guide

#### 9.1 Common Issues

**Issue**: `Module not found` errors during build
```bash
# Solution: Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Issue**: `Permission denied` during global install
```bash
# Solution: Fix npm permissions or use alternative
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**Issue**: Ollama connection fails
```bash
# Solution: Verify Ollama is running
ollama serve
# Test connection
curl http://localhost:11434/api/tags
```

**Issue**: `[object Object]` in generated content
```bash
# Solution: This should be resolved by the implementation roadmap
# Verify legacy system cleanup completed
```

#### 9.2 Debug Mode

Enable debug mode for troubleshooting:

```bash
# Enable debug in .env
DEBUG_MODE=true
LOG_LEVEL=debug

# Run with verbose logging
crucible --verbose "test prompt"

# View detailed logs
tail -f ~/.npm-global/lib/node_modules/codecrucible-synth/logs/app.log
```

#### 9.3 Performance Issues

**Memory Usage**:
```bash
# Monitor memory
node --trace-gc dist/index.js

# Adjust memory limits
export NODE_OPTIONS="--max-old-space-size=4096"
```

**Response Time**:
```bash
# Test response time
time crucible "simple prompt"

# Check model provider connections
crucible status
```

### 10. Development Environment Setup

#### 10.1 Development Dependencies

```bash
# Install development tools
npm install -g typescript tsx nodemon

# Development with hot reload
npm run dev

# Run tests
npm test

# Lint and format
npm run lint
npm run format
```

#### 10.2 VS Code Configuration

**File**: `.vscode/settings.json`

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.suggest.autoImports": true,
  "files.associations": {
    "*.yaml": "yaml"
  }
}
```

**File**: `.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug CLI",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/index.js",
      "args": ["--verbose", "test prompt"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

---

## Configuration Summary

### Minimal Setup (Basic Functionality)
```bash
cp .env.example .env
# No external services required
npm install && npm run build && npm run install-global
```

### Recommended Setup (Full Functionality)  
```bash
cp .env.example .env
# Configure Ollama + Smithery API key
ollama serve && ollama pull qwen2.5-coder:7b
npm install && npm run build && npm run install-global
```

### Production Setup (Enterprise Deployment)
```bash
cp .env.example .env
# Configure all production settings
# Setup monitoring, logging, process management
npm install && npm run build
pm2 start ecosystem.config.js
```

**Final Result**: Complete environment setup supporting all features of the sophisticated CodeCrucible Synth system including multi-voice AI synthesis, MCP integration, enterprise security, and production-grade performance monitoring.