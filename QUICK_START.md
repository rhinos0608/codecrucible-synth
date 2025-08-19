# 🚀 CodeCrucible Synth - Quick Start Guide

## ✅ **Working Installation Methods (Available NOW)**

### 🥇 **Method 1: Git-based Installation (Recommended - Works Immediately)**

**Windows (PowerShell):**
```powershell
iwr -useb https://raw.githubusercontent.com/rhinos0608/codecrucibe-synth/main/install-from-git.ps1 | iex
```

**Unix/macOS (Bash):**
```bash
curl -sSL https://raw.githubusercontent.com/rhinos0608/codecrucibe-synth/main/install-from-git.sh | bash
```

### 🥈 **Method 2: Manual Installation**
```bash
git clone https://github.com/rhinos0608/codecrucibe-synth.git
cd codecrucibe-synth
npm install && npm run build
npm link  # Makes 'crucible' command available globally
crucible --help
```

### 🥉 **Method 3: npm (After Successful Publishing)**
```bash
npm install -g codecrucible-synth
crucible
```

## 🎯 **Quick Test**

After installation, try these commands:
```bash
crucible --help                    # Show all commands
crucible agent                     # Start agentic mode (like Claude Code)
crucible desktop                   # Launch GUI application
```

## 🔥 **Key Features You Get**

✅ **Progressive Model Pulling** - Handles timeouts with intelligent fallbacks  
✅ **Real-Time File Watching** - Automatic contextual assistance as you code  
✅ **Multi-Voice AI System** - 9 specialized AI voices with synthesis engine  
✅ **Autonomous Setup** - Zero-configuration with auto-detection  
✅ **GPU Acceleration** - NVIDIA CUDA, AMD ROCm, Apple Metal support  
✅ **Cross-Platform** - Windows, macOS, Linux compatibility  
✅ **Local & Offline** - Complete privacy with Ollama integration  

## 🛠️ **What's Fixed**

- ✅ **Model Timeout Issues** - Progressive fallback system with 4 tiers
- ✅ **Windows Shell Compatibility** - Fixed spawn errors  
- ✅ **Real-Time File Watching** - Implemented with chokidar
- ✅ **Autonomous Error Recovery** - Intelligent model switching
- ✅ **One-Liner Installation** - Multiple working methods

## 📋 **Next Steps**

1. **Try the Git-based installation** (works immediately)
2. **Test the agentic mode**: `crucible agent`
3. **Explore voice synthesis**: `crucible --voices competitive`
4. **Launch desktop GUI**: `crucible desktop`

The system now fully addresses your original request with working one-liner installation and robust model timeout handling! 🎉