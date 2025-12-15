import { Router } from 'express';
import { getUserMetricsController } from './users.controller';
import { adminAuth } from '../../../middleware/adminAuth';
import { adminGuard } from '../../../middleware/adminGuard';
import { AdminRole } from '@prisma/client';

const router = Router();

/**
 * 📊 USER METRICS
 * SUPER_ADMIN, ADMIN, MODERATOR (read-only)
 */
router.get(
  '/metrics',
  adminAuth,
  adminGuard([
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.MODERATOR,
  ]),
  getUserMetricsController
);

export default router;
