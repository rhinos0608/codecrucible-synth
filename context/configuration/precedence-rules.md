# Configuration Precedence Rules

## Executive Summary
**CRITICAL ISSUE**: No defined precedence rules exist for configuration loading. System behavior is unpredictable and depends on component initialization order, creating potential system failures and debugging nightmares.

**Proposed Solution**: Establish clear hierarchical configuration loading with conflict resolution and source tracing.

---

## Current State Analysis

### Existing Loading Patterns (Chaotic)

#### 1. **UnifiedConfigurationManager** Pattern
```typescript
// From: src/domain/services/unified-configuration-manager.ts
loadConfiguration(): Promise<UnifiedConfiguration> {
  let config = this.getDefaultConfiguration();           // Priority 0
  config = this.mergeConfigurations(config, await this.loadFromFile());      // Priority 10
  config = this.mergeConfigurations(config, this.loadFromEnvironment());     // Priority 20  
  config = this.mergeConfigurations(config, this.loadFromCliArgs());        // Priority 30
}
```

**Issues**: 
- Only loads from single file (`~/.codecrucible/config.yaml`)
- Ignores all project-specific configuration files
- No conflict detection or validation

#### 2. **Direct File Loading** Pattern
```typescript
// Multiple components directly load specific files:
await loadYAML('config/default.yaml');
await loadJSON('codecrucible.config.json');  
await loadYAML('config/hybrid.yaml');
// No coordination, last-loaded wins
```

**Issues**:
- No precedence rules
- Race conditions determine final values
- Silent conflicts

#### 3. **Legacy ConfigManager** Pattern
```typescript
// From: src/config/config-manager.ts (deprecated)
async loadConfiguration(): Promise<AppConfig> {
  const unified = this.unifiedManager.getConfiguration();
  return this.convertToLegacyFormat(unified);  // Loses information
}
```

**Issues**:
- Converts between incompatible schemas
- Data loss during conversion
- Maintains deprecated interfaces

---

## Proposed Unified Precedence Hierarchy

### 1. **Configuration Source Priority (Lowest to Highest)**

#### **Level 0: System Defaults** (Base Layer)
```yaml
# Hardcoded in UnifiedConfigurationManager.getDefaultConfiguration()
source: "system-defaults"
precedence: 0
immutable: true
purpose: "Fallback values ensuring system always works"
```

#### **Level 10: Global Configuration** 
```yaml
# File: ~/.codecrucible/config.yaml (user home directory)
source: "global-user-config"  
precedence: 10
scope: "All CodeCrucible instances for this user"
purpose: "User preferences across projects"
```

#### **Level 20: Project Default Configuration**
```yaml
# File: config/default.yaml (project root)
source: "project-defaults"
precedence: 20  
scope: "Project-wide defaults"
purpose: "Project-specific base configuration"
```

#### **Level 25: Specialized Configuration Files**
```yaml
# Files: config/voices.yaml, config/model-config.yaml, etc.
source: "specialized-config"
precedence: 25
scope: "Domain-specific settings" 
purpose: "Detailed configuration for specific subsystems"
merge_strategy: "deep_merge"  # Don't replace, merge into defaults
```

#### **Level 30: Environment-Specific Configuration**
```yaml  
# Files: config/development.yaml, config/production.yaml, config/testing.yaml
source: "environment-config"
precedence: 30
condition: "NODE_ENV or CC_ENVIRONMENT matches filename"
purpose: "Environment-specific overrides"
```

#### **Level 40: Local Override Configuration**
```yaml
# File: config/local.yaml (gitignored, developer-specific)
source: "local-overrides"
precedence: 40
scope: "Developer workstation overrides"  
purpose: "Local development customization"
version_control: false
```

#### **Level 50: Environment Variables**
```yaml
source: "environment-variables"
precedence: 50
pattern: "CC_*, CODECRUCIBLE_*, OLLAMA_*, SMITHERY_*"
purpose: "Runtime environment configuration"
examples:
  - "CC_LOG_LEVEL=debug"
  - "OLLAMA_ENDPOINT=http://remote:11434"
  - "SMITHERY_API_KEY=sk-..."
```

#### **Level 60: Command-Line Arguments**
```yaml
source: "cli-arguments"  
precedence: 60
scope: "Single execution override"
purpose: "Runtime parameter overrides"
examples:
  - "--verbose"
  - "--model=qwen2.5-coder:7b" 
  - "--no-cache"
  - "--timeout=120000"
```

#### **Level 70: Runtime Configuration Updates**
```yaml
source: "runtime-updates"
precedence: 70
scope: "Dynamic configuration changes"
purpose: "Live configuration updates via API or UI"
persistence: "optional"  # May or may not be saved to file
```

---

### 2. **File Discovery and Loading Order**

#### **Phase 1: Global Discovery**
1. Check for `~/.codecrucible/config.yaml`
2. Load global user preferences
3. Establish baseline configuration

#### **Phase 2: Project Discovery** 
1. Scan `config/` directory for configuration files
2. Load `config/default.yaml` as project base
3. Discover specialized configuration files:
   ```
   config/
   ├── voices.yaml          # Voice system configuration  
   ├── model-config.yaml    # Unified model configuration
   ├── security.yaml        # Security policies
   ├── performance.yaml     # Performance tuning
   ├── development.yaml     # Development environment
   ├── production.yaml      # Production environment  
   ├── testing.yaml         # Testing environment
   └── local.yaml           # Local overrides (gitignored)
   ```

#### **Phase 3: Environment-Specific Loading**
1. Detect current environment (`NODE_ENV`, `CC_ENVIRONMENT`)
2. Load matching environment file (`config/{environment}.yaml`)
3. Apply environment-specific overrides

#### **Phase 4: Runtime Sources**
1. Process environment variables with `CC_*`, `CODECRUCIBLE_*` prefixes
2. Parse command-line arguments
3. Apply highest-precedence overrides

---

### 3. **Merge Strategy Rules**

#### **Simple Override (Default)**
```typescript
// Higher precedence completely replaces lower precedence
base_config.model.timeout = 30000;     // Level 20: project defaults
env_config.model.timeout = 60000;      // Level 50: environment variables  
// Result: timeout = 60000 (environment wins)
```

#### **Deep Merge (Arrays and Objects)**
```typescript
// Arrays: Merge and deduplicate
base_config.model.models = ['llama3.2:latest'];
specialized_config.model.models = ['qwen2.5-coder:7b', 'deepseek-coder:8b'];
// Result: models = ['llama3.2:latest', 'qwen2.5-coder:7b', 'deepseek-coder:8b']

// Objects: Merge keys, higher precedence wins on conflicts
base_config.security.allowedCommands = ['ls', 'cat'];
local_config.security.allowedCommands = ['ls', 'cat', 'npm'];  
// Result: allowedCommands = ['ls', 'cat', 'npm']
```

#### **Additive Merge (Specific Cases)**
```typescript
// Voice configurations: Add new voices, merge existing
base_voices = { explorer: {...}, maintainer: {...} };
project_voices = { security: {...}, architect: {...} };
// Result: All four voices available with merged configurations
```

---

### 4. **Conflict Resolution Rules**

#### **Validation Before Merge**
```typescript
interface ConflictResolution {
  strategy: 'override' | 'merge' | 'validate' | 'warn' | 'error';
  validator?: (base: any, override: any) => ValidationResult;
  resolver?: (base: any, override: any) => any;
}

// Example: Model timeout conflicts
const modelTimeoutResolution: ConflictResolution = {
  strategy: 'validate',
  validator: (base, override) => ({
    valid: override >= 1000 && override <= 600000,  // 1s to 10min
    message: override < 1000 ? 'Timeout too low' : 'Timeout too high',
    suggestion: Math.max(1000, Math.min(override, 600000))
  }),
  resolver: (base, override) => ({
    value: override,
    source: getSourceInfo(override),
    validation: 'passed'
  })
};
```

#### **Critical Setting Protection**
```typescript
// Some settings require explicit confirmation to override
const protectedSettings = {
  'security.enableSandbox': {
    protection: 'require_explicit',
    reason: 'Security critical setting',
    override_method: 'environment_variable_CC_DISABLE_SANDBOX=true'
  },
  'model.endpoints': {
    protection: 'validate_connectivity', 
    reason: 'Must verify endpoint availability',
    validator: async (endpoint) => await testConnection(endpoint)
  }
};
```

---

### 5. **Source Tracing and Debugging**

#### **Configuration Provenance Tracking**
```typescript
interface ConfigurationSource {
  value: any;
  source: string;           // File path or source type
  precedence: number;       // Priority level
  timestamp: Date;          // When loaded
  checksum?: string;        // File integrity
  line_number?: number;     // For YAML/JSON files
  environment?: string;     // Which env this applies to
}

// Example result:
{
  "model.timeout": {
    "value": 60000,
    "source": "environment-variable:CC_MODEL_TIMEOUT", 
    "precedence": 50,
    "timestamp": "2025-08-27T10:30:00Z",
    "overrides": [
      {
        "value": 30000,
        "source": "/path/to/config/default.yaml:7",
        "precedence": 20
      }
    ]
  }
}
```

#### **Debug Mode Configuration Tracing**
```bash
# Enable configuration debugging
CC_CONFIG_DEBUG=true node dist/index.js status

# Output:
Configuration Loading Summary:
✓ Level 0: System defaults (47 settings)
✓ Level 20: config/default.yaml (89 settings, 3 overrides)
✓ Level 25: config/voices.yaml (12 settings, 0 overrides)  
✓ Level 25: config/model-config.yaml (23 settings, 8 overrides)
⚠ Level 30: config/development.yaml (not found)
✓ Level 50: Environment variables (4 settings, 2 overrides)
✓ Level 60: CLI arguments (1 setting, 0 overrides)

Conflicts Resolved:
⚠ model.timeout: 30000 → 60000 (environment variable override)
⚠ model.defaultModel: "llama3.2:latest" → "qwen2.5-coder:7b" (model-config.yaml)
✓ voices.maxConcurrent: 3 → 3 (no conflict)

Active Configuration Sources:
- 47 settings from system defaults
- 81 settings from config/default.yaml  
- 12 settings from config/voices.yaml
- 15 settings from config/model-config.yaml
- 4 settings from environment variables
- 1 setting from CLI arguments
```

---

### 6. **File Format Standards**

#### **Unified Schema Structure**
All configuration files must follow this structure:

```yaml
# File header with metadata
metadata:
  version: "1.0"
  description: "Project default configuration"
  last_modified: "2025-08-27"
  applies_to: ["development", "testing"]  # Optional environment filter
  precedence_level: 20  # Explicit precedence declaration

# Core configuration sections (all optional)
app:
  name: "CodeCrucible Synth"
  version: "4.0.7"
  environment: "development"
  log_level: "info"

model:
  default_provider: "ollama"
  providers: [ ... ]
  timeout: 30000
  
security:
  enable_sandbox: true
  security_level: "medium"
  
performance:
  max_concurrent_requests: 3
  enable_caching: true

voices:
  default_voices: ["explorer", "developer"]
  available_voices: [ ... ]

# ... other sections
```

#### **Environment Variable Naming Convention**
```bash
# Pattern: CC_{SECTION}_{SETTING}
CC_APP_LOG_LEVEL=debug
CC_MODEL_DEFAULT_PROVIDER=ollama  
CC_MODEL_TIMEOUT=60000
CC_SECURITY_ENABLE_SANDBOX=false
CC_PERFORMANCE_MAX_CONCURRENT_REQUESTS=5

# Special prefixes for external services  
OLLAMA_ENDPOINT=http://localhost:11434
SMITHERY_API_KEY=sk-...
E2B_API_KEY=...
```

#### **CLI Argument Standards**
```bash
# Boolean flags
--verbose, --no-verbose
--cache, --no-cache  
--sandbox, --no-sandbox

# Value parameters  
--model=qwen2.5-coder:7b
--timeout=60000
--log-level=debug
--environment=production

# Complex parameters (JSON)
--model-config='{"provider":"ollama","timeout":60000}'
```

---

### 7. **Migration Strategy**

#### **Phase 1: Backward Compatibility (Week 1)**
1. Implement new UnifiedConfigurationLoader
2. Support existing file formats during transition
3. Add configuration source tracing
4. Log warnings for conflicts but don't break existing behavior

#### **Phase 2: Conflict Resolution (Week 2)**  
1. Add conflict detection and warning system
2. Implement merge strategies for known conflicts
3. Create configuration validation framework
4. Add debug mode for configuration tracing

#### **Phase 3: Schema Unification (Week 3)**
1. Migrate existing files to unified schema
2. Deprecate legacy configuration patterns  
3. Add configuration migration tools
4. Update documentation and examples

#### **Phase 4: Enforcement (Week 4)**
1. Make conflict resolution strict (errors instead of warnings)
2. Remove legacy configuration loading code
3. Enable advanced features (live reloading, UI configuration)
4. Add configuration monitoring and alerting

---

### 8. **Implementation Requirements**

#### **New UnifiedConfigurationLoader Class**
```typescript
class UnifiedConfigurationLoader {
  async loadConfiguration(): Promise<ConfigurationResult> {
    const sources = await this.discoverConfigurationSources();
    const configurations = await this.loadAllSources(sources);
    const merged = await this.mergeWithPrecedence(configurations);
    const validated = await this.validateConfiguration(merged);
    const traced = this.addSourceTracing(validated, sources);
    return traced;
  }

  private async discoverConfigurationSources(): Promise<ConfigurationSource[]>;
  private async loadAllSources(sources: ConfigurationSource[]): Promise<LoadedConfiguration[]>;
  private async mergeWithPrecedence(configs: LoadedConfiguration[]): Promise<UnifiedConfiguration>;
  private async validateConfiguration(config: UnifiedConfiguration): Promise<ValidationResult>;
  private addSourceTracing(config: UnifiedConfiguration, sources: ConfigurationSource[]): ConfigurationResult;
}
```

#### **Configuration Validation Framework**
```typescript
interface ConfigurationValidator {
  validateSection(section: string, config: any): ValidationResult;
  validateConflicts(base: any, override: any): ConflictResolution;
  validateEnvironment(config: UnifiedConfiguration): EnvironmentValidation;
  validateSecurity(config: UnifiedConfiguration): SecurityValidation;
}
```

#### **Debug and Monitoring Tools**  
```typescript
interface ConfigurationDebugger {
  traceConfigValue(keyPath: string): ConfigurationTrace;
  listActiveConfigurations(): ConfigurationSummary;
  validateCurrentConfiguration(): ValidationReport;  
  detectConflicts(): ConflictReport;
  exportEffectiveConfiguration(): UnifiedConfiguration;
}
```

---

## Success Metrics

### **Conflict Resolution**
- ✅ 0 configuration conflicts after implementation
- ✅ 100% configuration source traceability  
- ✅ <100ms configuration loading time
- ✅ Comprehensive validation coverage

### **Developer Experience**
- ✅ Single command to debug configuration issues
- ✅ Clear documentation of precedence rules
- ✅ Automatic conflict detection and resolution
- ✅ Live configuration reloading capability

### **System Reliability**
- ✅ Predictable configuration behavior
- ✅ Graceful handling of invalid configurations
- ✅ Rollback capability for configuration changes
- ✅ Configuration change audit trail

This precedence system will eliminate the current configuration chaos and provide a solid foundation for reliable system operation.