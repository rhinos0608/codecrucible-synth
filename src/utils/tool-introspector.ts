import { createLogger } from '../infrastructure/logging/logger-adapter.js';

const logger = createLogger('ToolIntrospector');

/**
 * Tool call validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedArgs?: Record<string, unknown>;
}

/**
 * Tool schema definition
 */
export interface ToolSchema {
  name: string;
  required: string[];
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    items?: { type: string };
  }>;
}

/**
 * Thin introspector-router that validates JSON compliance against tool schemas
 * Provides explicit feedback instead of letting AI narrate failures
 */
export class ToolIntrospector {
  private static schemas = new Map<string, ToolSchema>();

  /**
   * Register a tool schema for validation
   */
  public static registerSchema(schema: ToolSchema): void {
    this.schemas.set(schema.name, schema);
    logger.debug('Registered tool schema', { toolName: schema.name, required: schema.required });
  }

  /**
   * Validate a tool call against its registered schema
   * Returns explicit feedback instead of allowing AI to guess
   */
  public static validateToolCall(
    toolName: string,
    args: Record<string, unknown>
  ): ValidationResult {
    const schema = this.schemas.get(toolName);
    
    if (!schema) {
      return {
        isValid: false,
        errors: [`Tool '${toolName}' not found in registered schemas`],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const normalizedArgs: Record<string, unknown> = {};

    // Validate required fields
    for (const requiredField of schema.required) {
      if (!(requiredField in args) || args[requiredField] === undefined || args[requiredField] === null) {
        errors.push(`Missing required field: ${requiredField}`);
      }
    }

    // Validate each provided argument
    for (const [key, value] of Object.entries(args)) {
      const propSchema = schema.properties[key];
      
      if (!propSchema) {
        warnings.push(`Unknown property: ${key}`);
        normalizedArgs[key] = value; // Include unknown props with warning
        continue;
      }

      // Type validation
      const validationResult = this.validateValue(value, propSchema, `${toolName}.${key}`);
      
      if (validationResult.isValid) {
        normalizedArgs[key] = validationResult.normalizedValue;
      } else {
        errors.push(...validationResult.errors);
      }

      warnings.push(...validationResult.warnings);
    }

    // Add default values for missing optional fields
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (!schema.required.includes(propName) && !(propName in args)) {
        // Apply intelligent defaults based on type
        const defaultValue = this.getDefaultValue(propSchema);
        if (defaultValue !== undefined) {
          normalizedArgs[propName] = defaultValue;
          logger.debug('Applied default value', { toolName, property: propName, defaultValue });
        }
      }
    }

    const isValid = errors.length === 0;

    logger.debug('Tool call validation complete', {
      toolName,
      isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
      normalizedArgKeys: Object.keys(normalizedArgs)
    });

    return {
      isValid,
      errors,
      warnings,
      normalizedArgs: isValid ? normalizedArgs : undefined
    };
  }

  /**
   * Validate a single value against its schema
   */
  private static validateValue(
    value: unknown,
    propSchema: ToolSchema['properties'][string],
    fieldPath: string
  ): { isValid: boolean; errors: string[]; warnings: string[]; normalizedValue?: unknown } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Type validation
    switch (propSchema.type) {
      case 'string':
        if (typeof value !== 'string') {
          // Try to coerce common cases
          if (typeof value === 'number' || typeof value === 'boolean') {
            warnings.push(`${fieldPath}: Coercing ${typeof value} to string`);
            return { isValid: true, errors, warnings, normalizedValue: String(value) };
          }
          errors.push(`${fieldPath}: Expected string, got ${typeof value}`);
          return { isValid: false, errors, warnings };
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          // Try to coerce string numbers
          if (typeof value === 'string' && !isNaN(Number(value))) {
            warnings.push(`${fieldPath}: Coercing string to number`);
            return { isValid: true, errors, warnings, normalizedValue: Number(value) };
          }
          errors.push(`${fieldPath}: Expected number, got ${typeof value}`);
          return { isValid: false, errors, warnings };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          // Try to coerce common boolean representations
          if (value === 'true' || value === 1) {
            warnings.push(`${fieldPath}: Coercing ${value} to true`);
            return { isValid: true, errors, warnings, normalizedValue: true };
          }
          if (value === 'false' || value === 0) {
            warnings.push(`${fieldPath}: Coercing ${value} to false`);
            return { isValid: true, errors, warnings, normalizedValue: false };
          }
          errors.push(`${fieldPath}: Expected boolean, got ${typeof value}`);
          return { isValid: false, errors, warnings };
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`${fieldPath}: Expected array, got ${typeof value}`);
          return { isValid: false, errors, warnings };
        }
        
        // Validate array items if schema specifies item type
        if (propSchema.items) {
          const validatedItems: unknown[] = [];
          for (let i = 0; i < value.length; i++) {
            const itemResult = this.validateValue(value[i], propSchema.items, `${fieldPath}[${i}]`);
            if (itemResult.isValid) {
              validatedItems.push(itemResult.normalizedValue ?? value[i]);
            } else {
              errors.push(...itemResult.errors);
            }
            warnings.push(...itemResult.warnings);
          }
          if (errors.length === 0) {
            return { isValid: true, errors, warnings, normalizedValue: validatedItems };
          }
        }
        break;

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push(`${fieldPath}: Expected object, got ${typeof value}`);
          return { isValid: false, errors, warnings };
        }
        break;
    }

    // Enum validation
    if (propSchema.enum && !propSchema.enum.includes(value as string)) {
      errors.push(`${fieldPath}: Value '${value}' not in allowed values: ${propSchema.enum.join(', ')}`);
      return { isValid: false, errors, warnings };
    }

    return { isValid: true, errors, warnings, normalizedValue: value };
  }

  /**
   * Get intelligent default values based on schema
   */
  private static getDefaultValue(propSchema: ToolSchema['properties'][string]): unknown {
    switch (propSchema.type) {
      case 'string':
        return ''; // Empty string as default
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'array':
        return [];
      case 'object':
        return {};
      default:
        return undefined;
    }
  }

  /**
   * Generate explicit feedback for validation failures
   */
  public static generateFeedback(result: ValidationResult, toolName: string): string {
    if (result.isValid) {
      return `✅ Tool call '${toolName}' is valid and ready for execution.`;
    }

    let feedback = `❌ Tool call '${toolName}' failed validation:\n`;
    
    if (result.errors.length > 0) {
      feedback += `\nErrors:\n${result.errors.map(e => `  • ${e}`).join('\n')}`;
    }

    if (result.warnings.length > 0) {
      feedback += `\nWarnings:\n${result.warnings.map(w => `  • ${w}`).join('\n')}`;
    }

    feedback += `\n\n🔧 Fix these issues and try again.`;
    return feedback;
  }

  /**
   * Auto-register common tool schemas
   */
  public static registerCommonSchemas(): void {
    // Execute command schema
    this.registerSchema({
      name: 'execute_command',
      required: ['command'],
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
        workingDirectory: { type: 'string', description: 'Working directory path' },
        timeout: { type: 'number', description: 'Timeout in milliseconds' },
        captureOutput: { type: 'boolean', description: 'Whether to capture output' }
      }
    });

    // Filesystem read schema
    this.registerSchema({
      name: 'filesystem_read_file',
      required: ['path'],
      properties: {
        path: { type: 'string', description: 'File path to read' },
        encoding: { type: 'string', enum: ['utf8', 'ascii', 'binary'], description: 'File encoding' }
      }
    });

    // Git status schema
    this.registerSchema({
      name: 'git_status',
      required: [],
      properties: {
        path: { type: 'string', description: 'Repository path' }
      }
    });

    logger.info('Registered common tool schemas', { count: this.schemas.size });
  }
}

// Auto-register common schemas on import
ToolIntrospector.registerCommonSchemas();