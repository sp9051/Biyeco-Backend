import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { AdminRole } from '@prisma/client';

export interface AdminRequest extends Request {
  admin?: {
    id: string;
    role: AdminRole;
  };
}

export const adminGuard =
  (allowedRoles: AdminRole[]) =>
  async (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({ message: 'Admin authentication required' });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
    });

    if (!admin || !admin.isActive) {
      return res.status(403).json({ message: 'Admin access revoked' });
    }

    if (!allowedRoles.includes(admin.role)) {
      return res.status(403).json({ message: 'Insufficient admin privileges' });
    }

    return next(); // ✅ explicit return
  };
