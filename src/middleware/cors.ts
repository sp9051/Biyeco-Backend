import cors from 'cors';
import { env } from '../config/env.js';

const allowedOrigins = env.ALLOWED_ORIGINS || [];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    /**
     * ✅ Allow:
     * - same-origin (no Origin header)
     * - explicitly whitelisted origins
     */
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    /**
     * ❌ Reject everything else
     * (do NOT throw Error — just deny)
     */
    return callback(null, false);
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

  maxAge: 86400, // 24 hours
});
