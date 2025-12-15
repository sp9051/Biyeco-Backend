import { Response } from 'express';
import { AdminRequest } from '../../../middleware/adminGuard';
import { getUserMetrics } from './users.service';

export const getUserMetricsController = async (
  _req: AdminRequest,
  res: Response
) => {
  const data = await getUserMetrics();
  return res.json({ success: true, data });
};
