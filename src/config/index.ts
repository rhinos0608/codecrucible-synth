import { z } from 'zod';
import { logger } from '../core/logger.js';

// First, parse NODE_ENV to determine environment
const NodeEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const nodeEnvParsed = NodeEnvSchema.safeParse(process.env as Record<string, string | undefined>);
if (!nodeEnvParsed.success) {
  logger.error('Invalid NODE_ENV configuration:', nodeEnvParsed.error.format());
  process.exit(1);
}

const NODE_ENV = nodeEnvParsed.data.NODE_ENV;

// Comprehensive environment configuration schema
const EnvSchema = z
  .object({
    // Environment and Core Configuration
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
    DEBUG_MODE: z.coerce.boolean().default(false),

    // Legacy Database Configuration (backwards compatibility)
    DATABASE_URL:
      NODE_ENV === 'production'
        ? z.string().url({ message: 'DATABASE_URL must be a valid URL in production' })
        : z.string().url().optional(),
    REDIS_URL:
      NODE_ENV === 'production'
        ? z.string().url({ message: 'REDIS_URL must be a valid URL in production' })
        : z.string().url().optional(),
    PORT: z.coerce.number().default(3000),

    // AI Provider Configuration
    OLLAMA_ENDPOINT: z.string().url().default('http://localhost:11434'),
    LM_STUDIO_ENDPOINT: z.string().url().default('http://localhost:1234'),
    OLLAMA_TIMEOUT: z.coerce.number().min(1000).default(110000),
    LM_STUDIO_TIMEOUT: z.coerce.number().min(1000).default(180000),

    // API Keys (optional in development/test, required in production for relevant features)
    SMITHERY_API_KEY: z.string().optional(),
    E2B_API_KEY: z.string().optional(),
    MCP_TERMINAL_API_KEY: z.string().optional(),
    MCP_TASK_MANAGER_API_KEY: z.string().optional(),

    // Model Configuration
    MODEL_MAX_TOKENS: z.coerce.number().min(1).max(32768).default(3000),
    MODEL_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),

    // Timeout Configuration (in milliseconds)
    REQUEST_TIMEOUT: z.coerce.number().min(1000).max(600000).default(30000),
    TOOL_EXECUTION_TIMEOUT: z.coerce.number().min(1000).max(600000).default(30000),
    MEMORY_MONITORING_TIMEOUT: z.coerce.number().min(1000).default(300000),
    CACHE_TTL: z.coerce.number().min(1000).default(300000),

    // Server Configuration
    SERVER_PORT: z.coerce.number().min(1).max(65535).default(3002),
    INTERNAL_API_PORT: z.coerce.number().min(1).max(65535).default(3000),

    // Performance Configuration
    MAX_CONCURRENT_REQUESTS: z.coerce.number().min(1).max(100).default(10),
    RESPONSE_CACHE_SIZE: z.coerce.number().min(1).default(100),
    MEMORY_WARNING_THRESHOLD: z.coerce.number().min(1).default(512),

    // Security Configuration
    STRICT_MODE: z.coerce.boolean().default(true),
    VALIDATE_INPUTS: z.coerce.boolean().default(true),
    ENABLE_RATE_LIMITING: z.coerce.boolean().default(true),
  })
  .superRefine((env, ctx) => {
    // Backwards compatibility: DATABASE_URL and REDIS_URL required except in test
    if (env.NODE_ENV !== 'test') {
      if (!env.DATABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DATABASE_URL is required except in test environment',
          path: ['DATABASE_URL'],
        });
      }
      if (!env.REDIS_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'REDIS_URL is required except in test environment',
          path: ['REDIS_URL'],
        });
      }
    }

    // Port conflict validation
    if (env.SERVER_PORT === env.INTERNAL_API_PORT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SERVER_PORT and INTERNAL_API_PORT cannot be the same',
        path: ['SERVER_PORT'],
      });
    }

    // Production security validation
    if (env.NODE_ENV === 'production') {
      if (!env.STRICT_MODE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'STRICT_MODE must be enabled in production environment',
          path: ['STRICT_MODE'],
        });
      }
      if (!env.VALIDATE_INPUTS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'VALIDATE_INPUTS must be enabled in production environment',
          path: ['VALIDATE_INPUTS'],
        });
      }
    }
  });

const parsed = EnvSchema.safeParse(process.env as Record<string, string | undefined>);
if (!parsed.success) {
  logger.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

// Export the parsed and validated configuration
export const config = parsed.data;

// Export types for use throughout the application
export type Config = typeof config;
