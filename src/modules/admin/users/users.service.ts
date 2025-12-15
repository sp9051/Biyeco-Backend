import { prisma } from '../../../config/prisma';
import { subDays } from 'date-fns';

export async function getUserMetrics() {
  const now = new Date();
  const last24h = subDays(now, 1);
  const last7d = subDays(now, 7);

  // Total users
  const totalUsers = await prisma.user.count();

  // New users today
  const newUsersToday = await prisma.user.count({
    where: {
      createdAt: { gte: last24h },
    },
  });

  // Daily active users (distinct userId via sessions)
  const dailyActiveUsers = await prisma.session.groupBy({
    by: ['userId'],
    where: {
      lastSeenAt: { gte: last24h },
      revoked: false,
    },
  });

  // Weekly active users
  const weeklyActiveUsers = await prisma.session.groupBy({
    by: ['userId'],
    where: {
      lastSeenAt: { gte: last7d },
      revoked: false,
    },
  });

  return {
    totalUsers,
    newUsersToday,
    dailyActiveUsers: dailyActiveUsers.length,
    weeklyActiveUsers: weeklyActiveUsers.length,
  };
}
