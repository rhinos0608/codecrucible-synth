import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { logger } from '../logger.js';
import { AutonomousCodeReader } from './autonomous-code-reader.js';

/**
 * Tool that autonomously reads and analyzes codebase structure
 * Mimics behavior of modern AI coding assistants like Kilo Code
 */
export class ReadCodeStructureTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      path: z.string().optional().describe('Path to analyze (defaults to current directory)'),
      maxFiles: z.number().optional().default(50).describe('Maximum number of files to analyze'),
      includeContent: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include file content samples in output'),
    });

    super({
      name: 'readCodeStructure',
      description:
        'Autonomously read and analyze codebase structure, extracting key files, code definitions, and architectural patterns',
      category: 'Code Analysis',
      parameters,
    });
  }

  async execute(input: z.infer<typeof this.definition.parameters>): Promise<string> {
    try {
      logger.info('🔍 ReadCodeStructureTool: Starting autonomous codebase analysis');

      const projectPath = input.path || this.agentContext.workingDirectory;
      const reader = new AutonomousCodeReader(projectPath);

      // Configure reader based on input
      if (input.maxFiles) {
        (reader as any).maxFilesToRead = input.maxFiles;
      }

      const structure = await reader.analyzeCodeStructure();

      // Format comprehensive analysis result
      let result = `# 🔍 Autonomous Codebase Analysis

## 📋 Project Overview
- **Primary Language**: ${structure.overview.primaryLanguage}
- **Total Files**: ${structure.overview.totalFiles}
- **Frameworks**: ${structure.overview.frameworks.join(', ') || 'None detected'}
- **Build System**: ${structure.overview.buildSystem}
- **Package Manager**: ${structure.overview.packageManager || 'Unknown'}
- **Test Framework**: ${structure.overview.testFramework || 'None detected'}

## 📁 Key Files Analyzed (${structure.keyFiles.length} files)

`;

      // Show critical and high importance files
      const criticalFiles = structure.keyFiles.filter(f => f.importance === 'critical');
      const highFiles = structure.keyFiles.filter(f => f.importance === 'high');

      if (criticalFiles.length > 0) {
        result += `### 🎯 Critical Files:\n`;
        for (const file of criticalFiles) {
          result += `- **${file.path}** (${file.language}) - ${file.purpose}\n`;
          if (file.definitions && file.definitions.length > 0) {
            result += `  - Definitions: ${file.definitions.map(d => `${d.type} ${d.name}`).join(', ')}\n`;
          }
        }
        result += '\n';
      }

      if (highFiles.length > 0) {
        result += `### 📋 Important Files:\n`;
        for (const file of highFiles.slice(0, 10)) {
          result += `- **${file.path}** (${file.language}) - ${file.purpose}\n`;
        }
        result += '\n';
      }

      // Show code definitions
      if (structure.codeDefinitions.length > 0) {
        result += `## 🔧 Code Definitions (${structure.codeDefinitions.length} found)

`;

        // Group by type
        const definitionsByType = structure.codeDefinitions.reduce(
          (acc, def) => {
            if (!acc[def.type]) acc[def.type] = [];
            acc[def.type].push(def);
            return acc;
          },
          {} as Record<string, typeof structure.codeDefinitions>
        );

        for (const [type, defs] of Object.entries(definitionsByType)) {
          result += `### ${type}s:\n`;
          for (const def of defs.slice(0, 5)) {
            // Show top 5 per type
            result += `- **${def.name}** in \`${def.file}:${def.line}\`${def.isExported ? ' (exported)' : ''}\n`;
            if (def.signature) {
              result += `  \`\`\`\n  ${def.signature}\n  \`\`\`\n`;
            }
          }
          if (defs.length > 5) {
            result += `  ... and ${defs.length - 5} more\n`;
          }
          result += '\n';
        }
      }

      // Show dependencies
      const extDeps = Object.keys(structure.dependencies.external);
      const intDeps = Object.keys(structure.dependencies.internal);

      if (extDeps.length > 0 || intDeps.length > 0) {
        result += `## 🔗 Dependencies

### External Dependencies (${extDeps.length}):
${extDeps
  .slice(0, 10)
  .map(dep => `- ${dep}`)
  .join('\n')}
${extDeps.length > 10 ? `... and ${extDeps.length - 10} more` : ''}

### Internal Dependencies (${intDeps.length}):
${intDeps
  .slice(0, 5)
  .map(dep => `- ${dep}`)
  .join('\n')}
${intDeps.length > 5 ? `... and ${intDeps.length - 5} more` : ''}

`;
      }

      // Show architectural patterns
      if (structure.patterns.length > 0) {
        result += `## 🏗️ Architectural Patterns

`;
        for (const pattern of structure.patterns) {
          result += `### ${pattern.name} (${Math.round(pattern.confidence * 100)}% confidence)
${pattern.description}
- Files: ${pattern.files.slice(0, 5).join(', ')}${pattern.files.length > 5 ? ` ... and ${pattern.files.length - 5} more` : ''}

`;
        }
      }

      // Include file content samples if requested
      if (input.includeContent) {
        result += `## 📖 File Content Samples

`;

        const sampleFiles = structure.keyFiles
          .filter(f => f.content && f.type === 'source')
          .slice(0, 3);

        for (const file of sampleFiles) {
          result += `### ${file.path}
\`\`\`${file.language.toLowerCase()}
${file.content}
\`\`\`

`;
        }
      }

      result += `
---
*Analysis completed autonomously - analyzed ${structure.keyFiles.length} files and extracted ${structure.codeDefinitions.length} code definitions*`;

      logger.info(
        `✅ ReadCodeStructureTool: Analysis complete - ${structure.keyFiles.length} files, ${structure.codeDefinitions.length} definitions`
      );
      return result;
    } catch (error) {
      const errorMsg = `❌ ReadCodeStructureTool failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMsg, error);
      return errorMsg;
    }
  }
}
