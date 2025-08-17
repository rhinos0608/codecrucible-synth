# Quick Start: Hybrid LLM Setup

## 5-Minute Setup Guide

Get CodeCrucible Synth's Hybrid LLM Architecture running in under 5 minutes.

## Prerequisites

- ✅ Windows 10/11 with admin privileges
- ✅ 16GB+ RAM (32GB recommended)
- ✅ NVIDIA GPU with 8GB+ VRAM (12GB+ recommended)
- ✅ Node.js 18+ installed

## Step 1: Install LM Studio (2 minutes)

1. **Download LM Studio**
   ```bash
   # Visit https://lmstudio.ai and download for Windows
   # Or use winget:
   winget install LMStudio.LMStudio
   ```

2. **Start LM Studio Server**
   - Launch LM Studio
   - Go to **Local Server** tab
   - Click **Start Server** 
   - Verify it's running on `http://localhost:1234`

3. **Download a Fast Model**
   - Go to **Search** tab
   - Download: `microsoft/DialoGPT-medium` or `TinyLlama-1.1B-Chat`
   - Load the model in the **Chat** tab

## Step 2: Verify Ollama (30 seconds)

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not installed, install Ollama:
# winget install Ollama.Ollama
# ollama serve
```

## Step 3: Setup CodeCrucible Synth (2 minutes)

```bash
# Clone and install
git clone https://github.com/your-repo/codecrucible-synth
cd codecrucible-synth
npm install

# Build with hybrid support
npm run build

# Test hybrid setup
node dist/index.js --fast "test hybrid setup"
```

## Step 4: Configure Hybrid Mode (30 seconds)

Create or update `config/hybrid.yaml`:

```yaml
hybrid:
  enabled: true
  lmStudio:
    endpoint: "http://localhost:1234"
    enabled: true
  ollama:
    endpoint: "http://localhost:11434" 
    enabled: true
  routing:
    escalationThreshold: 0.7
```

## Step 5: Test Everything (30 seconds)

```bash
# Test fast mode (should use LM Studio)
codecrucible --fast "create a React button component"

# Test complex mode (should use Ollama)  
codecrucible "analyze the architecture patterns in this codebase"

# Check status
codecrucible config hybrid --status
```

## Expected Output

### Fast Mode Test
```
🚀 Fast mode enabled - minimal initialization for immediate responses
✅ Fast generation complete (0.8s) 🔥 fresh

import React from 'react';

const Button = ({ children, onClick, className = '' }) => {
  return (
    <button 
      className={`btn ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;

💡 Generated React button component with props and styling
```

### Status Check
```
📊 Hybrid LLM Status:

LM Studio:
  ✅ Available at http://localhost:1234
  🔥 Model: microsoft/DialoGPT-medium
  ⚡ Avg Response: 0.8s
  📈 Tasks Handled: 156 (73%)

Ollama:  
  ✅ Available at http://localhost:11434
  🧠 Model: codellama:34b
  ⚡ Avg Response: 28.3s  
  📈 Tasks Handled: 58 (27%)

Routing:
  🎯 Accuracy: 94.2%
  📊 Escalation Rate: 4.8%
  🚀 Performance: 18.3x faster average
```

## Troubleshooting

### LM Studio Not Starting
```bash
# Check Windows Firewall
# Allow LM Studio through firewall

# Check port availability
netstat -an | findstr :1234

# Try different port
# In LM Studio: Settings > Server Port > 1235
```

### Models Not Loading
```bash
# Check available models
curl http://localhost:1234/v1/models

# Download a smaller model if out of VRAM
# Recommended: TinyLlama-1.1B (fits in 2GB)
```

### Poor Performance
```bash
# Check system resources
codecrucible system --vram-status

# Adjust concurrent limits
codecrucible config set hybrid.lmStudio.maxConcurrent 1
codecrucible config set hybrid.ollama.maxConcurrent 1
```

## Advanced Configuration

### Performance Tuning
```yaml
# For high-end systems (RTX 4090, 32GB+ RAM)
hybrid:
  lmStudio:
    maxConcurrent: 4
    models: ["codellama-13b", "qwen2.5-coder-7b"]
  ollama:
    maxConcurrent: 2
    models: ["codellama:34b", "qwen2.5:72b"]

# For mid-range systems (RTX 4070, 16-32GB RAM)  
hybrid:
  lmStudio:
    maxConcurrent: 2
    models: ["codellama-7b"]
  ollama:
    maxConcurrent: 1
    models: ["codellama:34b"]
```

### Custom Routing Rules
```yaml
hybrid:
  routing:
    rules:
      - if: "taskType == 'template'"
        use: "lmstudio" 
        confidence: 0.9
      - if: "complexity == 'complex'"
        use: "ollama"
        confidence: 0.95
      - if: "context.length > 5"
        use: "ollama"
        confidence: 0.8
```

## Usage Examples

### Development Workflow

```bash
# Morning routine: Start both services
lmstudio serve &  # In LM Studio GUI
ollama serve &

# Fast prototyping
codecrucible --fast "create API endpoint for user auth"
codecrucible --fast "add error handling to login function"

# Code review and analysis  
codecrucible "review this module for security issues"
codecrucible "suggest architecture improvements"

# Mixed workflow (auto-routing)
codecrucible "refactor this component and add TypeScript"
```

### Team Setup

```bash
# Shared configuration
git add config/hybrid.yaml
git commit -m "Add hybrid LLM configuration"

# Team setup script
./scripts/setup-hybrid-llm.ps1

# Verify team setup
codecrucible team --verify-hybrid
```

## Performance Expectations

| Task Type | Expected Time | Quality |
|-----------|---------------|---------|
| Templates | 0.5-2s | High |
| Quick Edits | 0.3-1s | High |
| Code Review | 25-45s | Excellent |
| Architecture | 35-60s | Excellent |
| Debugging | 20-40s | Excellent |

## Next Steps

1. **Customize Voice Preferences**: Configure which voices use which LLMs
2. **Setup Monitoring**: Enable performance metrics collection
3. **Optimize Models**: Download task-specific models for better performance
4. **Team Integration**: Share configuration across your development team
5. **Advanced Features**: Explore streaming, caching, and auto-tuning

## Support

- **Documentation**: See `Docs/Hybrid-LLM-Architecture.md` for detailed architecture
- **Implementation**: See `Docs/Hybrid-Implementation-Guide.md` for technical details  
- **Performance**: See `Docs/Performance-Benchmarks.md` for optimization tips
- **Issues**: Report problems in the GitHub repository

---

🎉 **You're now running the world's fastest local AI coding assistant!**

The hybrid architecture gives you sub-second responses for common tasks while maintaining the reasoning power of large models for complex operations.