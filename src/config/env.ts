import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'postgresql://postgres:postgres@localhost:5432/biye_db'),
  REDIS_URL: z.string().min(1, 'redis://127.0.0.1:6379'),
  JWT_SECRET: z.string().min(32, '58038c80d42a960fe3618326f7ac0273'),
  JWT_REFRESH_SECRET: z.string().min(32, '6411c27a28bc57b0841348b5d21adb3c'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number).refine((val) => !Number.isNaN(val), {
    message: 'PORT must be a valid number',
  }),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  ALLOWED_ORIGINS: z.string().transform((val) => val.split(',').map((origin) => origin.trim())),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join('\n');
      throw new Error(`Environment validation failed:\n${missingVars}`);
    }
    throw error;
  }
}

export const env = validateEnv();
