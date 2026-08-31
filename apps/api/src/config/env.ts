import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

// Resolve the monorepo-root .env regardless of the process's cwd (npm
// workspace scripts run with cwd = the workspace directory, not the root).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url(),
  DEFAULT_EXCLUDED_PATTERNS: z.string().default(''),

  SESSION_COOKIE_NAME: z.string().default('acra_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),

  TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64, 'TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'),

  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),
  GITHUB_OAUTH_SCOPES: z.string().default('read:user,repo'),

  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(4000),

  MAX_CHANGED_FILES: z.coerce.number().int().positive().default(40),
  MAX_RELEVANT_FILES: z.coerce.number().int().positive().default(8),
  MAX_FILE_SIZE_KB: z.coerce.number().int().positive().default(64),
  MAX_CONTEXT_TOKENS: z.coerce.number().int().positive().default(12000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export const defaultExcludedPatterns = env.DEFAULT_EXCLUDED_PATTERNS.split(',')
  .map((p) => p.trim())
  .filter(Boolean);
