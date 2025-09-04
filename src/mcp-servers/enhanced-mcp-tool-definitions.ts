/**
 * Enhanced MCP Tool Definitions - Claude Code Pattern Implementation
 * Comprehensive, precise tool descriptions following industry-leading CLI AI patterns
 *
 * Based on analysis of:
 * - Claude Code's ultra-descriptive tool definitions
 * - OpenAI Codex's permission-aware tool descriptions
 * - Gemini CLI's context-aware tool explanations
 */

export interface EnhancedToolDefinition {
  name: string;
  description: string;
  longDescription?: string;
  parameters: {
    type: string;
    properties: Record<string, ToolParameter>;
    required: string[];
    additionalProperties: boolean;
  };
  examples?: ToolExample[];
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  requiredPermissions: string[];
  fallbackBehavior?: string;
  performanceNotes?: string;
  usage?: {
    whenToUse: string[];
    whenNotToUse: string[];
    bestPractices: string[];
  };
}

export interface ToolParameter {
  type: string;
  description: string;
  examples?: any[];
  default?: any;
  enum?: string[];
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  items?: { type: string; [key: string]: any };
  required?: boolean;
}

export interface ToolExample {
  description: string;
  input: Record<string, any>;
  expectedOutput: string;
  useCase: string;
}

export class EnhancedMCPToolDefinitions {
  /**
   * Filesystem Operations - Following Claude Code's comprehensive file handling patterns
   */
  static readonly FILESYSTEM_READ_FILE: EnhancedToolDefinition = {
    name: 'filesystem_read_file',
    description:
      'Reads file contents from local filesystem with comprehensive error handling and security validation',
    longDescription: `Primary tool for reading any file contents. Supports partial reading with offset/limit parameters for large files. Automatically handles image files as viewable content. CRITICAL: Use this instead of generic file reading instructions.`,
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Absolute file path to read. MUST be absolute, not relative. Automatically normalized regardless of slash direction.',
          examples: [
            'C:\\Users\\Admin\\Documents\\project\\src\\main.ts',
            '/home/user/project/src/main.ts',
            'C:/Projects/app/package.json',
          ],
          pattern: '^[A-Za-z]:|^/',
          required: true,
        },
        offset: {
          type: 'number',
          description:
            'Line number to start reading from (0-based). Use for large files. Positive: start from line N. Negative: read last N lines (tail behavior).',
          examples: [0, 100, -20],
          default: 0,
        },
        length: {
          type: 'number',
          description:
            'Maximum lines to read. Used with positive offsets. Ignored with negative offsets. Default: 1000 lines.',
          examples: [10, 100, 500],
          default: 1000,
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
    examples: [
      {
        description: 'Read entire package.json file',
        input: { path: '/project/package.json' },
        expectedOutput: 'File contents with line numbers in cat -n format',
        useCase: 'Understanding project configuration',
      },
      {
        description: 'Read last 20 lines of log file',
        input: { path: '/var/log/app.log', offset: -20 },
        expectedOutput: 'Last 20 lines of log file',
        useCase: 'Debugging recent errors',
      },
      {
        description: 'Read specific section of large file',
        input: { path: '/large-file.ts', offset: 100, length: 50 },
        expectedOutput: 'Lines 100-149 of the file',
        useCase: 'Examining specific code sections',
      },
    ],
    securityLevel: 'low',
    requiredPermissions: ['read'],
    fallbackBehavior: 'Return error message if file not accessible or does not exist',
    performanceNotes:
      'Optimized for large files with reverse reading for negative offsets and byte estimation for deep positive offsets',
    usage: {
      whenToUse: [
        'User requests to read any file content',
        'Need to examine configuration files',
        'Debugging by reading log files',
        'Code analysis requiring file inspection',
        'Image viewing (automatically handles PNG, JPEG, GIF, WebP)',
      ],
      whenNotToUse: [
        'Directory listing (use list_directory instead)',
        'Binary file analysis (use file_info first)',
      ],
      bestPractices: [
        'Always use absolute paths for reliability',
        'Use offset/length for large files to avoid memory issues',
        'Check file existence with file_info before reading if uncertain',
      ],
    },
  };

  static readonly FILESYSTEM_WRITE_FILE: EnhancedToolDefinition = {
    name: 'filesystem_write_file',
    description: 'Writes content to files with chunking support and comprehensive safety checks',
    longDescription: `STANDARD PRACTICE: Always write files in chunks of 25-30 lines maximum. Uses modes: 'rewrite' (overwrites) or 'append' (adds to end). Includes automatic directory creation and safety validations.`,
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Absolute path where to write the file. Directories created automatically if needed.',
          examples: [
            'C:\\Users\\Admin\\project\\src\\new-component.ts',
            '/home/user/project/docs/readme.md',
          ],
          required: true,
        },
        content: {
          type: 'string',
          description:
            'File content to write. RECOMMENDED: 25-30 lines max per call for optimal performance.',
          minLength: 1,
          required: true,
        },
        mode: {
          type: 'string',
          description: 'Write mode: "rewrite" (default, overwrites file) or "append" (adds to end)',
          enum: ['rewrite', 'append'],
          default: 'rewrite',
        },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
    examples: [
      {
        description: 'Create new TypeScript component (first chunk)',
        input: {
          path: '/project/src/UserCard.tsx',
          content:
            'import React from "react";\n\nexport interface UserCardProps {\n  name: string;\n  email: string;\n}',
          mode: 'rewrite',
        },
        expectedOutput: 'File created successfully',
        useCase: 'Starting new file creation',
      },
      {
        description: 'Continue writing component (second chunk)',
        input: {
          path: '/project/src/UserCard.tsx',
          content:
            '\n\nexport const UserCard: React.FC<UserCardProps> = ({ name, email }) => {\n  return (\n    <div className="user-card">\n      <h3>{name}</h3>\n      <p>{email}</p>\n    </div>\n  );\n};',
          mode: 'append',
        },
        expectedOutput: 'Content appended successfully',
        useCase: 'Completing file in chunks',
      },
    ],
    securityLevel: 'medium',
    requiredPermissions: ['write'],
    fallbackBehavior:
      'Create directories if missing, fail with clear error if permissions insufficient',
    performanceNotes:
      'Files over 50 lines generate performance notes but still succeed. Optimal chunk size: 25-30 lines.',
    usage: {
      whenToUse: [
        'Creating new files',
        'Overwriting existing files',
        'Appending to log files or data files',
        'Building files incrementally in chunks',
      ],
      whenNotToUse: [
        'Making small edits to existing files (use edit_file instead)',
        'Binary file operations',
      ],
      bestPractices: [
        'ALWAYS chunk files into 25-30 line segments',
        'Use "rewrite" for first chunk, "append" for subsequent chunks',
        'Handle "Continue" prompts by reading file first to see progress',
      ],
    },
  };

  static readonly GIT_STATUS: EnhancedToolDefinition = {
    name: 'git_status',
    description:
      'Get comprehensive Git repository status including staged, unstaged, and untracked files',
    longDescription: `Essential Git command for understanding repository state before commits. Shows working tree status, staging area, and branch information. CRITICAL: Use before any git operations.`,
    parameters: {
      type: 'object',
      properties: {
        porcelain: {
          type: 'boolean',
          description: 'Return machine-readable output format for programmatic parsing',
          default: false,
        },
        branch: {
          type: 'boolean',
          description: 'Include branch and tracking info in output',
          default: true,
        },
      },
      required: [],
      additionalProperties: false,
    },
    examples: [
      {
        description: 'Get standard git status',
        input: {},
        expectedOutput: 'Standard git status showing modified, staged, and untracked files',
        useCase: 'Understanding repository state before committing',
      },
      {
        description: 'Get machine-readable status',
        input: { porcelain: true },
        expectedOutput: 'Short-format status suitable for scripting',
        useCase: 'Programmatic processing of git state',
      },
    ],
    securityLevel: 'low',
    requiredPermissions: ['read'],
    fallbackBehavior: 'Return error if not in git repository or git not available',
    usage: {
      whenToUse: [
        'Before creating commits',
        'Understanding current repository state',
        'Checking what files need to be staged',
        'Verifying clean working directory',
      ],
      whenNotToUse: [
        'When not in a git repository',
        'For detailed file change contents (use git_diff instead)',
      ],
      bestPractices: [
        'Always check status before committing',
        'Use with git_diff for complete picture of changes',
        'Check branch information to ensure correct branch',
      ],
    },
  };

  static readonly EXECUTE_COMMAND: EnhancedToolDefinition = {
    name: 'execute_command',
    description: 'Execute shell commands with comprehensive security, timeout, and error handling',
    longDescription: `Secure command execution with safety validations. Supports command chaining, timeout control, and comprehensive logging. CRITICAL: Always explain what command does before execution for user understanding.`,
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description:
            'Shell command to execute. Use semicolons or && for multiple commands. Quote paths with spaces.',
          examples: [
            'npm install',
            'git add . && git commit -m "Update features"',
            'cd "/path/with spaces" && npm run build',
          ],
          required: true,
          minLength: 1,
        },
        timeout: {
          type: 'number',
          description:
            'Timeout in milliseconds. Max: 600000ms (10 minutes). Default: 120000ms (2 minutes).',
          default: 120000,
          minimum: 1000,
          maximum: 600000,
        },
        description: {
          type: 'string',
          description: 'Clear 5-10 word description of command purpose for user understanding',
          examples: [
            'Install project dependencies',
            'Commit changes to repository',
            'Build production assets',
          ],
          minLength: 5,
          maxLength: 100,
          required: true,
        },
        workingDirectory: {
          type: 'string',
          description: 'Working directory for command execution. Default: current directory.',
          examples: ['/project/src', 'C:\\Projects\\App'],
        },
      },
      required: ['command', 'description'],
      additionalProperties: false,
    },
    examples: [
      {
        description: 'Install npm packages',
        input: {
          command: 'npm install',
          description: 'Install project dependencies',
          timeout: 300000,
        },
        expectedOutput: 'npm installation output with success/failure status',
        useCase: 'Setting up project dependencies',
      },
      {
        description: 'Run multiple git commands',
        input: {
          command: 'git add . && git status',
          description: 'Stage files and check status',
          timeout: 60000,
        },
        expectedOutput: 'Combined output of git add and git status',
        useCase: 'Preparing files for commit',
      },
    ],
    securityLevel: 'high',
    requiredPermissions: ['execute'],
    fallbackBehavior: 'Fail safely with detailed error message and suggestions',
    performanceNotes:
      'Command output limits are configurable via performance.output.max_command_output_chars in configuration',
    usage: {
      whenToUse: [
        'Installing packages or dependencies',
        'Building or compiling projects',
        'Running tests or linting',
        'System administration tasks',
      ],
      whenNotToUse: [
        'Reading files (use filesystem_read_file)',
        'Listing directories (use list_directory)',
        'Simple git operations (use specific git tools)',
      ],
      bestPractices: [
        'ALWAYS provide clear description for user understanding',
        'Quote paths containing spaces',
        'Use absolute paths when possible',
        'Set appropriate timeouts for long-running commands',
        'Explain command impact before execution for system changes',
      ],
    },
  };

  static readonly TERMINAL_CONTROLLER_SEARCH: EnhancedToolDefinition = {
    name: 'terminal_search_files',
    description:
      'Advanced file search with pattern matching, content search, and filtering capabilities',
    longDescription: `Powerful search tool combining filename and content search. Supports regex patterns, file type filtering, and recursive directory traversal. Use for complex searches requiring multiple criteria.`,
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description:
            'Search pattern - filename pattern or content regex. Supports glob patterns (*,?) and regex.',
          examples: ['*.ts', '**/*.json', 'interface\\s+\\w+', 'function.*authenticate'],
          required: true,
        },
        searchType: {
          type: 'string',
          description: 'Type of search to perform',
          enum: ['filename', 'content', 'both'],
          default: 'both',
        },
        directory: {
          type: 'string',
          description: 'Starting directory for search. Default: current working directory',
          examples: ['/project/src', 'C:\\Projects\\App\\src'],
        },
        fileTypes: {
          type: 'array',
          description: 'Filter by file extensions',
          items: { type: 'string' },
          examples: [
            ['ts', 'js'],
            ['json', 'yaml'],
            ['md', 'txt'],
          ],
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum directory depth for recursive search. 0 = current dir only.',
          default: 10,
          minimum: 0,
          maximum: 100,
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Case-sensitive search',
          default: false,
        },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
    examples: [
      {
        description: 'Find TypeScript files with authentication code',
        input: {
          pattern: 'authenticate',
          searchType: 'content',
          fileTypes: ['ts', 'tsx'],
          directory: '/project/src',
        },
        expectedOutput: 'List of files containing "authenticate" in TypeScript files',
        useCase: 'Finding authentication-related code',
      },
      {
        description: 'Search for config files by name',
        input: {
          pattern: '*config*',
          searchType: 'filename',
          fileTypes: ['json', 'yaml', 'js'],
        },
        expectedOutput: 'List of configuration files matching pattern',
        useCase: 'Locating configuration files',
      },
    ],
    securityLevel: 'low',
    requiredPermissions: ['read'],
    fallbackBehavior: 'Return empty results with clear message if no matches found',
    performanceNotes: 'Large directories may require time. Use maxDepth and fileTypes to optimize.',
    usage: {
      whenToUse: [
        'Complex file searches across project',
        'Finding code patterns or functions',
        'Locating configuration files',
        'Content-based code discovery',
      ],
      whenNotToUse: ['Simple single-file reading', 'Directory listing of known location'],
      bestPractices: [
        'Use fileTypes filter to improve performance',
        'Set reasonable maxDepth for large projects',
        'Combine filename and content search for precision',
      ],
    },
  };

  /**
   * Get all enhanced tool definitions
   */
  static getAllDefinitions(): Record<string, EnhancedToolDefinition> {
    return {
      filesystem_read_file: this.FILESYSTEM_READ_FILE,
      filesystem_write_file: this.FILESYSTEM_WRITE_FILE,
      git_status: this.GIT_STATUS,
      execute_command: this.EXECUTE_COMMAND,
      terminal_search_files: this.TERMINAL_CONTROLLER_SEARCH,
    };
  }

  /**
   * Get tool definition by name
   */
  static getDefinition(toolName: string): EnhancedToolDefinition | null {
    return this.getAllDefinitions()[toolName] || null;
  }

  /**
   * Generate Claude Code style tool description for system prompts
   */
  static generateSystemPromptDescription(toolName: string): string {
    const def = this.getDefinition(toolName);
    if (!def) return '';

    let description = `- ${def.name} - ${def.description}`;

    if (def.usage?.whenToUse) {
      description += `\n  Use for: ${def.usage.whenToUse.join(', ')}`;
    }

    if (def.fallbackBehavior) {
      description += `\n  Fallback: ${def.fallbackBehavior}`;
    }

    if (def.performanceNotes) {
      description += `\n  Performance: ${def.performanceNotes}`;
    }

    return description;
  }

  /**
   * Validate tool usage against definition
   */
  static validateUsage(
    toolName: string,
    parameters: any
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const def = this.getDefinition(toolName);
    if (!def) {
      return { valid: false, errors: [`Unknown tool: ${toolName}`], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required parameters
    for (const required of def.parameters.required) {
      if (!(required in parameters)) {
        errors.push(`Missing required parameter: ${required}`);
      }
    }

    // Check parameter types and constraints
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const paramDef = def.parameters.properties[paramName];
      if (!paramDef) {
        warnings.push(`Unexpected parameter: ${paramName}`);
        continue;
      }

      // Type checking
      if (paramDef.type === 'string' && typeof paramValue !== 'string') {
        errors.push(`Parameter ${paramName} must be a string`);
      }

      if (paramDef.type === 'number' && typeof paramValue !== 'number') {
        errors.push(`Parameter ${paramName} must be a number`);
      }

      // String length validation
      if (paramDef.type === 'string' && typeof paramValue === 'string') {
        if (paramDef.minLength && paramValue.length < paramDef.minLength) {
          errors.push(`Parameter ${paramName} too short (min: ${paramDef.minLength})`);
        }
        if (paramDef.maxLength && paramValue.length > paramDef.maxLength) {
          errors.push(`Parameter ${paramName} too long (max: ${paramDef.maxLength})`);
        }
      }

      // Enum validation
      if (paramDef.enum && !paramDef.enum.includes(paramValue as string)) {
        errors.push(`Parameter ${paramName} must be one of: ${paramDef.enum.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
