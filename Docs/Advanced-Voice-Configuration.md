# Advanced Voice Configuration Guide

## Overview

This guide details how to implement advanced voice configurations in CodeCrucible Synth, inspired by the orchestration capabilities of `llm-orc`. These features will enable more complex, multi-step workflows and improve the reusability of voice configurations.

## 1. Voice Dependencies

### Concept

The concept of voice dependencies allows you to define a specific order of execution for voices in a council. This is useful for tasks that require a sequence of operations, such as:

1.  **Analyzer** reviews the code.
2.  **Security** voice reviews the code, taking the Analyzer's output as context.
3.  **Implementor** voice generates new code based on the analysis from the previous two voices.

### Implementation

We will introduce a `depends_on` key in the `voices.yaml` configuration file.

**File**: `config/voices.yaml` (modified)

```yaml
explorer:
  temperature: 0.9
  systemPrompt: |
    You are Explorer, a voice focused on innovation and creative solutions.
    Always consider alternative approaches and edge cases.
    Encourage experimentation and novel techniques.
  style: "experimental"

maintainer:
  temperature: 0.5
  systemPrompt: |
    You are Maintainer, focused on code stability and long-term maintenance.
    Prioritize robustness, documentation, and conventional approaches.
    Consider future maintenance burden in all recommendations.
  style: "conservative"
  depends_on: explorer # Maintainer will run after explorer

security:
  temperature: 0.3
  systemPrompt: |
    You are Security, focused on secure coding practices.
    Always include input validation, error handling, and security considerations.
    Flag potential vulnerabilities and suggest security best practices.
  style: "defensive"
  depends_on: maintainer # Security will run after maintainer
```

### Orchestration Logic

The `LivingSpiralCoordinator` will be updated to handle these dependencies.

**File**: `src/domain/services/living-spiral-coordinator.ts` (modified)

```typescript
import { DepGraph } from 'dependency-graph';

// ... existing class ...

class LivingSpiralCoordinator {
  // ... existing methods ...

  async coordinateCouncil(voices: string[], prompt: string, context: any): Promise<any> {
    const voiceConfig = this.configManager.get('voices');
    const depGraph = new DepGraph<string>();

    // Build dependency graph
    for (const voice of voices) {
      depGraph.addNode(voice);
      if (voiceConfig[voice]?.depends_on) {
        const dependency = voiceConfig[voice].depends_on;
        if (voices.includes(dependency)) {
          depGraph.addDependency(voice, dependency);
        }
      }
    }

    // Get execution order
    const executionOrder = depGraph.overallOrder();
    let accumulatedContext = context;
    const finalResponses = {};

    for (const voiceName of executionOrder) {
      const voice = this.voices[voiceName];
      const response = await voice.generate(prompt, accumulatedContext);
      finalResponses[voiceName] = response;
      accumulatedContext = this.updateContext(accumulatedContext, response);
    }

    return this.synthesizeResponses(finalResponses);
  }

  private updateContext(context: any, newResponse: any): any {
    // Append the new response to the context for the next voice
    return {
      ...context,
      previous_responses: [...(context.previous_responses || []), newResponse],
    };
  }
}
```

## 2. Voice Council Library

### Concept

A voice council library allows you to define and reuse pre-configured sets of voices for common tasks. For example, you could have a `web-dev-council` for web development tasks and a `data-analysis-council` for data science tasks.

### Implementation

We will introduce a new `councils.yaml` file to define these libraries.

**File**: `config/councils.yaml` (new)

```yaml
councils:
  default:
    - explorer
    - maintainer
    - security

  web-dev-council:
    - developer
    - react-agent
    - security

  data-analysis-council:
    - analyzer
    - python-expert # Assuming a new voice for python
    - data-engineer
```

### CLI Integration

The CLI will be updated to allow users to select a council from the library.

**File**: `src/application/cli/program.ts` (modified)

```typescript
// ... existing class ...

class CodeCrucibleCLI {
  // ... existing methods ...

  async processPrompt(prompt: string, options: CLIOptions): Promise<string> {
    // ...

    let voices = options.voices;
    if (options.council) {
      const councils = this.configManager.get('councils');
      if (councils[options.council]) {
        voices = councils[options.council];
      } else {
        return `Council '${options.council}' not found.`;
      }
    }

    // ...
  }
}
```

### New CLI Option

The CLI will now accept a `--council` option.

```bash
# Use the default council
cc "My prompt"

# Use a specific council from the library
cc --council web-dev-council "Create a new React component"
```

## 3. Dynamic Voice Loading

### Concept

To support a growing library of voices and councils, we can dynamically load voice configurations from a `voices` directory.

### Implementation

**Directory Structure**:

```
config/
├── voices/
│   ├── core/
│   │   ├── explorer.yaml
│   │   └── maintainer.yaml
│   └── web/
│       ├── developer.yaml
│       └── react-agent.yaml
├── councils.yaml
└── default.yaml
```

The `ConfigManager` will be updated to load all `.yaml` files from the `config/voices` directory.

**File**: `src/config/config-manager.ts` (modified)

```typescript
// ... existing class ...

class ConfigManager {
  // ... existing methods ...

  loadVoices() {
    const voices = {};
    const voiceDirs = ['core', 'web', 'data']; // Example directories

    for (const dir of voiceDirs) {
      const dirPath = path.join(this.configDir, 'voices', dir);
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          if (file.endsWith('.yaml')) {
            const voiceName = path.basename(file, '.yaml');
            const voiceConfig = this.loadConfig(path.join(dirPath, file));
            voices[voiceName] = voiceConfig;
          }
        }
      }
    }
    this.set('voices', voices);
  }
}
```

This guide provides a clear path to implementing advanced voice configurations, making CodeCrucible Synth a more powerful and flexible AI coding assistant.
