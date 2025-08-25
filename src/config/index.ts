import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["trace","debug","info","warn","error"]).default("info"),
});

const parsed = EnvSchema.safeParse(process.env as Record<string, string | undefined>);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
