# Configuration File Inventory

## Executive Summary
**CRITICAL CONFIGURATION CONFLICTS DETECTED**: The system has 6+ configuration files with overlapping concerns, creating unpredictable behavior and maintenance nightmares.

**Status**: 🔴 CRITICAL - Immediate resolution required

---

## Configuration File Analysis

### Primary Configuration Files

#### 1. `config/default.yaml` (146 lines)
- **Purpose**: Main application configuration with comprehensive settings
- **Scope**: Full system configuration including models, voices, MCP servers, performance, security
- **Key Sections**:
  - Model configuration (Ollama endpoint, models, timeout, tokens)
  - Voice system (default voices, parallel processing)
  - Safety and security settings
  - Terminal and VS Code integration
  - MCP server configuration (filesystem, git, terminal, packageManager)
  - Performance and context management
  - E2B code interpreter integration
  - Logging configuration
- **Status**: ✅ Complete and well-structured
- **Issues**: Conflicts with other files on model endpoints and timeouts

#### 2. `config/unified-model-config.yaml` (143 lines)
- **Purpose**: "Single source of truth" for model configuration (created to resolve conflicts)
- **Scope**: Comprehensive LLM provider configuration
- **Key Sections**:
  - Provider definitions (Ollama, LM Studio) with detailed settings
  - Routing strategies and task complexity mapping
  - Performance targets and monitoring
  - Security settings with blocked patterns
  - Caching configuration
  - Experimental features
- **Status**: ✅ Well-designed but conflicts with other files
- **Issues**: Overlaps with default.yaml and hybrid configs

#### 3. `codecrucible.config.json` (71 lines)
- **Purpose**: Legacy JSON-based configuration
- **Scope**: Models, agent, performance, security, features
- **Key Sections**:
  - Model definitions (GPT-4, Claude, local-llama)
  - Agent configuration
  - Performance monitoring
  - Security settings
  - Feature flags
- **Status**: ⚠️ Legacy format, conflicts with YAML configs
- **Issues**: Different timeout values, model definitions conflict with other files

#### 4. `config/hybrid.yaml` (38 lines)
- **Purpose**: Hybrid routing configuration for LM Studio + Ollama
- **Scope**: Routing logic and provider-specific settings
- **Key Sections**:
  - Routing configuration with escalation thresholds
  - LM Studio endpoint and models
  - Ollama endpoint and models with GPU settings
  - Performance optimization settings
- **Status**: ⚠️ Incomplete, conflicts with other model configs
- **Issues**: Different model lists, endpoint conflicts

#### 5. `config/hybrid-config.json` (67 lines)
- **Purpose**: Enhanced hybrid configuration with detailed performance settings
- **Scope**: Detailed hybrid provider configuration
- **Key Sections**:
  - LM Studio configuration with performance tuning
  - Ollama configuration with retry logic
  - Circuit breaker and fallback logic
  - Cache and timeout strategies
- **Status**: ⚠️ Redundant with hybrid.yaml, different settings
- **Issues**: Conflicts with hybrid.yaml on models and timeouts

#### 6. `config/optimized-model-config.json` (34 lines)
- **Purpose**: Performance-optimized model settings
- **Scope**: Model preloader and performance optimization
- **Key Sections**:
  - Model preloading configuration
  - Hybrid client optimization
  - Performance flags (fast mode, caching)
- **Status**: ⚠️ Limited scope, overlaps with other performance configs
- **Issues**: Different timeout values, overlapping performance settings

#### 7. `config/voices.yaml` (149 lines)
- **Purpose**: Voice archetype system configuration
- **Scope**: Voice definitions, synthesis modes, presets
- **Key Sections**:
  - Voice perspective definitions (explorer, maintainer, analyzer, etc.)
  - Voice role definitions (security, architect, designer, optimizer)
  - Synthesis modes (consensus, competitive, collaborative)
  - Task-specific voice combination presets
- **Status**: ✅ Well-structured, no conflicts detected
- **Issues**: None identified

---

## Configuration Loading System Analysis

### Current Loading Architecture

#### 1. **UnifiedConfigurationManager** (`src/domain/services/unified-configuration-manager.ts`)
- **Status**: ✅ Modern, hierarchical configuration system
- **Loading Order**: defaults → file → environment → CLI args
- **Features**: Validation, sanitization, event emission, file watching
- **Issues**: Only loads from single YAML file, ignores other config files

#### 2. **Legacy ConfigManager** (`src/config/config-manager.ts`)
- **Status**: ⚠️ Deprecated wrapper around UnifiedConfigurationManager
- **Purpose**: Backward compatibility during migration
- **Issues**: Creates confusion about which manager to use

#### 3. **Multiple Ad-hoc Loaders**
- Various components load configuration files directly without coordination
- No central registry of configuration sources
- Inconsistent error handling and validation

---

## Critical Conflicts Identified

### 🔴 **Model Endpoint Conflicts**
- `default.yaml`: Ollama at `http://localhost:11434`
- `codecrucible.config.json`: Ollama at `http://localhost:11434`  
- `hybrid.yaml`: Ollama at `http://localhost:11434`, LM Studio at `http://localhost:1234`
- `hybrid-config.json`: Same endpoints but different models and settings
- `unified-model-config.yaml`: Same endpoints but different model priorities

**Impact**: System behavior depends on which file loads first

### 🔴 **Model Lists Conflicts**
- `default.yaml`: `llama3.2:latest` as default
- `unified-model-config.yaml`: `qwen2.5-coder:7b` as preferred
- `hybrid.yaml`: `codellama:34b`, `gemma:latest`
- `hybrid-config.json`: `codellama-7b-instruct`, `gemma-3-12b`, `qwen2.5:7b`
- `codecrucible.config.json`: `llama2` model

**Impact**: Unpredictable model selection, failures when expected models unavailable

### 🔴 **Timeout Conflicts**
- `default.yaml`: 300000ms (5 minutes)
- `codecrucible.config.json`: 30000-60000ms (30s-1min)
- `unified-model-config.yaml`: 30000ms response, 5000ms connection
- `hybrid-config.json`: 180000ms request, 300000ms connection
- `optimized-model-config.json`: 60000-180000ms various timeouts

**Impact**: Inconsistent timeout behavior, some operations may fail unexpectedly

### 🔴 **Security Settings Conflicts**
- `default.yaml`: Comprehensive E2B security configuration
- `codecrucible.config.json`: Different security validation settings
- `unified-model-config.yaml`: Basic blocked patterns
- No clear precedence rules

**Impact**: Security inconsistencies, potential vulnerabilities

### 🔴 **Performance Settings Duplication**
- `default.yaml`: Response cache, voice parallelism, context management
- `codecrucible.config.json`: Performance monitoring, metrics
- `hybrid.yaml`: Cache settings, VRAM optimization
- `hybrid-config.json`: Circuit breakers, retry logic
- `optimized-model-config.json`: Fast mode, caching flags

**Impact**: Conflicting performance optimizations, resource waste

---

## Configuration Source Priority (Current State)

**No defined precedence order** - Different components load different files:

1. Some components use `UnifiedConfigurationManager` → loads from `~/.codecrucible/config.yaml`
2. Some components directly load `config/default.yaml`
3. Some components load `codecrucible.config.json`
4. Hybrid routing loads multiple files without coordination
5. Voice system loads `config/voices.yaml`

**Result**: Unpredictable behavior depending on component initialization order

---

## Impact Assessment

### 🔴 **Critical Issues**
1. **Unpredictable System Behavior**: Different components may use different settings
2. **Silent Failures**: Configuration conflicts may cause components to fail silently
3. **Debugging Difficulty**: No way to determine which config values are active
4. **Maintenance Nightmare**: Changes must be made in multiple files
5. **Security Risks**: Inconsistent security settings across components

### ⚠️ **High-Priority Issues**
1. **Performance Degradation**: Conflicting optimization settings
2. **Resource Waste**: Duplicate configuration loading and processing
3. **Development Confusion**: Developers don't know which file to modify
4. **Testing Complications**: Test behavior varies based on config loading order

### 📋 **Medium-Priority Issues**
1. **Documentation Gaps**: No clear guide on configuration precedence
2. **Migration Complexity**: Legacy systems still using old configuration methods
3. **Monitoring Blind Spots**: No visibility into which configurations are active

---

## Recommendations

### 1. **IMMEDIATE ACTIONS (Priority 1)**
- Create unified configuration loader that reads all files in defined precedence order
- Implement configuration conflict detection and warnings
- Add configuration source tracing to identify which file provides each setting

### 2. **SHORT-TERM ACTIONS (Priority 2)**
- Consolidate overlapping configuration sections into single authoritative files
- Implement configuration validation across all files
- Create configuration migration tool to convert legacy formats

### 3. **LONG-TERM ACTIONS (Priority 3)**
- Establish single configuration file format standard
- Implement live configuration reloading with conflict resolution
- Create configuration management UI for complex settings

---

## Files Requiring Immediate Attention

### 🔴 **Critical Priority**
1. `config/default.yaml` - Primary configuration, needs conflict resolution
2. `config/unified-model-config.yaml` - "Single source" that isn't actually single
3. `codecrucible.config.json` - Legacy format causing conflicts

### ⚠️ **High Priority**  
4. `config/hybrid.yaml` - Incomplete, conflicts with hybrid-config.json
5. `config/hybrid-config.json` - Redundant with hybrid.yaml
6. Configuration loading logic in `UnifiedConfigurationManager`

### 📋 **Medium Priority**
7. `config/optimized-model-config.json` - Performance settings cleanup
8. Legacy configuration references throughout codebase