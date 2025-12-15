import { Request, Response } from 'express';
import { getAllPlans, updatePlanById } from './plan.service';

export const listPlans = async (_req: Request, res: Response) => {
  const plans = await getAllPlans();
  return res.json(plans);
};

export const updatePlan = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { price, durationDays, isInviteOnly, features } = req.body;

  const updatedPlan = await updatePlanById(id, {
    price,
    durationDays,
    isInviteOnly,
    features,
  });

  return res.json(updatedPlan);
};
