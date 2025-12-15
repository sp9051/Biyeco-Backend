import { Request, Response } from 'express';
import { getDashboardMetrics as getMetrics } from './dashboard.service';

export const getDashboardMetrics = async (
  _req: Request,
  res: Response
) => {
  const data = await getMetrics();
  return res.json({ success: true, data });
};
