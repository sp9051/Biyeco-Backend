import { PrismaClient } from '@prisma/client';
import { rankingService } from './ranking.service.js';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

export class RecommendationService {
  async getRecommendations(
    userId: string,
    cursor: { id: string; createdAt: Date } | null,
    limit: number
  ) {
    const userProfile = await prisma.profile.findFirst({
      where: { userId },
      include: { preferences: true },
    });

    const baseQuery: any = {
      published: true,
      deletedAt: null,
      userId: { not: userId },
    };

    if (cursor) {
      baseQuery.OR = [
        {
          createdAt: { lt: cursor.createdAt },
        },
        {
          createdAt: cursor.createdAt,
          id: { lt: cursor.id },
        },
      ];
    }

    const profiles = await prisma.profile.findMany({
      where: baseQuery,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        photos: {
          where: {
            moderationStatus: 'approved',
            deletedAt: null,
          },
        },
      },
    });

    const rankedProfiles = rankingService.rankProfiles(
      profiles,
      userProfile?.preferences
    );

    logger.info('Recommendations generated', {
      userId,
      count: rankedProfiles.length,
      hasCursor: !!cursor,
    });

    return rankedProfiles;
  }

  async getNewProfiles(
    userId: string,
    cursor: { id: string; createdAt: Date } | null,
    limit: number
  ) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const baseQuery: any = {
      published: true,
      deletedAt: null,
      userId: { not: userId },
      createdAt: { gte: startOfToday },
    };

    if (cursor) {
      baseQuery.OR = [
        {
          createdAt: { lt: cursor.createdAt },
        },
        {
          createdAt: cursor.createdAt,
          id: { lt: cursor.id },
        },
      ];
    }

    const profiles = await prisma.profile.findMany({
      where: baseQuery,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        photos: {
          where: {
            moderationStatus: 'approved',
            deletedAt: null,
          },
        },
      },
    });

    logger.info('New profiles fetched', {
      userId,
      count: profiles.length,
      date: startOfToday.toISOString(),
    });

    return profiles;
  }

  async getNearbyProfiles(
    userId: string,
    cursor: { id: string; createdAt: Date } | null,
    limit: number
  ) {
    const userProfile = await prisma.profile.findFirst({
      where: { userId },
    });

    if (!userProfile || !userProfile.location) {
      logger.warn('User profile or location not found for nearby search', { userId });
      return [];
    }

    const userCity = (userProfile.location as any)?.city;

    if (!userCity) {
      return [];
    }

    const baseQuery: any = {
      published: true,
      deletedAt: null,
      userId: { not: userId },
    };

    if (cursor) {
      baseQuery.OR = [
        {
          createdAt: { lt: cursor.createdAt },
        },
        {
          createdAt: cursor.createdAt,
          id: { lt: cursor.id },
        },
      ];
    }

    const profiles = await prisma.profile.findMany({
      where: baseQuery,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        photos: {
          where: {
            moderationStatus: 'approved',
            deletedAt: null,
          },
        },
      },
    });

    const nearbyProfiles = profiles.filter((profile) => {
      const profileCity = (profile.location as any)?.city;
      return profileCity === userCity;
    });

    logger.info('Nearby profiles fetched (stub - city match only)', {
      userId,
      userCity,
      count: nearbyProfiles.length,
    });

    return nearbyProfiles;
  }
}

export const recommendationService = new RecommendationService();
