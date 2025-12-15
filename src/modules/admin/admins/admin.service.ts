import bcrypt from 'bcryptjs';
import { prisma } from '../../../config/prisma';
import { AdminRole } from '@prisma/client';

export async function createAdminService(
  email: string,
  password: string,
  role: AdminRole
) {
  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) throw new Error('Admin already exists');

  const hashed = await bcrypt.hash(password, 10);

  return prisma.admin.create({
    data: {
      email,
      password: hashed,
      role,
    },
  });
}

export async function listAdminsService() {
  return prisma.admin.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function toggleAdminStatusService(id: string) {
  const admin = await prisma.admin.findUnique({ where: { id } });
  if (!admin) throw new Error('Admin not found');

  return prisma.admin.update({
    where: { id },
    data: { isActive: !admin.isActive },
  });
}

export async function updateAdminRoleService(
  id: string,
  role: AdminRole
) {
  return prisma.admin.update({
    where: { id },
    data: { role },
  });
}
