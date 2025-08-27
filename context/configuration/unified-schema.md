# Unified Configuration Schema

## Executive Summary
**SOLUTION ARCHITECTURE**: Comprehensive unified configuration schema that consolidates 6+ configuration files into a single, coherent structure with full backward compatibility and conflict resolution.

**Implementation Status**: 🟡 DESIGN COMPLETE - Ready for implementation

---

## Master Configuration Schema

### 1. **Configuration File Structure**

```yaml
# ============================================================================
# CodeCrucible Synth - Unified Configuration Schema v1.0
# ============================================================================
# This is the master schema that replaces all existing configuration files:
# - config/default.yaml
# - codecrucible.config.json  
# - config/unified-model-config.yaml
# - config/hybrid.yaml
# - config/hybrid-config.json
# - config/optimized-model-config.json
# ============================================================================

# Configuration metadata (required)
metadata:
  version: "1.0"                           # Schema version for validation
  description: "CodeCrucible Synth Configuration"
  created: "2025-08-27"
  last_modified: "2025-08-27"
  precedence_level: 20                     # File precedence (0-70)
  applies_to: ["development", "production", "testing"]  # Environment filter
  config_id: "unified-master"              # Unique identifier
  checksum: "auto-generated"               # File integrity hash

# ============================================================================
# APPLICATION CONFIGURATION
# ============================================================================
app:
  name: "CodeCrucible Synth"               # Application name
  version: "4.0.7"                         # Version number
  environment: "development"               # development | production | testing
  log_level: "info"                        # debug | info | warn | error
  debug_mode: false                        # Enable debug features
  telemetry_enabled: true                  # Usage analytics
  
  # Application features
  features:
    enable_voice_system: true              # Multi-voice analysis
    enable_council_engine: true            # Council decision making
    enable_hybrid_models: true             # Multiple model providers
    enable_mcp_integration: true           # Model Context Protocol
    enable_streaming: true                 # Real-time response streaming
    enable_caching: true                   # Response caching
    enable_monitoring: true               # Performance monitoring

# ============================================================================
# MODEL CONFIGURATION - UNIFIED PROVIDER SYSTEM
# ============================================================================
model:
  # Default provider selection and fallback chain
  default_provider: "ollama"               # Primary provider
  fallback_chain: ["ollama", "lm-studio", "openai"]  # Failover sequence
  execution_mode: "auto"                   # auto | fast | thorough | custom
  
  # Global model settings
  temperature: 0.7                         # Default creativity (0.0-2.0)
  max_tokens: 128000                       # Maximum response tokens
  context_window: "adaptive"               # adaptive | fixed:N
  timeout: 30000                          # Request timeout (milliseconds)
  max_retries: 3                          # Retry attempts on failure
  streaming_enabled: true                  # Enable token streaming
  
  # Provider definitions
  providers:
    # Ollama configuration
    - name: "ollama"
      type: "ollama"
      enabled: true
      priority: 1                          # Lower = higher priority
      endpoint: "http://localhost:11434"
      
      # Connection settings
      connection:
        timeout: 5000                      # Connection timeout (ms)
        keep_alive: "15m"                  # Model memory retention
        max_concurrent: 2                  # Concurrent requests
        
      # Available models with specific settings
      models:
        preferred:                         # Try these first
          - name: "qwen2.5-coder:7b"
            temperature: 0.1
            max_tokens: 128000
            context_window: 128000
            optimal_for: ["coding", "analysis", "debugging"]
          - name: "deepseek-coder:8b" 
            temperature: 0.2
            max_tokens: 128000
            context_window: 128000
            optimal_for: ["architecture", "review", "planning"]
            
        fallback:                          # Use if preferred unavailable
          - name: "llama3.2:latest"
            temperature: 0.7
            max_tokens: 128000
          - name: "gemma:latest"
            temperature: 0.6
            max_tokens: 64000
            
      # Task routing preferences
      optimal_for:
        - "analysis"
        - "planning" 
        - "complex"
        - "multi-file"
        - "architecture"
        - "debugging"
        - "code-review"
        
      # GPU configuration
      gpu:
        enabled: true
        layers: -1                         # -1 = use all GPU layers
        memory_fraction: 0.85             # GPU memory utilization
        
    # LM Studio configuration  
    - name: "lm-studio"
      type: "lm-studio"
      enabled: true
      priority: 2
      endpoint: "http://localhost:1234"
      
      connection:
        timeout: 3000
        max_concurrent: 3
        streaming_enabled: true
        
      models:
        preferred:
          - name: "codellama-7b-instruct"
            temperature: 0.5
            max_tokens: 128000
            optimal_for: ["template", "boilerplate", "quick-fix"]
          - name: "gemma-2b-it"
            temperature: 0.7
            max_tokens: 64000
            optimal_for: ["formatting", "simple-edits"]
            
        fallback:
          - name: "qwen/qwen2.5-coder-14b"
            temperature: 0.3
            max_tokens: 128000
            
      optimal_for:
        - "template"
        - "edit" 
        - "format"
        - "boilerplate"
        - "quick-fix"
        - "streaming"
        
    # OpenAI configuration (optional)
    - name: "openai"
      type: "openai"
      enabled: false                       # Disabled by default
      priority: 3
      endpoint: "https://api.openai.com/v1"
      api_key: "${OPENAI_API_KEY}"        # Environment variable
      
      models:
        preferred:
          - name: "gpt-4"
            temperature: 0.7
            max_tokens: 4096
            optimal_for: ["complex-reasoning", "documentation"]
            
      optimal_for:
        - "complex-reasoning"
        - "documentation"
        - "explanation"
  
  # Task complexity routing
  routing:
    strategy: "hybrid"                     # simple | hybrid | complex | custom
    
    # Task classification
    task_complexity:
      simple:                              # Use fast providers
        - "format"
        - "template" 
        - "boilerplate"
        - "simple-edit"
        - "rename"
      moderate:                           # Use standard providers
        - "function-analysis"
        - "code-review"
        - "bug-fix"
        - "optimization"
      complex:                            # Use powerful providers
        - "architecture"
        - "system-design"
        - "multi-file-analysis"
        - "debugging"
        - "security-audit"
        
    # Confidence thresholds for routing decisions
    confidence_thresholds:
      high: 0.9                          # Use fast path
      medium: 0.7                        # Standard routing  
      low: 0.5                           # Require validation
      escalation: 0.3                    # Human intervention
      
    # Performance targets
    performance_targets:
      simple_task_response: 2000         # 2s for simple tasks
      complex_task_response: 30000       # 30s for complex tasks
      streaming_first_token: 200         # 200ms for first token

# ============================================================================
# SECURITY CONFIGURATION
# ============================================================================
security:
  # Security level enforcement
  security_level: "medium"                # low | medium | high | maximum
  enable_sandbox: true                    # Enable E2B sandboxing
  enable_input_sanitization: true        # Sanitize all inputs
  enable_output_validation: true         # Validate all outputs
  enable_audit_logging: true             # Log security events
  
  # Input/output limits
  max_input_length: 100000               # Maximum input characters
  max_output_length: 100000              # Maximum output characters
  max_file_size: "10MB"                  # Maximum file upload size
  
  # E2B Sandboxing configuration  
  e2b:
    api_key: "${E2B_API_KEY}"            # API key from environment
    enabled: true                         # Enable sandboxed execution
    enforce_only: true                   # Block unsafe local execution
    default_environment: "base"          # Default sandbox environment
    session_timeout: 3600000             # 1 hour session timeout
    max_concurrent_sessions: 10          # Concurrent sandbox limit
    
    # Resource limits per sandbox
    resource_limits:
      memory: "512MB"                    # Memory limit
      cpu: "0.5"                         # CPU cores
      disk_space: "1GB"                 # Disk space limit
      execution_timeout: 30000           # Max execution time (ms)
      
    # Sandbox security policies
    security_policies:
      allow_network_access: false        # Block network in sandbox
      allow_file_system_write: true      # Allow controlled file ops
      allow_process_spawning: false      # Block process spawning
      validate_code: true                # Validate code before execution
      block_unsafe_patterns: true       # Block dangerous patterns
      
  # Command execution controls
  command_execution:
    allowed_commands:                    # Whitelist of safe commands
      - "ls"
      - "cat" 
      - "head"
      - "tail"
      - "grep"
      - "find"
      - "git"
      - "npm"
      - "node" 
      - "python"
      - "pip"
      - "mkdir"
      - "touch"
      
    blocked_commands:                    # Blacklist of dangerous commands
      - "rm -rf"
      - "sudo"
      - "su" 
      - "chmod +x"
      - "eval"
      - "exec"
      - "curl"
      - "wget"
      
    require_consent:                     # Commands requiring user approval
      - "delete"
      - "execute"
      - "install"
      - "modify-system"
      
  # File system restrictions
  file_system:
    allowed_paths:                       # Paths accessible to system
      - "${PWD}"                         # Current project directory
      - "~/"                            # User home directory
      - "/tmp"                          # Temporary directory
      
    restricted_paths:                    # Paths blocked from access
      - "/etc"
      - "/usr" 
      - "/bin"
      - "/sys"
      - "/proc"
      
  # Pattern-based security filters
  blocked_patterns:
    - "password"
    - "secret"
    - "api_key"
    - "private_key"
    - "token"
    - "credential"

# ============================================================================
# VOICE SYSTEM CONFIGURATION  
# ============================================================================
voices:
  # Default voice selection
  default_voices: ["explorer", "maintainer", "developer"]
  
  # All available voice archetypes
  available_voices:
    - "explorer"                         # Innovation and creativity
    - "maintainer"                       # Stability and best practices  
    - "analyzer"                         # Performance and patterns
    - "developer"                        # Developer experience
    - "implementor"                      # Practical delivery
    - "security"                         # Security engineering
    - "architect"                        # System design
    - "designer"                         # UI/UX focus
    - "optimizer"                        # Performance engineering
    - "guardian"                         # Quality gates
    
  # Voice system behavior
  parallel_voices: true                  # Enable parallel processing
  max_concurrent_voices: 3               # Concurrent voice limit
  enable_council_mode: true              # Enable council decision making
  council_decision_threshold: 0.7        # Agreement threshold for decisions
  
  # Voice-specific configurations
  voice_settings:
    explorer:
      temperature: 0.9                   # High creativity
      style: "experimental"
      strengths: ["innovation", "alternatives", "edge-cases"]
      
    maintainer:
      temperature: 0.5                   # Conservative approach
      style: "conservative" 
      strengths: ["stability", "maintenance", "best-practices"]
      
    security:
      temperature: 0.3                   # Low risk tolerance
      style: "defensive"
      strengths: ["security", "validation", "threat-modeling"]
      
  # Task-specific voice combinations
  voice_presets:
    security_review:
      voices: ["security", "maintainer", "analyzer"]
      synthesis_mode: "consensus"
      
    performance_optimization:
      voices: ["optimizer", "analyzer", "architect"] 
      synthesis_mode: "competitive"
      
    ui_component:
      voices: ["designer", "developer", "maintainer"]
      synthesis_mode: "collaborative"
      
    api_design:
      voices: ["architect", "security", "developer"]
      synthesis_mode: "collaborative"
      
    full_council:
      voices: ["explorer", "maintainer", "analyzer", "developer", "security"]
      synthesis_mode: "competitive"

# ============================================================================
# PERFORMANCE CONFIGURATION
# ============================================================================
performance:
  # Request handling
  max_concurrent_requests: 3             # System-wide concurrency limit
  request_queue_size: 10                 # Max queued requests
  default_timeout: 30000                 # Default request timeout (ms)
  fast_mode_max_tokens: 1000            # Fast mode token limit
  
  # Memory management  
  enable_memory_optimization: true       # Enable memory optimization
  memory_threshold_mb: 512               # Memory usage threshold
  garbage_collection_interval: 30000     # GC interval (ms)
  
  # Caching configuration
  caching:
    enabled: true                        # Enable response caching
    strategy: "lru"                      # Cache eviction strategy
    max_cache_size: 1000                # Max cached responses
    cache_ttl: 300000                   # Cache time-to-live (ms)
    cache_compression: true             # Compress cached data
    
    # Cache categories
    cache_categories:
      model_responses:
        ttl: 300000                     # 5 minutes
        max_size: 500                   # Max cached responses
        
      file_analysis:
        ttl: 600000                     # 10 minutes  
        max_size: 200
        
      voice_synthesis:
        ttl: 180000                     # 3 minutes
        max_size: 100
  
  # Hardware acceleration
  hardware:
    enable_gpu_acceleration: true        # Use GPU when available
    prefer_gpu: true                    # Prefer GPU over CPU
    gpu_memory_fraction: 0.8            # GPU memory utilization
    
  # Monitoring and metrics
  monitoring:
    enable_metrics: true                # Collect performance metrics
    enable_tracing: false               # Distributed tracing
    enable_profiling: false             # Performance profiling
    metrics_retention: 86400000         # 24 hours
    health_check_interval: 30000        # Health check frequency
    
    # Alert thresholds
    alerts:
      error_rate_threshold: 0.05        # 5% error rate
      response_time_p99: 5000           # 5s response time
      memory_usage_threshold: 0.85      # 85% memory usage
      availability_threshold: 0.95      # 95% availability

# ============================================================================
# TOOLS AND MCP CONFIGURATION
# ============================================================================
tools:
  # Tool discovery and loading
  enable_tool_discovery: true            # Auto-discover tools
  tool_directories:                      # Tool search paths
    - "./tools"
    - "~/.codecrucible/tools"
    
  # Tool execution
  enable_parallel_execution: true       # Parallel tool execution
  max_concurrent_tools: 2               # Concurrent tool limit
  default_tool_timeout: 30000          # Tool execution timeout
  enable_tool_sandboxing: true         # Sandbox tool execution
  tool_security_level: "medium"        # Tool security enforcement
  
  # Model Context Protocol (MCP) servers
  mcp:
    enable_mcp_servers: true            # Enable MCP integration
    
    # Built-in MCP servers
    servers:
      filesystem:
        enabled: true
        name: "Filesystem MCP Server"
        type: "filesystem"
        config:
          allowed_paths: ["${PWD}"]
          restricted_paths: ["/etc", "/sys", "/proc"]
          max_file_size: "10MB"
          
      git:
        enabled: true  
        name: "Git MCP Server"
        type: "git"
        config:
          auto_commit_messages: false
          safe_mode_enabled: true
          allowed_operations: ["status", "diff", "log", "add", "commit"]
          
      terminal:
        enabled: true
        name: "Terminal MCP Server" 
        type: "terminal"
        config:
          allowed_commands: ["ls", "cat", "grep", "find", "git", "npm", "node", "python"]
          blocked_commands: ["rm -rf", "sudo", "su", "chmod +x"]
          execution_timeout: 30000
          
      package_manager:
        enabled: true
        name: "Package Manager MCP Server"
        type: "package-manager"
        config:
          auto_install: false
          security_scan: true
          allowed_registries: ["npmjs.org", "pypi.org"]
    
    # External MCP servers (Smithery integration)
    external:
      enabled: true
      smithery:
        enabled: false                  # Disabled by default
        api_key: "${SMITHERY_API_KEY}" # Environment variable
        auto_discovery: true           # Auto-discover servers
        base_url: "https://server.smithery.ai"
        
        # Pre-configured external servers
        servers:
          terminal_controller:
            enabled: false              # Disabled by default for security
            url: "https://server.smithery.ai/@GongRzhe/terminal-controller-mcp/mcp"
            
          task_manager:
            enabled: false
            url: "https://server.smithery.ai/@kazuph/mcp-taskmanager/mcp"
            
          remote_shell:
            enabled: false              # High security risk
            url: "https://server.smithery.ai/@samihalawa/remote-shell-terminal-mcp/mcp"
      
      # Security policies for external servers
      security:
        validate_commands: true         # Validate all external commands
        allow_remote_execution: false   # Block remote execution
        require_user_approval: true     # Require approval for actions
        audit_external_calls: true     # Log all external server calls

# ============================================================================
# INFRASTRUCTURE CONFIGURATION  
# ============================================================================
infrastructure:
  # Database configuration
  database:
    type: "sqlite"                      # sqlite | postgres | mysql
    path: "~/.codecrucible/data.db"   # Database file path
    in_memory: false                   # Use in-memory database
    enable_migrations: true           # Auto-apply schema migrations
    connection_pool_size: 10           # Connection pool size
    query_timeout: 30000              # Query timeout (ms)
    
  # Real-time streaming
  streaming:
    enabled: true                      # Enable streaming responses
    buffer_size: 1024                 # Stream buffer size
    flush_interval: 100               # Buffer flush interval (ms) 
    chunk_size: 256                   # Response chunk size
    timeout: 5000                     # Streaming timeout (ms)
    compression: true                 # Compress streamed data
    
  # System monitoring
  monitoring:
    enable_metrics: true              # Collect system metrics
    enable_tracing: false             # Distributed tracing
    enable_profiling: false           # Performance profiling
    health_check_interval: 30000      # Health check frequency
    metrics_port: 3001                # Metrics endpoint port
    
    # Monitoring integrations
    integrations:
      prometheus:
        enabled: false
        endpoint: "/metrics"
        
      grafana:
        enabled: false
        dashboard_url: ""
        
  # External service integrations
  integrations:
    # Smithery AI registry
    smithery:
      enabled: false                  # Disabled by default
      api_key: "${SMITHERY_API_KEY}" 
      auto_discovery: false
      servers: []
      
    # E2B Code Interpreter
    e2b:
      enabled: true
      api_key: "${E2B_API_KEY}"
      default_environment: "base"
      
    # VS Code integration
    vscode:
      auto_activate: true             # Auto-activate extension
      inline_generation: true        # Enable inline code generation
      show_voice_panel: true          # Show voice selection panel
      
  # Logging configuration
  logging:
    level: "info"                     # debug | info | warn | error
    format: "json"                    # json | text
    output: ["console", "file"]       # Output destinations
    file_path: "~/.codecrucible/logs/app.log"
    max_file_size: "10MB"            # Log rotation size
    max_files: 5                     # Max log files to keep
    
    # Log categories
    categories:
      application: "info"
      security: "warn"
      performance: "info" 
      mcp_servers: "warn"
      voice_system: "info"

# ============================================================================
# ENVIRONMENT-SPECIFIC OVERRIDES
# ============================================================================
# These sections are only applied when the corresponding environment is active

development:
  app:
    log_level: "debug"
    debug_mode: true
    telemetry_enabled: false
    
  model:
    timeout: 60000                    # Longer timeout for development
    
  performance:
    enable_profiling: true            # Enable profiling in dev
    
  security:
    security_level: "medium"          # Relaxed security for dev
    
production:
  app:
    log_level: "warn"
    debug_mode: false
    telemetry_enabled: true
    
  model:
    timeout: 30000                    # Standard timeout for production
    
  security:
    security_level: "high"            # Strict security for production
    enable_audit_logging: true
    
  performance:
    enable_metrics: true              # Full monitoring in production
    enable_tracing: true
    
testing:
  app:
    log_level: "error"                # Minimal logging for tests
    
  model:
    timeout: 10000                    # Fast timeout for tests
    
  performance:
    enable_caching: false             # Disable caching for tests
    
  infrastructure:
    database:
      in_memory: true                 # In-memory DB for tests
```

---

## Schema Validation Rules

### 1. **Required Fields Validation**
```typescript
interface SchemaValidation {
  required_fields: {
    "metadata.version": "string",
    "metadata.precedence_level": "number",
    "app.name": "string",
    "app.environment": "development | production | testing",
    "model.default_provider": "string",
    "model.providers": "array[Provider]"
  },
  
  optional_fields: {
    "voices.*": "VoiceConfiguration",
    "security.*": "SecurityConfiguration",
    "performance.*": "PerformanceConfiguration",
    "tools.*": "ToolConfiguration",
    "infrastructure.*": "InfrastructureConfiguration"
  }
}
```

### 2. **Data Type Validation**
```typescript
interface TypeValidation {
  string_patterns: {
    "*.endpoint": /^https?:\/\/[\w\-\.]+(:\d+)?$/,
    "*.api_key": /^(sk-|pk_test_|pk_live_|env:|\${[A-Z_]+}).*$/,
    "app.environment": /^(development|production|testing)$/,
    "app.log_level": /^(debug|info|warn|error)$/
  },
  
  numeric_ranges: {
    "*.timeout": { min: 1000, max: 600000 },        // 1s to 10min
    "*.precedence_level": { min: 0, max: 70 },       // Precedence range
    "model.temperature": { min: 0.0, max: 2.0 },    // Model temperature
    "performance.max_concurrent_requests": { min: 1, max: 20 }
  },
  
  array_constraints: {
    "model.fallback_chain": { min_length: 1, unique: true },
    "voices.default_voices": { min_length: 1, max_length: 10 },
    "security.allowed_commands": { min_length: 1, unique: true }
  }
}
```

### 3. **Cross-Field Validation**
```typescript
interface CrossFieldValidation {
  consistency_rules: {
    // Provider in fallback_chain must exist in providers
    "model.fallback_chain": (config) => {
      const providerNames = config.model.providers.map(p => p.name);
      return config.model.fallback_chain.every(name => providerNames.includes(name));
    },
    
    // Default voices must exist in available voices  
    "voices.default_voices": (config) => {
      return config.voices.default_voices.every(voice => 
        config.voices.available_voices.includes(voice)
      );
    },
    
    // Security level must match environment
    "security.security_level": (config) => {
      const envSecurityMap = {
        "production": ["medium", "high", "maximum"],
        "development": ["low", "medium", "high"],
        "testing": ["low", "medium"]
      };
      return envSecurityMap[config.app.environment]?.includes(config.security.security_level);
    }
  }
}
```

---

## Migration Mapping

### 1. **File Consolidation Map**
```typescript
const MigrationMap = {
  // Source files → Unified schema sections
  "config/default.yaml": {
    "model.*": "model",
    "voices.*": "voices", 
    "safety.*": "security",
    "performance.*": "performance",
    "mcp.*": "tools.mcp",
    "e2b.*": "security.e2b",
    "logging.*": "infrastructure.logging"
  },
  
  "codecrucible.config.json": {
    "models.*": "model.providers",
    "agent.*": "performance",
    "security.*": "security",
    "features.*": "app.features"
  },
  
  "config/unified-model-config.yaml": {
    "llm.*": "model"
  },
  
  "config/hybrid.yaml": {
    "hybrid.*": "model",
    "lmStudio.*": "model.providers[lm-studio]",
    "ollama.*": "model.providers[ollama]"
  },
  
  "config/voices.yaml": {
    "perspectives.*": "voices.voice_settings",
    "roles.*": "voices.voice_settings",
    "synthesis.*": "voices",
    "presets.*": "voices.voice_presets"
  }
};
```

### 2. **Value Transformation Rules**
```typescript
const TransformationRules = {
  // Timeout values: normalize to milliseconds
  timeouts: {
    from: ["300000", "5m", "5 minutes", "300s"],
    to: 300000,
    transform: (value) => parseTimeToMs(value)
  },
  
  // Boolean strings: normalize to boolean
  booleans: {
    from: ["true", "false", "yes", "no", "1", "0"],
    to: boolean,
    transform: (value) => parseBooleanValue(value)
  },
  
  // Model names: normalize format
  model_names: {
    from: ["qwen2.5-coder:7b", "qwen2.5-coder-7b", "qwen2.5_coder_7b"],
    to: "qwen2.5-coder:7b",
    transform: (value) => normalizeModelName(value)
  }
};
```

### 3. **Conflict Resolution Strategies**
```typescript
const ConflictResolution = {
  // Model timeout conflicts
  "model.timeout": {
    strategy: "validate_range",
    range: [1000, 600000],
    default_resolution: "use_higher_precedence",
    fallback: 30000
  },
  
  // Concurrency conflicts
  "performance.max_concurrent_requests": {
    strategy: "validate_system_capacity",
    validator: (value) => value <= getSystemConcurrencyLimit(),
    default_resolution: "use_conservative_value",
    fallback: 2
  },
  
  // Security level conflicts  
  "security.security_level": {
    strategy: "use_stricter",
    priority_order: ["maximum", "high", "medium", "low"],
    environment_constraints: {
      "production": ["medium", "high", "maximum"],
      "development": ["low", "medium", "high"]
    }
  }
};
```

---

## Implementation Guide

### 1. **Configuration Loading Process**
```typescript
class UnifiedConfigurationManager {
  async loadConfiguration(): Promise<UnifiedConfiguration> {
    // Phase 1: Load and validate schema
    const schema = await this.loadSchemaDefinition();
    
    // Phase 2: Discover configuration sources
    const sources = await this.discoverConfigurationSources();
    
    // Phase 3: Load all sources with precedence
    const configurations = await this.loadAllSources(sources);
    
    // Phase 4: Merge with conflict resolution
    const merged = await this.mergeWithPrecedence(configurations);
    
    // Phase 5: Validate against schema
    const validated = await this.validateAgainstSchema(merged, schema);
    
    // Phase 6: Apply environment-specific overrides
    const final = await this.applyEnvironmentOverrides(validated);
    
    return final;
  }
}
```

### 2. **Schema Validation Implementation**
```typescript
class ConfigurationValidator {
  validateSchema(config: any, schema: ConfigurationSchema): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Required field validation
    this.validateRequiredFields(config, schema, errors);
    
    // Type validation
    this.validateDataTypes(config, schema, errors);
    
    // Range validation  
    this.validateRanges(config, schema, warnings);
    
    // Cross-field validation
    this.validateCrossFields(config, schema, errors);
    
    // Environment-specific validation
    this.validateEnvironmentConstraints(config, warnings);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: errors.length === 0 ? config : this.applySanitization(config, errors)
    };
  }
}
```

### 3. **Migration Tool Implementation**
```typescript
class ConfigurationMigrator {
  async migrateFromLegacyFiles(): Promise<MigrationResult> {
    // Discover legacy configuration files
    const legacyFiles = await this.discoverLegacyFiles();
    
    // Load and parse legacy configurations  
    const legacyConfigs = await this.loadLegacyConfigurations(legacyFiles);
    
    // Transform to unified schema
    const unifiedConfig = await this.transformToUnifiedSchema(legacyConfigs);
    
    // Validate transformed configuration
    const validation = await this.validateConfiguration(unifiedConfig);
    
    // Generate migration report
    const report = this.generateMigrationReport(legacyFiles, unifiedConfig, validation);
    
    return {
      unifiedConfiguration: unifiedConfig,
      migrationReport: report,
      backupPaths: await this.createBackups(legacyFiles),
      isValid: validation.isValid
    };
  }
}
```

---

## Benefits of Unified Schema

### 1. **Immediate Benefits**
- ✅ **Single Source of Truth**: All configuration in one coherent structure
- ✅ **Conflict Elimination**: Built-in conflict detection and resolution
- ✅ **Type Safety**: Comprehensive validation prevents runtime errors
- ✅ **Environment Support**: Clean separation of environment-specific settings

### 2. **Development Benefits**  
- ✅ **Developer Experience**: Clear documentation of all configuration options
- ✅ **IDE Support**: Full IntelliSense and validation in configuration files
- ✅ **Debugging**: Easy tracing of configuration values to source
- ✅ **Testing**: Predictable configuration behavior in tests

### 3. **Operational Benefits**
- ✅ **Deployment Reliability**: Configuration validation prevents deployment failures
- ✅ **Security Compliance**: Built-in security policy enforcement
- ✅ **Performance Optimization**: Optimized configuration loading and caching
- ✅ **Monitoring**: Configuration change tracking and audit trails

### 4. **Maintenance Benefits**
- ✅ **Schema Evolution**: Versioned schema with migration support
- ✅ **Documentation**: Self-documenting configuration structure  
- ✅ **Backward Compatibility**: Graceful handling of legacy configurations
- ✅ **Future-Proofing**: Extensible structure for new features

This unified schema provides the foundation for reliable, maintainable, and secure configuration management across the entire CodeCrucible Synth system.