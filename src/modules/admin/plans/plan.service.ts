import { prisma } from '../../../config/prisma';

interface UpdatePlanDTO {
  price?: number;
  durationDays?: number;
  isInviteOnly?: boolean;
  features?: any;
}

export const getAllPlans = async () => {
  return prisma.plan.findMany({
    orderBy: { createdAt: 'asc' },
  });
};

export const updatePlanById = async (
  planId: string,
  data: UpdatePlanDTO
) => {
  return prisma.plan.update({
    where: { id: planId },
    data,
  });
};
