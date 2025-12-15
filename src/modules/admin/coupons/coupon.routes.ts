import { Router } from 'express';
import { adminAuth } from '../../../middleware/adminAuth';
import { adminGuard } from '../../../middleware/adminGuard';
import { AdminRole } from '@prisma/client';

import {
  createCoupon,
  listCoupons,
  toggleCoupon,
  deleteCoupon,
} from './coupon.controller';

const router = Router();

/**
 * View coupons (read-only)
 * SUPER_ADMIN, ADMIN, MODERATOR
 */
router.get(
  '/',
  adminAuth,
  adminGuard([
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.MODERATOR,
  ]),
  listCoupons
);

/**
 * Create coupon
 * SUPER_ADMIN only
 */
router.post(
  '/',
  adminAuth,
  adminGuard([AdminRole.SUPER_ADMIN]),
  createCoupon
);

/**
 * Enable / Disable coupon
 * SUPER_ADMIN only
 */
router.patch(
  '/:id/toggle',
  adminAuth,
  adminGuard([AdminRole.SUPER_ADMIN]),
  toggleCoupon
);

/**
 * Delete coupon
 * SUPER_ADMIN only
 */
router.delete(
  '/:id',
  adminAuth,
  adminGuard([AdminRole.SUPER_ADMIN]),
  deleteCoupon
);

export default router;
