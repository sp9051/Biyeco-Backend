import { Router } from 'express';
import { adminAuth } from '../../../middleware/adminAuth';
import { adminGuard } from '../../../middleware/adminGuard';
import { AdminRole } from '@prisma/client';

import {
  createAdmin,
  listAdmins,
  toggleAdminStatus,
  updateAdminRole,
} from './admin.controller';

const router = Router();

/**
 * 🔐 SUPER ADMIN ONLY
 */
router.post(
  '/',
  adminAuth,
  adminGuard([AdminRole.SUPER_ADMIN]),
  createAdmin
);

router.get(
  '/',
  adminAuth,
  adminGuard([AdminRole.SUPER_ADMIN]),
  listAdmins
);

router.patch(
  '/:id/status',
  adminAuth,
  adminGuard([AdminRole.SUPER_ADMIN]),
  toggleAdminStatus
);

router.patch(
  '/:id/role',
  adminAuth,
  adminGuard([AdminRole.SUPER_ADMIN]),
  updateAdminRole
);

export default router;
