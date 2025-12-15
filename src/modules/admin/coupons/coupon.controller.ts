import { Request, Response } from 'express';
import { prisma } from '../../../config/prisma.js';

/**
 * CREATE COUPON (SUPER_ADMIN)
 */
export const createCoupon = async (req: Request, res: Response) => {
  const { code, discountPct, planCode, maxUses, expiresAt } = req.body;

  const existing = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (existing) {
    return res.status(400).json({ message: 'Coupon already exists' });
  }

  const coupon = await prisma.coupon.create({
    data: {
      code: code.toUpperCase(),
      discountPct,
      planCode,
      maxUses,
      expiresAt,
    },
  });

  return res.status(201).json({ success: true, data: coupon });
};

/**
 * LIST COUPONS (READ-ONLY)
 * SUPER_ADMIN | ADMIN | MODERATOR
 */
export const listCoupons = async (_req: Request, res: Response) => {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ success: true, data: coupons });
};

/**
 * TOGGLE COUPON (ENABLE / DISABLE)
 * SUPER_ADMIN
 */
export const toggleCoupon = async (req: Request, res: Response) => {
  const { id } = req.params;

  const coupon = await prisma.coupon.findUnique({
    where: { id },
  });

  if (!coupon) {
    return res.status(404).json({ message: 'Coupon not found' });
  }

  const updated = await prisma.coupon.update({
    where: { id },
    data: { isActive: !coupon.isActive },
  });

  return res.json({ success: true, data: updated });
};

/**
 * DELETE COUPON (HARD DELETE)
 * SUPER_ADMIN
 */
export const deleteCoupon = async (req: Request, res: Response) => {
  const { id } = req.params;

  const coupon = await prisma.coupon.findUnique({
    where: { id },
  });

  if (!coupon) {
    return res.status(404).json({ message: 'Coupon not found' });
  }

  await prisma.coupon.delete({
    where: { id },
  });

  return res.json({
    success: true,
    message: 'Coupon deleted successfully',
  });
};
