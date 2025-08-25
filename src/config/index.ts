import { z } from "zod";

// DATABASE_URL and REDIS_URL are required except in 'test' environment.
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["trace","debug","info","warn","error"]).default("info"),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== "test") {
    if (!env.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL is required except in test environment",
        path: ["DATABASE_URL"],
      });
    }
    if (!env.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "REDIS_URL is required except in test environment",
        path: ["REDIS_URL"],
      });
    }
  }
});

const parsed = EnvSchema.safeParse(process.env as Record<string, string | undefined>);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
