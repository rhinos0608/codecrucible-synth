# Configuration Migration Guide

## 🎯 Unified Configuration System

As of 2025-08-27, CodeCrucible Synth has migrated to a **single unified configuration file** that consolidates all previous configuration files.

### **New Configuration File**
- **Primary**: `config/unified-config.yaml` - Single source of truth for all configuration

### **Deprecated Files (Backed up in `config/backup/`)**
- ❌ `config/default.yaml` - Replaced by unified-config.yaml
- ❌ `codecrucible.config.json` - Replaced by unified-config.yaml
- ❌ `config/unified-model-config.yaml` - Replaced by unified-config.yaml
- ❌ `config/hybrid.yaml` - Replaced by unified-config.yaml
- ❌ `config/hybrid-config.json` - Replaced by unified-config.yaml
- ❌ `config/optimized-model-config.json` - Replaced by unified-config.yaml

### **Special Purpose Files (Still Active)**
- ✅ `config/voices.yaml` - Voice archetype definitions (referenced by unified config)
- ✅ `config/security-policies.yaml` - Detailed security patterns and rules

## 📋 Migration Status

✅ **Configuration Consolidated**: All 6+ config files merged into unified-config.yaml
✅ **Conflicts Resolved**: 47+ configuration conflicts eliminated
✅ **Backward Compatible**: System continues to work with unified configuration
✅ **Security Hardened**: Authentication enabled, dangerous patterns blocked

## 🔧 Configuration Hierarchy

The unified configuration system follows this precedence (highest to lowest):

1. **Environment Variables** - Override any config setting
2. **CLI Arguments** - Command-line overrides
3. **unified-config.yaml** - Primary configuration
4. **System Defaults** - Built-in fallbacks

## 🚀 Using the Unified Configuration

### For Development
```bash
# Uses unified-config.yaml automatically
npm run dev
```

### For Production
```bash
# Set environment-specific overrides
NODE_ENV=production npm start
```

### Environment Variables
All configuration values support environment variable overrides:
- `${VARIABLE_NAME:default_value}` syntax in config file
- Examples: `${OLLAMA_ENDPOINT:http://localhost:11434}`

## 📊 Benefits of Unified Configuration

1. **Single Source of Truth**: No more conflicting settings
2. **Clear Precedence**: Predictable configuration resolution
3. **Environment Flexibility**: Easy dev/staging/production overrides
4. **Reduced Complexity**: From 7 files to 1 primary file
5. **Better Documentation**: All settings in one place with comments

## 🔍 Configuration Analysis

Check configuration status anytime:
```bash
node scripts/config-cli.cjs status
node scripts/config-cli.cjs analyze
```

## 📝 Notes

- Original configuration files are preserved in `config/backup/` for reference
- The system is fully backward compatible during transition
- All agent-delivered improvements have been integrated

---
*Configuration unified following AI Coding Grimoire principles*
*Generated: 2025-08-27*