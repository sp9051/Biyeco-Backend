import { Router } from 'express';

import adminAuthRoutes from './auth/admin.auth.routes';
import dashboardRoutes from './dashboard/dashboard.routes';
import couponRoutes from './coupons/coupon.routes';
import planRoutes from './plans/plan.routes';
import userRoutes from './users/users.routes'; // 👈 ADD THIS

const router = Router();

/**
 * 🔐 Admin Authentication
 * /api/v1/admin/auth/*
 */
router.use('/auth', adminAuthRoutes);

/**
 * 📊 Dashboard & Metrics
 * /api/v1/admin/dashboard
 */
router.use('/dashboard', dashboardRoutes);

/**
 * 👥 User Management (Admin Panel)
 * /api/v1/admin/users
 */
router.use('/users', userRoutes);

/**
 * 🎟 Coupons Management
 * /api/v1/admin/coupons
 */
router.use('/coupons', couponRoutes);

/**
 * 💳 Plans (Pricing, Read-only for now)
 * /api/v1/admin/plans
 */
router.use('/plans', planRoutes);

export default router;
