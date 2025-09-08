import { z } from 'zod';
import { logger } from '../infrastructure/logging/logger.js';
import { toError } from '../utils/type-guards.js';

// DATABASE_URL and REDIS_URL are required except in 'test' environment.
// First, parse NODE_ENV to determine environment
const NodeEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const nodeEnvParsed = NodeEnvSchema.safeParse(process.env as Record<string, string | undefined>);
if (!nodeEnvParsed.success) {
  logger.error('Invalid NODE_ENV configuration', toError(JSON.stringify(nodeEnvParsed.error.format())));
  process.exit(1);
}

const { NODE_ENV } = nodeEnvParsed.data;

// Build the rest of the schema based on NODE_ENV
const EnvSchemaBase = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL:
    NODE_ENV === 'production'
      ? z.string().url({ message: 'DATABASE_URL must be a valid URL in production' })
      : z.string().url().optional(),
  REDIS_URL:
    NODE_ENV === 'production'
      ? z.string().url({ message: 'REDIS_URL must be a valid URL in production' })
      : z.string().url().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  // Authentication configuration - required in production
  REQUIRE_AUTHENTICATION: z
    .string()
    .transform(val => val === 'true')
    .default(NODE_ENV === 'production' ? 'true' : 'false'),
});

const EnvSchema = EnvSchemaBase.superRefine(
  (envUnknown: Readonly<unknown>, ctx: z.RefinementCtx): void => {
    const env = envUnknown as Readonly<Env>;
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

    // Enforce authentication in production
    if (env.NODE_ENV === 'production' && !env.REQUIRE_AUTHENTICATION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Authentication must be enabled in production environment',
        path: ['REQUIRE_AUTHENTICATION'],
      });
    }
  }
);

type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env as Record<string, string | undefined>);
if (!parsed.success) {
  logger.error('Invalid environment configuration', toError(JSON.stringify((parsed.error as z.ZodError).format())));
  process.exit(1);
}

export const config: Env = parsed.data;
