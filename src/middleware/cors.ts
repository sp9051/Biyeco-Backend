import cors from 'cors';
import { env } from '../config/env.js';

const allowedOrigins: string[] = env.ALLOWED_ORIGINS ?? [];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow server-to-server & same-origin
    if (!origin) return callback(null, true);

    // Allow whitelisted origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Explicitly block others
    return callback(new Error('CORS not allowed'), false);
  },

  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-Id',
    'Idempotency-Key',
  ],

  exposedHeaders: ['X-Request-Id'],

  maxAge: 86400,
});