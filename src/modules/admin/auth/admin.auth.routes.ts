import { Router } from 'express';
import {
  adminLogin,
  changeAdminPassword,
} from './admin.auth.controller';
import { adminAuth } from '../../../middleware/adminAuth';

const router = Router();

/**
 * =========================
 * AUTH
 * =========================
 */

/**
 * 🔓 Admin Login
 * Public
 */
router.post('/login', adminLogin);

/**
 * =========================
 * PASSWORD MANAGEMENT
 * =========================
 *
 * 🔐 Change Password
 *
 * CASE 1:
 * - Admin changes own password
 * - Requires oldPassword + newPassword
 *
 * CASE 2:
 * - SUPER_ADMIN resets another admin password
 * - Requires adminId + newPassword
 *
 * RBAC enforced inside controller
 */
router.post(
  '/change-password',
  adminAuth, // JWT required
  changeAdminPassword
);

export default router;
