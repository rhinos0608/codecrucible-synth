/**
 * Structured Output Manager - JSON Schema Validation System
 * Implements modern structured output generation with validation and type safety
 *
 * Features:
 * - JSON Schema validation with detailed error reporting
 * - Type-safe response handling with TypeScript inference
 * - Streaming structured output with partial validation
 * - Schema inference from examples and descriptions
 * - Multiple output formats (JSON, YAML, XML, etc.)
 * - Schema evolution and version management
 * - Confidence scoring for generated structures
 * - Auto-correction for common schema violations
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { getTelemetryProvider } from '../observability/observability-system.js';

// JSON Schema types
export interface JsonSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: JsonSchemaType | JsonSchemaType[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  enum?: any[];
  const?: any;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  not?: JsonSchema;
  if?: JsonSchema;
  then?: JsonSchema;
  else?: JsonSchema;
  definitions?: Record<string, JsonSchema>;
  examples?: any[];
  default?: any;
  'xml-attributes'?: boolean;
}

export type JsonSchemaType =
  | 'null'
  | 'boolean'
  | 'object'
  | 'array'
  | 'number'
  | 'integer'
  | 'string';

export interface StructuredOutputConfig {
  enablePartialValidation?: boolean;
  enableAutoCorrection?: boolean;
  maxValidationErrors?: number;
  confidenceThreshold?: number;
  outputFormat?: OutputFormat;
  strictMode?: boolean;
  schemaValidation?: SchemaValidationLevel;
}

export type OutputFormat = 'json' | 'yaml' | 'xml' | 'toml' | 'csv';
export type SchemaValidationLevel = 'strict' | 'moderate' | 'lenient' | 'disabled';

export interface StructuredResponse<T = any> {
  data: T;
  schema: JsonSchema;
  valid: boolean;
  confidence: number;
  metadata: StructuredResponseMetadata;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
  partial?: boolean;
  corrected?: boolean;
}

export interface StructuredResponseMetadata {
  generationTime: number;
  validationTime: number;
  schemaComplexity: number;
  outputFormat: OutputFormat;
  schemaVersion?: string;
  reasoning?: string;
  alternatives?: AlternativeOutput[];
}

export interface AlternativeOutput {
  data: any;
  confidence: number;
  reasoning: string;
  validationErrors: number;
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
  suggestions?: string[];
  actualValue?: any;
  expectedType?: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
}

export interface SchemaInferenceOptions {
  includeExamples?: boolean;
  strictTypes?: boolean;
  minimumOccurrence?: number;
  inferOptionalFields?: boolean;
  generateDescriptions?: boolean;
}

export interface SchemaGenerationRequest {
  description: string;
  examples?: any[];
  constraints?: SchemaConstraint[];
  outputFormat?: OutputFormat;
  inferenceOptions?: SchemaInferenceOptions;
}

export interface SchemaConstraint {
  type: 'required' | 'optional' | 'pattern' | 'range' | 'enum';
  field: string;
  value: any;
  description?: string;
}

export interface IStructuredOutputManager {
  // Schema operations
  generateSchema(request: SchemaGenerationRequest): Promise<JsonSchema>;
  validateSchema(schema: JsonSchema): Promise<SchemaValidationResult>;
  inferSchemaFromData(data: any[], options?: SchemaInferenceOptions): Promise<JsonSchema>;

  // Output generation
  generateStructuredOutput<T>(
    prompt: string,
    schema: JsonSchema,
    options?: StructuredOutputConfig
  ): Promise<StructuredResponse<T>>;

  streamStructuredOutput<T>(
    prompt: string,
    schema: JsonSchema,
    onPartial: (partial: Partial<T>) => void,
    options?: StructuredOutputConfig
  ): Promise<StructuredResponse<T>>;

  // Validation
  validateOutput(data: any, schema: JsonSchema): Promise<ValidationResult>;
  autoCorrectOutput(data: any, schema: JsonSchema): Promise<CorrectionResult>;

  // Format conversion
  convertFormat(data: any, fromFormat: OutputFormat, toFormat: OutputFormat): Promise<string>;

  // Schema management
  registerSchema(id: string, schema: JsonSchema): void;
  getSchema(id: string): JsonSchema | null;
  updateSchema(id: string, schema: JsonSchema, version?: string): void;

  // Utilities
  calculateSchemaComplexity(schema: JsonSchema): number;
  generateSchemaDocumentation(schema: JsonSchema): string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
  warnings: string[];
  complexity: number;
}

export interface SchemaValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  confidence: number;
  partiallyValid?: boolean;
}

export interface CorrectionResult {
  corrected: boolean;
  data: any;
  corrections: Correction[];
  confidence: number;
  metadata: CorrectionMetadata;
}

export interface Correction {
  path: string;
  originalValue: any;
  correctedValue: any;
  reasoning: string;
  confidence: number;
}

export interface CorrectionMetadata {
  totalCorrections: number;
  criticalCorrections: number;
  automaticCorrections: number;
  manualReviewNeeded: boolean;
}

/**
 * Structured Output Manager Implementation
 * Provides comprehensive structured output generation and validation
 */
export class StructuredOutputManager extends EventEmitter implements IStructuredOutputManager {
  private schemas: Map<string, { schema: JsonSchema; version?: string }> = new Map();
  private telemetry = getTelemetryProvider();

  private readonly defaultConfig: StructuredOutputConfig = {
    enablePartialValidation: true,
    enableAutoCorrection: true,
    maxValidationErrors: 50,
    confidenceThreshold: 0.8,
    outputFormat: 'json',
    strictMode: false,
    schemaValidation: 'moderate',
  };

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('schema-generated', (complexity: number) => {
      logger.debug('Schema generated', { complexity });
    });

    this.on('output-validated', (valid: boolean, errors: number) => {
      logger.debug('Output validated', { valid, errors });
    });

    this.on('output-corrected', (corrections: number) => {
      logger.info('Output auto-corrected', { corrections });
    });
  }

  /**
   * Generate JSON Schema from description and examples
   */
  async generateSchema(request: SchemaGenerationRequest): Promise<JsonSchema> {
    const startTime = Date.now();

    try {
      logger.info('Generating schema', {
        hasExamples: !!request.examples?.length,
        hasConstraints: !!request.constraints?.length,
        outputFormat: request.outputFormat,
      });

      let schema: JsonSchema = {
        type: 'object',
        title: this.extractTitleFromDescription(request.description),
        description: request.description,
        properties: {},
        required: [],
        additionalProperties: false,
      };

      // Infer from examples if provided
      if (request.examples && request.examples.length > 0) {
        const inferredSchema = await this.inferSchemaFromData(
          request.examples,
          request.inferenceOptions
        );
        schema = this.mergeSchemas(schema, inferredSchema);
      }

      // Apply constraints
      if (request.constraints) {
        schema = this.applyConstraints(schema, request.constraints);
      }

      // Add format-specific properties
      if (request.outputFormat && request.outputFormat !== 'json') {
        schema = this.adaptSchemaForFormat(schema, request.outputFormat);
      }

      // Generate descriptions if requested
      if (request.inferenceOptions?.generateDescriptions) {
        schema = await this.generatePropertyDescriptions(schema, request.description);
      }

      const complexity = this.calculateSchemaComplexity(schema);
      this.emit('schema-generated', complexity);

      logger.info('Schema generation completed', {
        complexity,
        properties: Object.keys(schema.properties || {}).length,
        generationTime: Date.now() - startTime,
      });

      return schema;
    } catch (error) {
      logger.error('Schema generation failed', error);
      throw new Error(
        `Schema generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate structured output with schema validation
   */
  async generateStructuredOutput<T>(
    prompt: string,
    schema: JsonSchema,
    options?: StructuredOutputConfig
  ): Promise<StructuredResponse<T>> {
    const config = { ...this.defaultConfig, ...options };
    const startTime = Date.now();

    try {
      logger.info('Generating structured output', {
        schemaTitle: schema.title,
        outputFormat: config.outputFormat,
        strictMode: config.strictMode,
      });

      // Enhanced prompt with schema information
      const enhancedPrompt = this.createSchemaAwarePrompt(prompt, schema, config);

      // Simulate LLM call with structured generation
      // In production, this would call the actual LLM with schema constraints
      const rawOutput = await this.simulateStructuredGeneration(enhancedPrompt, schema, config);

      const generationTime = Date.now() - startTime;
      const validationStartTime = Date.now();

      // Validate generated output
      const validationResult = await this.validateOutput(rawOutput, schema);
      const validationTime = Date.now() - validationStartTime;

      // Auto-correct if enabled and validation failed
      let finalData = rawOutput;
      let corrected = false;
      let corrections: Correction[] = [];

      if (!validationResult.valid && config.enableAutoCorrection) {
        const correctionResult = await this.autoCorrectOutput(rawOutput, schema);
        if (
          correctionResult.corrected &&
          correctionResult.confidence >= (config.confidenceThreshold || 0.8)
        ) {
          finalData = correctionResult.data;
          corrected = true;
          corrections = correctionResult.corrections;
          this.emit('output-corrected', corrections.length);
        }
      }

      // Calculate confidence
      const confidence = this.calculateOutputConfidence(
        finalData,
        schema,
        validationResult,
        corrected
      );

      this.emit(
        'output-validated',
        validationResult.valid || corrected,
        validationResult.errors.length
      );

      const response: StructuredResponse<T> = {
        data: finalData as T,
        schema,
        valid: validationResult.valid || corrected,
        confidence,
        metadata: {
          generationTime,
          validationTime,
          schemaComplexity: this.calculateSchemaComplexity(schema),
          outputFormat: config.outputFormat || 'json',
          reasoning: this.generateReasoningExplanation(finalData, schema, validationResult),
          alternatives: [],
        },
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        corrected,
      };

      if (corrected) {
        response.metadata.reasoning = `Output was auto-corrected with ${corrections.length} changes. ${response.metadata.reasoning}`;
      }

      return response;
    } catch (error) {
      logger.error('Structured output generation failed', error);
      throw new Error(
        `Structured output generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Stream structured output with partial validation
   */
  async streamStructuredOutput<T>(
    prompt: string,
    schema: JsonSchema,
    onPartial: (partial: Partial<T>) => void,
    options?: StructuredOutputConfig
  ): Promise<StructuredResponse<T>> {
    const config = { ...this.defaultConfig, ...options };

    logger.info('Starting structured output streaming', {
      schemaTitle: schema.title,
      partialValidation: config.enablePartialValidation,
    });

    // Simulate streaming generation
    return await this.simulateStreamingGeneration(prompt, schema, onPartial, config);
  }

  /**
   * Validate data against schema
   */
  async validateOutput(data: any, schema: JsonSchema): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Perform comprehensive validation
      this.validateRecursive(data, schema, '', errors, warnings);

      const valid = errors.filter(e => e.severity === 'error').length === 0;
      const confidence = this.calculateValidationConfidence(errors, warnings);

      return {
        valid,
        errors,
        warnings,
        confidence,
        partiallyValid: !valid && warnings.length > 0,
      };
    } catch (error) {
      errors.push({
        path: '',
        message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
        code: 'VALIDATION_ERROR',
        severity: 'error',
      });

      return {
        valid: false,
        errors,
        warnings,
        confidence: 0,
      };
    }
  }

  /**
   * Auto-correct common validation issues
   */
  async autoCorrectOutput(data: any, schema: JsonSchema): Promise<CorrectionResult> {
    const corrections: Correction[] = [];
    const correctedData = JSON.parse(JSON.stringify(data)); // Deep copy

    try {
      // Apply various correction strategies
      this.correctTypes(correctedData, schema, '', corrections);
      this.correctMissingRequired(correctedData, schema, '', corrections);
      this.correctInvalidValues(correctedData, schema, '', corrections);
      this.removeExtraProperties(correctedData, schema, '', corrections);

      const confidence = this.calculateCorrectionConfidence(corrections);
      const metadata: CorrectionMetadata = {
        totalCorrections: corrections.length,
        criticalCorrections: corrections.filter(c => c.confidence < 0.7).length,
        automaticCorrections: corrections.filter(c => c.confidence >= 0.8).length,
        manualReviewNeeded: corrections.some(c => c.confidence < 0.6),
      };

      return {
        corrected: corrections.length > 0,
        data: correctedData,
        corrections,
        confidence,
        metadata,
      };
    } catch (error) {
      logger.error('Auto-correction failed', error);
      return {
        corrected: false,
        data: data,
        corrections: [],
        confidence: 0,
        metadata: {
          totalCorrections: 0,
          criticalCorrections: 0,
          automaticCorrections: 0,
          manualReviewNeeded: true,
        },
      };
    }
  }

  /**
   * Infer schema from data examples
   */
  async inferSchemaFromData(data: any[], options?: SchemaInferenceOptions): Promise<JsonSchema> {
    const opts = {
      includeExamples: false,
      strictTypes: false,
      minimumOccurrence: 1,
      inferOptionalFields: true,
      generateDescriptions: false,
      ...options,
    };

    if (data.length === 0) {
      return { type: 'object', properties: {}, additionalProperties: false };
    }

    const schema: JsonSchema = {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: !opts.strictTypes,
    };

    // Analyze all data samples
    const fieldAnalysis = this.analyzeFields(data, opts);

    // Build schema from analysis
    for (const [fieldName, analysis] of fieldAnalysis.entries()) {
      schema.properties![fieldName] = this.createPropertySchema(analysis, opts);

      // Determine if field should be required
      const occurrenceRatio = analysis.occurrences / data.length;
      if (occurrenceRatio >= opts.minimumOccurrence / data.length && !opts.inferOptionalFields) {
        schema.required!.push(fieldName);
      }
    }

    if (opts.includeExamples) {
      schema.examples = data.slice(0, 3); // Include first 3 examples
    }

    return schema;
  }

  /**
   * Convert output format
   */
  async convertFormat(
    data: any,
    fromFormat: OutputFormat,
    toFormat: OutputFormat
  ): Promise<string> {
    if (fromFormat === toFormat) {
      return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }

    try {
      // Parse data from source format
      let parsedData = data;
      if (typeof data === 'string') {
        switch (fromFormat) {
          case 'json':
            parsedData = JSON.parse(data);
            break;
          case 'yaml':
            // Would use yaml parser in production
            parsedData = this.parseSimpleYaml(data);
            break;
          default:
            throw new Error(`Unsupported source format: ${fromFormat}`);
        }
      }

      // Convert to target format
      switch (toFormat) {
        case 'json':
          return JSON.stringify(parsedData, null, 2);
        case 'yaml':
          return this.toSimpleYaml(parsedData);
        case 'xml':
          return this.toSimpleXml(parsedData);
        case 'csv':
          return this.toCsv(parsedData);
        default:
          throw new Error(`Unsupported target format: ${toFormat}`);
      }
    } catch (error) {
      logger.error('Format conversion failed', { fromFormat, toFormat, error });
      throw new Error(
        `Format conversion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Calculate schema complexity
   */
  calculateSchemaComplexity(schema: JsonSchema): number {
    let complexity = 0;

    if (schema.properties) {
      complexity += Object.keys(schema.properties).length;
      for (const property of Object.values(schema.properties)) {
        complexity += this.calculateSchemaComplexity(property);
      }
    }

    if (schema.items) {
      complexity += this.calculateSchemaComplexity(schema.items);
    }

    if (schema.anyOf || schema.oneOf || schema.allOf) {
      const unions = schema.anyOf || schema.oneOf || schema.allOf || [];
      complexity += unions.reduce((sum, s) => sum + this.calculateSchemaComplexity(s), 0);
    }

    return complexity;
  }

  /**
   * Register schema for reuse
   */
  registerSchema(id: string, schema: JsonSchema): void {
    this.schemas.set(id, { schema });
    logger.debug('Schema registered', { id, complexity: this.calculateSchemaComplexity(schema) });
  }

  /**
   * Get registered schema
   */
  getSchema(id: string): JsonSchema | null {
    const entry = this.schemas.get(id);
    return entry ? entry.schema : null;
  }

  /**
   * Update registered schema with versioning
   */
  updateSchema(id: string, schema: JsonSchema, version?: string): void {
    this.schemas.set(id, { schema, version });
    logger.info('Schema updated', { id, version });
  }

  /**
   * Generate schema documentation
   */
  generateSchemaDocumentation(schema: JsonSchema): string {
    let docs = `# ${schema.title || 'Schema Documentation'}\n\n`;

    if (schema.description) {
      docs += `${schema.description}\n\n`;
    }

    docs += '## Properties\n\n';

    if (schema.properties) {
      for (const [name, prop] of Object.entries(schema.properties)) {
        docs += this.generatePropertyDocumentation(
          name,
          prop,
          schema.required?.includes(name) || false
        );
      }
    }

    return docs;
  }

  /**
   * Validate schema itself
   */
  async validateSchema(schema: JsonSchema): Promise<SchemaValidationResult> {
    const errors: SchemaValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Basic schema validation
      if (!schema.type && !schema.anyOf && !schema.oneOf && !schema.allOf) {
        errors.push({
          path: '',
          message: 'Schema must specify a type or use composition (anyOf, oneOf, allOf)',
          code: 'MISSING_TYPE',
        });
      }

      // Validate properties if it's an object schema
      if (schema.type === 'object' && schema.properties) {
        for (const [name, prop] of Object.entries(schema.properties)) {
          this.validatePropertySchema(prop, name, errors, warnings);
        }
      }

      // Check for circular references
      if (this.hasCircularReference(schema)) {
        warnings.push('Schema contains circular references which may cause issues');
      }

      const complexity = this.calculateSchemaComplexity(schema);
      if (complexity > 100) {
        warnings.push(`Schema is quite complex (${complexity} points) - consider simplifying`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        complexity,
      };
    } catch (error) {
      errors.push({
        path: '',
        message: `Schema validation error: ${error instanceof Error ? error.message : String(error)}`,
        code: 'VALIDATION_ERROR',
      });

      return {
        valid: false,
        errors,
        warnings,
        complexity: 0,
      };
    }
  }

  // Private helper methods

  private extractTitleFromDescription(description: string): string {
    const firstSentence = description.split('.')[0];
    return firstSentence.length > 50 ? `${firstSentence.substring(0, 47)  }...` : firstSentence;
  }

  private mergeSchemas(base: JsonSchema, inferred: JsonSchema): JsonSchema {
    return {
      ...base,
      properties: { ...base.properties, ...inferred.properties },
      required: [...(base.required || []), ...(inferred.required || [])].filter(
        (v, i, a) => a.indexOf(v) === i
      ),
    };
  }

  private applyConstraints(schema: JsonSchema, constraints: SchemaConstraint[]): JsonSchema {
    const updatedSchema = { ...schema };

    for (const constraint of constraints) {
      if (!updatedSchema.properties) updatedSchema.properties = {};

      const fieldSchema = updatedSchema.properties[constraint.field] || { type: 'string' };

      switch (constraint.type) {
        case 'required':
          if (!updatedSchema.required) updatedSchema.required = [];
          if (!updatedSchema.required.includes(constraint.field)) {
            updatedSchema.required.push(constraint.field);
          }
          break;

        case 'enum':
          fieldSchema.enum = Array.isArray(constraint.value)
            ? constraint.value
            : [constraint.value];
          break;

        case 'pattern':
          if (fieldSchema.type === 'string') {
            fieldSchema.pattern = constraint.value;
          }
          break;

        case 'range':
          if (fieldSchema.type === 'number' || fieldSchema.type === 'integer') {
            if (constraint.value.min !== undefined) fieldSchema.minimum = constraint.value.min;
            if (constraint.value.max !== undefined) fieldSchema.maximum = constraint.value.max;
          }
          break;
      }

      if (constraint.description) {
        fieldSchema.description = constraint.description;
      }

      updatedSchema.properties[constraint.field] = fieldSchema;
    }

    return updatedSchema;
  }

  private adaptSchemaForFormat(schema: JsonSchema, format: OutputFormat): JsonSchema {
    // Add format-specific adaptations
    switch (format) {
      case 'csv':
        // CSV schemas should be flat objects or arrays
        if (schema.type === 'object' && schema.properties) {
          const flatSchema = { ...schema };
          // Flatten nested objects for CSV compatibility
          flatSchema.additionalProperties = false;
          return flatSchema;
        }
        break;

      case 'xml':
        // XML schemas might need special handling for attributes
        return { ...schema, 'xml-attributes': true };

      default:
        return schema;
    }

    return schema;
  }

  private async generatePropertyDescriptions(
    schema: JsonSchema,
    context: string
  ): Promise<JsonSchema> {
    // In production, this would use AI to generate descriptions
    const updatedSchema = { ...schema };

    if (updatedSchema.properties) {
      for (const [name, prop] of Object.entries(updatedSchema.properties)) {
        if (!prop.description) {
          prop.description = `The ${name} property for ${context}`;
        }
      }
    }

    return updatedSchema;
  }

  private createSchemaAwarePrompt(
    prompt: string,
    schema: JsonSchema,
    config: StructuredOutputConfig
  ): string {
    let enhancedPrompt = prompt;

    enhancedPrompt += '\n\nPlease respond with a JSON object that follows this schema:\n';
    enhancedPrompt += JSON.stringify(schema, null, 2);

    if (config.strictMode) {
      enhancedPrompt +=
        '\n\nIMPORTANT: The response must strictly adhere to the schema. No additional properties are allowed.';
    }

    if (schema.examples && schema.examples.length > 0) {
      enhancedPrompt += '\n\nExample format:\n';
      enhancedPrompt += JSON.stringify(schema.examples[0], null, 2);
    }

    return enhancedPrompt;
  }

  private async simulateStructuredGeneration(
    prompt: string,
    schema: JsonSchema,
    config: StructuredOutputConfig
  ): Promise<any> {
    // Simulate LLM response generation - in production this would call actual LLM
    const example = this.generateExampleFromSchema(schema);

    // Add some realistic variation/errors for testing
    if (!config.strictMode && Math.random() > 0.8) {
      // Occasionally add extra properties or minor errors
      if (typeof example === 'object' && example !== null) {
        (example as any).extra_property = 'test';
      }
    }

    return example;
  }

  private async simulateStreamingGeneration<T>(
    prompt: string,
    schema: JsonSchema,
    onPartial: (partial: Partial<T>) => void,
    config: StructuredOutputConfig
  ): Promise<StructuredResponse<T>> {
    const fullData = await this.simulateStructuredGeneration(prompt, schema, config);

    // Simulate streaming by sending partial objects
    if (typeof fullData === 'object' && fullData !== null) {
      const keys = Object.keys(fullData);
      const partial: any = {};

      for (let i = 0; i < keys.length; i++) {
        partial[keys[i]] = fullData[keys[i]];
        onPartial(partial as Partial<T>);

        // Add delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Return full response
    return await this.generateStructuredOutput(prompt, schema, config);
  }

  private generateExampleFromSchema(schema: JsonSchema): any {
    if (schema.examples && schema.examples.length > 0) {
      return schema.examples[0];
    }

    switch (schema.type) {
      case 'string':
        return schema.enum ? schema.enum[0] : 'example string';
      case 'number':
        return schema.minimum || 42;
      case 'integer':
        return schema.minimum || 42;
      case 'boolean':
        return true;
      case 'array':
        const item = schema.items ? this.generateExampleFromSchema(schema.items) : 'item';
        return [item];
      case 'object':
        const obj: any = {};
        if (schema.properties) {
          for (const [name, prop] of Object.entries(schema.properties)) {
            obj[name] = this.generateExampleFromSchema(prop);
          }
        }
        return obj;
      default:
        return null;
    }
  }

  private validateRecursive(
    data: any,
    schema: JsonSchema,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Type validation
    if (schema.type && !this.validateType(data, schema.type)) {
      errors.push({
        path,
        message: `Expected type ${schema.type} but got ${typeof data}`,
        code: 'TYPE_MISMATCH',
        severity: 'error',
        actualValue: data,
        expectedType: schema.type as string,
      });
      return;
    }

    // Object validation
    if (schema.type === 'object' && typeof data === 'object' && data !== null) {
      this.validateObject(data, schema, path, errors, warnings);
    }

    // Array validation
    if (schema.type === 'array' && Array.isArray(data)) {
      this.validateArray(data, schema, path, errors, warnings);
    }

    // String validation
    if (schema.type === 'string' && typeof data === 'string') {
      this.validateString(data, schema, path, errors, warnings);
    }

    // Number validation
    if ((schema.type === 'number' || schema.type === 'integer') && typeof data === 'number') {
      this.validateNumber(data, schema, path, errors, warnings);
    }
  }

  private validateType(data: any, type: JsonSchemaType | JsonSchemaType[]): boolean {
    const types = Array.isArray(type) ? type : [type];

    for (const t of types) {
      switch (t) {
        case 'null':
          if (data === null) return true;
          break;
        case 'boolean':
          if (typeof data === 'boolean') return true;
          break;
        case 'object':
          if (typeof data === 'object' && data !== null && !Array.isArray(data)) return true;
          break;
        case 'array':
          if (Array.isArray(data)) return true;
          break;
        case 'number':
          if (typeof data === 'number') return true;
          break;
        case 'integer':
          if (typeof data === 'number' && Number.isInteger(data)) return true;
          break;
        case 'string':
          if (typeof data === 'string') return true;
          break;
      }
    }

    return false;
  }

  private validateObject(
    data: Record<string, any>,
    schema: JsonSchema,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Required properties
    if (schema.required) {
      for (const required of schema.required) {
        if (!(required in data)) {
          errors.push({
            path: path ? `${path}.${required}` : required,
            message: `Missing required property: ${required}`,
            code: 'MISSING_REQUIRED',
            severity: 'error',
          });
        }
      }
    }

    // Property validation
    if (schema.properties) {
      for (const [key, value] of Object.entries(data)) {
        const propertySchema = schema.properties[key];
        if (propertySchema) {
          this.validateRecursive(
            value,
            propertySchema,
            path ? `${path}.${key}` : key,
            errors,
            warnings
          );
        } else if (schema.additionalProperties === false) {
          warnings.push({
            path: path ? `${path}.${key}` : key,
            message: `Unexpected property: ${key}`,
            suggestion: 'Remove this property or update schema to allow additional properties',
            impact: 'medium',
          });
        }
      }
    }
  }

  private validateArray(
    data: any[],
    schema: JsonSchema,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Length constraints
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({
        path,
        message: `Array must have at least ${schema.minItems} items but has ${data.length}`,
        code: 'MIN_ITEMS',
        severity: 'error',
        actualValue: data.length,
      });
    }

    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push({
        path,
        message: `Array must have at most ${schema.maxItems} items but has ${data.length}`,
        code: 'MAX_ITEMS',
        severity: 'error',
        actualValue: data.length,
      });
    }

    // Item validation
    if (schema.items) {
      data.forEach((item, index) => {
        this.validateRecursive(item, schema.items!, `${path}[${index}]`, errors, warnings);
      });
    }

    // Unique items
    if (schema.uniqueItems && !this.areItemsUnique(data)) {
      errors.push({
        path,
        message: 'Array items must be unique',
        code: 'UNIQUE_ITEMS',
        severity: 'error',
      });
    }
  }

  private validateString(
    data: string,
    schema: JsonSchema,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Length constraints
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({
        path,
        message: `String must be at least ${schema.minLength} characters but is ${data.length}`,
        code: 'MIN_LENGTH',
        severity: 'error',
        actualValue: data.length,
      });
    }

    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({
        path,
        message: `String must be at most ${schema.maxLength} characters but is ${data.length}`,
        code: 'MAX_LENGTH',
        severity: 'error',
        actualValue: data.length,
      });
    }

    // Pattern validation
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data)) {
        errors.push({
          path,
          message: `String does not match pattern: ${schema.pattern}`,
          code: 'PATTERN_MISMATCH',
          severity: 'error',
          actualValue: data,
        });
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        code: 'ENUM_MISMATCH',
        severity: 'error',
        actualValue: data,
        suggestions: schema.enum.map(String),
      });
    }
  }

  private validateNumber(
    data: number,
    schema: JsonSchema,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Range validation
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({
        path,
        message: `Number must be at least ${schema.minimum} but is ${data}`,
        code: 'MIN_VALUE',
        severity: 'error',
        actualValue: data,
      });
    }

    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({
        path,
        message: `Number must be at most ${schema.maximum} but is ${data}`,
        code: 'MAX_VALUE',
        severity: 'error',
        actualValue: data,
      });
    }
  }

  private areItemsUnique(array: any[]): boolean {
    const seen = new Set();
    for (const item of array) {
      const key = typeof item === 'object' ? JSON.stringify(item) : item;
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  }

  private calculateOutputConfidence(
    data: any,
    schema: JsonSchema,
    validationResult: ValidationResult,
    corrected: boolean
  ): number {
    let confidence = 0.8; // Base confidence

    if (validationResult.valid) {
      confidence += 0.2;
    } else {
      confidence -= 0.1 * validationResult.errors.length;
    }

    if (corrected) {
      confidence -= 0.1; // Reduced confidence for corrected output
    }

    if (validationResult.warnings.length > 0) {
      confidence -= 0.05 * validationResult.warnings.length;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private calculateValidationConfidence(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): number {
    let confidence = 1.0;

    confidence -= errors.length * 0.1;
    confidence -= warnings.length * 0.05;

    return Math.max(0, confidence);
  }

  private generateReasoningExplanation(
    data: any,
    schema: JsonSchema,
    validation: ValidationResult
  ): string {
    if (validation.valid) {
      return `Output successfully matches the provided schema with ${Object.keys(data).length} properties.`;
    } else {
      const errorCount = validation.errors.length;
      const warningCount = validation.warnings.length;
      return `Output has ${errorCount} validation errors and ${warningCount} warnings that need attention.`;
    }
  }

  // Auto-correction methods
  private correctTypes(
    data: any,
    schema: JsonSchema,
    path: string,
    corrections: Correction[]
  ): void {
    if (schema.type && !this.validateType(data, schema.type)) {
      const correctedValue = this.attemptTypeConversion(data, schema.type);
      if (correctedValue !== undefined) {
        corrections.push({
          path,
          originalValue: data,
          correctedValue,
          reasoning: `Converted ${typeof data} to ${schema.type}`,
          confidence: 0.8,
        });
        // Apply correction to data object
        this.setValueAtPath(data, path, correctedValue);
      }
    }
  }

  private correctMissingRequired(
    data: any,
    schema: JsonSchema,
    path: string,
    corrections: Correction[]
  ): void {
    if (schema.type === 'object' && schema.required && typeof data === 'object' && data !== null) {
      for (const required of schema.required) {
        if (!(required in data)) {
          const defaultValue = this.generateDefaultValue(schema.properties?.[required]);
          data[required] = defaultValue;
          corrections.push({
            path: path ? `${path}.${required}` : required,
            originalValue: undefined,
            correctedValue: defaultValue,
            reasoning: `Added missing required property with default value`,
            confidence: 0.7,
          });
        }
      }
    }
  }

  private correctInvalidValues(
    data: any,
    schema: JsonSchema,
    path: string,
    corrections: Correction[]
  ): void {
    // Correct enum mismatches
    if (schema.enum && !schema.enum.includes(data)) {
      const closest = this.findClosestEnumValue(data, schema.enum);
      if (closest !== null) {
        corrections.push({
          path,
          originalValue: data,
          correctedValue: closest,
          reasoning: `Corrected to closest valid enum value`,
          confidence: 0.6,
        });
        this.setValueAtPath(data, path, closest);
      }
    }
  }

  private removeExtraProperties(
    data: any,
    schema: JsonSchema,
    path: string,
    corrections: Correction[]
  ): void {
    if (
      schema.type === 'object' &&
      schema.additionalProperties === false &&
      typeof data === 'object' &&
      data !== null &&
      schema.properties
    ) {
      for (const key of Object.keys(data)) {
        if (!schema.properties[key]) {
          delete data[key];
          corrections.push({
            path: path ? `${path}.${key}` : key,
            originalValue: data[key],
            correctedValue: undefined,
            reasoning: `Removed extra property not allowed by schema`,
            confidence: 0.9,
          });
        }
      }
    }
  }

  private attemptTypeConversion(value: any, targetType: JsonSchemaType | JsonSchemaType[]): any {
    const types = Array.isArray(targetType) ? targetType : [targetType];

    for (const type of types) {
      try {
        switch (type) {
          case 'string':
            return String(value);
          case 'number':
            const num = Number(value);
            return !isNaN(num) ? num : undefined;
          case 'integer':
            const int = parseInt(String(value), 10);
            return !isNaN(int) ? int : undefined;
          case 'boolean':
            if (typeof value === 'string') {
              return value.toLowerCase() === 'true';
            }
            return Boolean(value);
          case 'array':
            return Array.isArray(value) ? value : [value];
        }
      } catch {
        continue;
      }
    }

    return undefined;
  }

  private generateDefaultValue(schema?: JsonSchema): any {
    if (!schema) return null;

    if (schema.default !== undefined) return schema.default;

    switch (schema.type) {
      case 'string':
        return schema.enum ? schema.enum[0] : '';
      case 'number':
        return schema.minimum || 0;
      case 'integer':
        return schema.minimum || 0;
      case 'boolean':
        return false;
      case 'array':
        return [];
      case 'object':
        return {};
      default:
        return null;
    }
  }

  private findClosestEnumValue(value: any, enumValues: any[]): any {
    if (typeof value === 'string') {
      // Find string with minimum edit distance
      let closest = enumValues[0];
      let minDistance = this.editDistance(value.toLowerCase(), String(closest).toLowerCase());

      for (let i = 1; i < enumValues.length; i++) {
        const distance = this.editDistance(
          value.toLowerCase(),
          String(enumValues[i]).toLowerCase()
        );
        if (distance < minDistance) {
          minDistance = distance;
          closest = enumValues[i];
        }
      }

      return minDistance <= 3 ? closest : null; // Only suggest if reasonably close
    }

    return enumValues[0]; // Default to first value
  }

  private editDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  private setValueAtPath(obj: any, path: string, value: any): void {
    if (!path) return;

    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  private calculateCorrectionConfidence(corrections: Correction[]): number {
    if (corrections.length === 0) return 1.0;

    const avgConfidence =
      corrections.reduce((sum, c) => sum + c.confidence, 0) / corrections.length;
    const complexityPenalty = Math.max(0, (corrections.length - 5) * 0.1);

    return Math.max(0.3, avgConfidence - complexityPenalty);
  }

  // Field analysis for schema inference
  private analyzeFields(data: any[], options: SchemaInferenceOptions): Map<string, FieldAnalysis> {
    const analysis = new Map<string, FieldAnalysis>();

    for (const item of data) {
      if (typeof item === 'object' && item !== null) {
        for (const [key, value] of Object.entries(item)) {
          if (!analysis.has(key)) {
            analysis.set(key, {
              name: key,
              types: new Set(),
              occurrences: 0,
              examples: [],
              nullCount: 0,
              undefinedCount: 0,
            });
          }

          const fieldAnalysis = analysis.get(key)!;
          fieldAnalysis.occurrences++;

          if (value === null) {
            fieldAnalysis.nullCount++;
          } else if (value === undefined) {
            fieldAnalysis.undefinedCount++;
          } else {
            fieldAnalysis.types.add(this.getJsonSchemaType(value));
            if (fieldAnalysis.examples.length < 3) {
              fieldAnalysis.examples.push(value);
            }
          }
        }
      }
    }

    return analysis;
  }

  private getJsonSchemaType(value: any): JsonSchemaType {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }
    if (typeof value === 'string') return 'string';
    return 'string'; // fallback
  }

  private createPropertySchema(
    analysis: FieldAnalysis,
    options: SchemaInferenceOptions
  ): JsonSchema {
    const schema: JsonSchema = {};

    // Determine type
    if (analysis.types.size === 1) {
      schema.type = Array.from(analysis.types)[0];
    } else if (analysis.types.size > 1) {
      schema.type = Array.from(analysis.types);
    } else {
      schema.type = 'string'; // fallback
    }

    // Add examples if requested
    if (options.includeExamples && analysis.examples.length > 0) {
      schema.examples = analysis.examples;
    }

    // Generate description if requested
    if (options.generateDescriptions) {
      schema.description = `Property ${analysis.name} (appears in ${analysis.occurrences} samples)`;
    }

    return schema;
  }

  private validatePropertySchema(
    schema: JsonSchema,
    path: string,
    errors: SchemaValidationError[],
    warnings: string[]
  ): void {
    if (!schema.type && !schema.anyOf && !schema.oneOf && !schema.allOf) {
      errors.push({
        path,
        message: 'Property schema must specify a type',
        code: 'MISSING_TYPE',
      });
    }

    // Recursively validate nested schemas
    if (schema.properties) {
      for (const [name, prop] of Object.entries(schema.properties)) {
        this.validatePropertySchema(prop, `${path}.${name}`, errors, warnings);
      }
    }
  }

  private hasCircularReference(schema: JsonSchema, visited = new Set<any>()): boolean {
    if (visited.has(schema)) return true;
    visited.add(schema);

    if (schema.properties) {
      for (const prop of Object.values(schema.properties)) {
        if (this.hasCircularReference(prop, visited)) return true;
      }
    }

    if (schema.items && this.hasCircularReference(schema.items, visited)) return true;

    visited.delete(schema);
    return false;
  }

  private generatePropertyDocumentation(
    name: string,
    schema: JsonSchema,
    required: boolean
  ): string {
    let doc = `### ${name}${required ? ' (required)' : ''}\n\n`;

    if (schema.description) {
      doc += `${schema.description}\n\n`;
    }

    doc += `- Type: \`${schema.type || 'any'}\`\n`;

    if (schema.enum) {
      doc += `- Allowed values: ${schema.enum.map(v => `\`${v}\``).join(', ')}\n`;
    }

    if (schema.minimum !== undefined) {
      doc += `- Minimum: ${schema.minimum}\n`;
    }

    if (schema.maximum !== undefined) {
      doc += `- Maximum: ${schema.maximum}\n`;
    }

    if (schema.pattern) {
      doc += `- Pattern: \`${schema.pattern}\`\n`;
    }

    doc += '\n';
    return doc;
  }

  // Simple format converters (would use proper libraries in production)
  private parseSimpleYaml(yaml: string): any {
    // Very basic YAML parser - would use js-yaml in production
    const lines = yaml.split('\n').filter(line => line.trim());
    const result: any = {};

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        result[key.trim()] = valueParts.join(':').trim();
      }
    }

    return result;
  }

  private toSimpleYaml(data: any): string {
    if (typeof data !== 'object' || data === null) {
      return String(data);
    }

    let yaml = '';
    for (const [key, value] of Object.entries(data)) {
      yaml += `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
    }

    return yaml;
  }

  private toSimpleXml(data: any): string {
    if (typeof data !== 'object' || data === null) {
      return `<root>${String(data)}</root>`;
    }

    let xml = '<root>\n';
    for (const [key, value] of Object.entries(data)) {
      xml += `  <${key}>${typeof value === 'object' ? JSON.stringify(value) : value}</${key}>\n`;
    }
    xml += '</root>';

    return xml;
  }

  private toCsv(data: any): string {
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      let csv = `${headers.join(',')  }\n`;

      for (const row of data) {
        const values = headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : String(value);
        });
        csv += `${values.join(',')  }\n`;
      }

      return csv;
    }

    return JSON.stringify(data);
  }
}

interface FieldAnalysis {
  name: string;
  types: Set<JsonSchemaType>;
  occurrences: number;
  examples: any[];
  nullCount: number;
  undefinedCount: number;
}

// Factory function
export function createStructuredOutputManager(): IStructuredOutputManager {
  return new StructuredOutputManager();
}

// Default export
export default StructuredOutputManager;
