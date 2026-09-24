import { z } from 'zod';

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment (production, CI).
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.url(),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  /** Where customer sites reach the public snippet endpoints (/s/...). */
  PUBLIC_API_URL: z.url().default('http://localhost:3000'),
  /** Pages rendered at once by the snapshot browser; keep at 1 on small instances. */
  RENDER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  /** Trust X-Forwarded-For from this many proxy hops (0 when the API is reached directly). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  // Copy generation. With AI_PROVIDER=auto, Claude is used only when an API key is present.
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  AI_PROVIDER: z.enum(['auto', 'anthropic', 'mock']).default('auto'),
  AI_MODEL: z.string().min(1).default('claude-opus-5'),
  AI_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('high'),
});

export const env = envSchema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';
