import { prisma } from '../../../config/prisma';
import dayjs from 'dayjs';

export async function getDashboardMetrics() {
  const today = dayjs().startOf('day').toDate();
  const weekAgo = dayjs().subtract(7, 'day').toDate();

  // 1️⃣ TOTAL USERS
  const totalUsers = await prisma.user.count();

  // 2️⃣ DAILY ACTIVE USERS
  const dailyActive = await prisma.session.count({
    where: {
      lastSeenAt: { gte: today },
    },
  });

  // 3️⃣ WEEKLY ACTIVE USERS
  const weeklyActive = await prisma.session.count({
    where: {
      lastSeenAt: { gte: weekAgo },
    },
  });

  // 4️⃣ NEW SIGNUPS TODAY
  const newSignup = await prisma.user.count({
    where: {
      createdAt: { gte: today },
    },
  });

  // 5️⃣ FREE USERS (profiles with NO active subscription)
  const freeUsers = await prisma.profile.count({
    where: {
      subscriptions: {
        none: {
          status: 'active',
        },
      },
    },
  });

  // 6️⃣ PAID USERS + COLLECTION PER PLAN
  const plans = await prisma.plan.findMany({
    select: { id: true, code: true },
  });

  const planStats = await Promise.all(
    plans.map(async (plan) => {
      const users = await prisma.subscription.count({
        where: {
          planId: plan.id,
          status: 'active',
        },
      });

      const collection = await prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'success',
          subscription: {
            planId: plan.id,
          },
        },
      });

      return {
        plan: plan.code,
        users,
        collection: collection._sum.amount || 0,
      };
    })
  );

  return {
    totalUsers,
    dailyActive,
    weeklyActive,
    newSignup,
    freeUsers,
    planStats,
  };
}
