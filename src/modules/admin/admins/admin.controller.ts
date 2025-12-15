import { Request, Response } from 'express';
import { AdminRole } from '@prisma/client';
import {
  createAdminService,
  listAdminsService,
  toggleAdminStatusService,
  updateAdminRoleService,
} from './admin.service';

export const createAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;

    const admin = await createAdminService(
      email,
      password,
      role || AdminRole.ADMIN
    );

    res.status(201).json(admin);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const listAdmins = async (_req: Request, res: Response) => {
  const admins = await listAdminsService();
  res.json(admins);
};

export const toggleAdminStatus = async (req: Request, res: Response) => {
  try {
    const admin = await toggleAdminStatusService(req.params.id);
    res.json(admin);
  } catch (err: any) {
    res.status(404).json({ message: err.message });
  }
};

export const updateAdminRole = async (req: Request, res: Response) => {
  const { role } = req.body;

  const admin = await updateAdminRoleService(
    req.params.id,
    role
  );

  res.json(admin);
};
