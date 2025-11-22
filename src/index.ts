import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { helmetMiddleware } from './middleware/helmet.js';
import { corsMiddleware } from './middleware/cors.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logRequest } from './utils/logger.js';
import healthRoute from './routes/health.route.js';
import authRoutes from './modules/auth/auth.routes.js';
import profileRoutes from './modules/profile/profile.routes.js';

export function createApp() {
  const app = express();

  app.use(requestIdMiddleware);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logRequest(req.requestId, req.method, req.path, res.statusCode, duration);
    });

    next();
  });

  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(rateLimiter);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  app.use('/api/health', healthRoute);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/profiles', profileRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        message: 'Route not found',
        code: 'NOT_FOUND',
      },
    });
  });

  app.use(errorHandler);

  return app;
}

export const app = createApp();
