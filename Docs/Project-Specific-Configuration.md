# Project-Specific Configuration Guide

## Overview

This guide explains how to implement project-specific configuration files in CodeCrucible Synth. This feature allows you to override global configurations on a per-project basis, making the tool more flexible and adaptable to different development environments.

## 1. Concept

Currently, CodeCrucible Synth uses a global configuration directory (e.g., `~/.config/codecrucible/`). We will introduce a new feature to search for a `.codecrucible` directory in the current project's root. If found, any configuration files within this directory will be merged with the global configuration, with project-specific settings taking precedence.

## 2. Configuration Loading Order

The configuration will be loaded in the following order:

1.  **Global Configuration**: `~/.config/codecrucible/`
2.  **Project-Specific Configuration**: `your-project/.codecrucible/`

This ensures that project-specific settings override global ones.

## 3. Implementation

We will modify the `ConfigManager` to search for and load project-specific configurations.

**File**: `src/config/config-manager.ts` (modified)

```typescript
import * as path from 'path';
import * as fs from 'fs';
import { merge } from 'lodash'; // Using lodash for deep merging

// ... existing class ...

class ConfigManager {
  private globalConfigDir: string;
  private projectConfigDir: string | null;

  constructor() {
    this.globalConfigDir = path.join(process.env.HOME || '', '.config', 'codecrucible');
    this.projectConfigDir = this.findProjectConfig();
    this.load();
  }

  private findProjectConfig(): string | null {
    let currentDir = process.cwd();
    while (currentDir !== path.parse(currentDir).root) {
      const configDir = path.join(currentDir, '.codecrucible');
      if (fs.existsSync(configDir)) {
        return configDir;
      }
      currentDir = path.dirname(currentDir);
    }
    return null;
  }

  load() {
    const globalConfig = this.loadConfigFromDir(this.globalConfigDir);
    let finalConfig = globalConfig;

    if (this.projectConfigDir) {
      const projectConfig = this.loadConfigFromDir(this.projectConfigDir);
      finalConfig = merge({}, globalConfig, projectConfig); // Deep merge
    }

    this.config = finalConfig;
  }

  private loadConfigFromDir(dirPath: string): any {
    const config = {};
    const files = ['default.yaml', 'hybrid.yaml', 'voices.yaml', 'councils.yaml'];

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      if (fs.existsSync(filePath)) {
        const fileConfig = this.loadConfig(filePath);
        merge(config, fileConfig);
      }
    }
    return config;
  }

  // ... rest of the class
}
```

## 4. Usage

### Global Configuration

Your global configuration in `~/.config/codecrucible/voices.yaml` might look like this:

```yaml
maintainer:
  temperature: 0.5
  style: "conservative"
```

### Project-Specific Configuration

In your project, you can create a `.codecrucible` directory and add a `voices.yaml` file to override or extend the global configuration.

**File**: `my-web-project/.codecrucible/voices.yaml`

```yaml
maintainer:
  temperature: 0.7 # Override global temperature
  style: "web-focused" # Override global style

developer: # Add a new voice for this project
  temperature: 0.8
  systemPrompt: "You are a web developer..."
```

When you run `cc` from within `my-web-project`, the `ConfigManager` will merge these configurations. The `maintainer` voice will use the project-specific settings, and the `developer` voice will be available in addition to the globally defined voices.

## 5. CLI Command for Configuration Status

To help users understand which configuration is being used, we can add a new CLI command.

**File**: `src/core/cli.ts` (modified)

```typescript
// ... existing class ...

class CodeCrucibleCLI {
  // ... existing methods ...

  async showConfigStatus() {
    const configManager = this.context.configManager;
    console.log('Configuration Status:\n');
    console.log(`Global Config: ${configManager.globalConfigDir}`);
    if (configManager.projectConfigDir) {
      console.log(`Project Config: ${configManager.projectConfigDir}`);
      console.log('\nProject-specific settings are overriding global settings.');
    } else {
      console.log('No project-specific configuration found.');
    }
  }
}
```

### New CLI Command

```bash
# Display the configuration status
cc config --status
```

This guide provides a clear framework for implementing project-specific configurations, enhancing the flexibility and usability of CodeCrucible Synth in diverse development environments.
