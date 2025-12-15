import { Router } from 'express';
import { listPlans, updatePlan } from './plan.controller';
import { adminAuth } from '../../../middleware/adminAuth';
import { adminGuard } from '../../../middleware/adminGuard';
import { AdminRole } from '@prisma/client';

const router = Router();

router.get(
  '/',
  adminAuth,
  adminGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  listPlans
);

router.patch(
  '/:id',
  adminAuth,
  adminGuard([AdminRole.SUPER_ADMIN]),
  updatePlan
);

export default router;
