import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../config/prisma';
import { AdminRequest } from '../../../middleware/adminGuard';
import { AdminRole } from '@prisma/client';

/**
 * =========================
 * ADMIN LOGIN
 * =========================
 */
export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const passwordValid = await bcrypt.compare(password, admin.password);

    if (!passwordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        adminId: admin.id,
        role: admin.role,
      },
      process.env.ADMIN_JWT_SECRET!,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ message: 'Admin login failed' });
  }
};

/**
 * =========================
 * CHANGE PASSWORD
 * =========================
 *
 * CASE 1: Admin changes own password
 * CASE 2: Super Admin resets another admin's password
 */
export const changeAdminPassword = async (
  req: AdminRequest,
  res: Response
) => {
  try {
    const requester = req.admin!;
    const { oldPassword, newPassword, adminId } = req.body;

    /**
     * 🔹 CASE 1: SUPER ADMIN resetting another admin password
     */
    if (adminId) {
      if (requester.role !== AdminRole.SUPER_ADMIN) {
        return res
          .status(403)
          .json({ message: 'Only Super Admin can reset other admins passwords' });
      }

      if (!newPassword) {
        return res.status(400).json({ message: 'New password is required' });
      }

      const targetAdmin = await prisma.admin.findUnique({
        where: { id: adminId },
      });

      if (!targetAdmin || !targetAdmin.isActive) {
        return res.status(404).json({ message: 'Target admin not found' });
      }

      const hashed = await bcrypt.hash(newPassword, 10);

      await prisma.admin.update({
        where: { id: adminId },
        data: { password: hashed },
      });

      return res.json({
        message: 'Admin password reset successfully',
      });
    }

    /**
     * 🔹 CASE 2: Admin changing own password
     */
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Old password and new password required' });
    }

    const selfAdmin = await prisma.admin.findUnique({
      where: { id: requester.id },
    });

    if (!selfAdmin || !selfAdmin.isActive) {
      return res.status(403).json({ message: 'Admin not allowed' });
    }

    const match = await bcrypt.compare(oldPassword, selfAdmin.password);

    if (!match) {
      return res.status(400).json({ message: 'Old password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.admin.update({
      where: { id: requester.id },
      data: { password: hashed },
    });

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change admin password error:', err);
    return res.status(500).json({ message: 'Password update failed' });
  }
};
