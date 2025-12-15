import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminRequest } from './adminGuard';
import { AdminRole } from '@prisma/client';

export const adminAuth = (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Missing admin token' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const payload = jwt.verify(
      token,
      process.env.ADMIN_JWT_SECRET!
    ) as {
      adminId: string;
      role: AdminRole;
    };

    req.admin = {
      id: payload.adminId,
      role: payload.role,
    };

    return next(); // ✅ explicit return
  } catch (err) {
    return res.status(401).json({ message: 'Invalid admin token' });
  }
};
