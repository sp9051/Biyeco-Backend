import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';

import { helmetMiddleware } from './middleware/helmet.js';
import { corsMiddleware } from './middleware/cors.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logRequest } from './utils/logger.js';

import healthRoute from './routes/health.route.js';
import authRoutes from './modules/auth/auth.routes.js';
import profileRoutes from './modules/profile/profile.routes.js';
import mediaRoutes from './modules/media/media.routes.js';
import moderationRoutes from './modules/media/moderation.routes.js';
import profilePhotosRoutes from './modules/profile/profile.photos.routes.js';
import discoveryRoutes from './modules/discovery/discovery.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import connectionsRoutes from './modules/connections/connections.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';

export function createApp() {
  const app = express();

  /**
   * =====================================================
   * 1️⃣ REQUEST ID (safe first)
   * =====================================================
   */
  app.use(requestIdMiddleware);

  /**
   * =====================================================
   * 2️⃣ CORS — MUST BE FIRST REAL MIDDLEWARE
   * =====================================================
   */
  app.use(corsMiddleware);
  app.options('*', corsMiddleware); // ✅ allow preflight

  /**
   * =====================================================
   * 3️⃣ SECURITY HEADERS
   * =====================================================
   */
  app.use(helmetMiddleware);

  /**
   * =====================================================
   * 4️⃣ REQUEST LOGGER
   * =====================================================
   */
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logRequest(
        req.requestId,
        req.method,
        req.originalUrl,
        res.statusCode,
        duration
      );
    });

    next();
  });

  /**
   * =====================================================
   * 5️⃣ BODY PARSERS
   * =====================================================
   */
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  /**
   * =====================================================
   * 6️⃣ STATIC FILES
   * =====================================================
   */
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  /**
   * =====================================================
   * 7️⃣ RATE LIMIT (AFTER CORS & OPTIONS)
   * =====================================================
   */
  app.use(rateLimiter);

  /**
   * =====================================================
   * 8️⃣ ROUTES
   * =====================================================
   */
  app.use('/api/health', healthRoute);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/profiles', profileRoutes);
  app.use('/api/v1/profiles', profilePhotosRoutes);
  app.use('/api/v1/media', mediaRoutes);
  app.use('/api/v1/media/moderation', moderationRoutes);
  app.use('/api/v1/discovery', discoveryRoutes);
  app.use('/api/v1/search', searchRoutes);
  app.use('/api/v1/connections', connectionsRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/admin', adminRoutes);

  /**
   * =====================================================
   * 9️⃣ 404 HANDLER
   * =====================================================
   */
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        message: 'Route not found',
        code: 'NOT_FOUND',
      },
    });
  });

  /**
   * =====================================================
   * 🔟 GLOBAL ERROR HANDLER (LAST)
   * =====================================================
   */
  app.use(errorHandler);

  return app;
}

export const app = createApp();
