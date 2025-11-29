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
    const effectiveUserId = await this.resolveCandidateUserId(userId);

    console.log(userId);
    console.log(effectiveUserId);

    const userProfile = await prisma.profile.findFirst({
      where: { userId: effectiveUserId },
      include: { preferences: true },
    });
    console.log(userProfile);


    const baseQuery: any = {
      published: true,
      deletedAt: null,
      userId: { not: effectiveUserId },
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
    console.log(profiles)

    const rankedProfiles = rankingService.rankProfiles(
      profiles,
      userProfile?.preferences
    );
    console.log(rankedProfiles)
    console.log("profiles hello")



    logger.info('Recommendations generated', {
      userId,
      effectiveUserId,
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
    const effectiveUserId = await this.resolveCandidateUserId(userId);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const baseQuery: any = {
      published: true,
      deletedAt: null,
      userId: { not: effectiveUserId },
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
      effectiveUserId,
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
    const effectiveUserId = await this.resolveCandidateUserId(userId);

    const userProfile = await prisma.profile.findFirst({
      where: { userId: effectiveUserId },
    });

    if (!userProfile || !userProfile.location) {
      logger.warn('User profile or location not found for nearby search', { userId, effectiveUserId });
      return [];
    }

    const userCity = (userProfile.location as any)?.city;

    if (!userCity) {
      return [];
    }

    const baseQuery: any = {
      published: true,
      deletedAt: null,
      userId: { not: effectiveUserId },
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

    const nearbyProfiles = profiles.filter((profile: any) => {
      const profileCity = (profile.location as any)?.city;
      return profileCity === userCity;
    });

    logger.info('Nearby profiles fetched (stub - city match only)', {
      userId,
      effectiveUserId,
      userCity,
      count: nearbyProfiles.length,
    });

    return nearbyProfiles;
  }

  /**
   * Use the same role logic as elsewhere:
   * - self/candidate → use own userId
   * - parent        → use linked candidate's profile.userId via CandidateLink
   */
  private async resolveCandidateUserId(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new Error('user not found');
    }

    if (user.role === 'self' || user.role === 'candidate') {
      return userId;
    }

    if (user.role === 'parent') {
      const link = await prisma.candidateLink.findFirst({
        where: {
          parentUserId: userId,
          status: 'active',
        },
        include: { profile: true },
      });

      const linkedProfileUserId = link?.profile.userId;

      if (!linkedProfileUserId) {
        throw new Error('No active candidate profile linked to this parent');
      }

      return linkedProfileUserId;
    }
    if (user.role === 'guardian') {
      const link = await prisma.candidateLink.findFirst({
        where: {
          childUserId: userId,
          status: 'active',
        },
        include: { profile: true },
      });

      const linkedProfileUserId = link?.profile.userId;

      if (!linkedProfileUserId) {
        throw new Error('No active candidate profile linked to this parent');
      }

      return linkedProfileUserId;
    }

    // If you add guardian or other roles later, extend this logic here.
    return userId;
  }
}

export const recommendationService = new RecommendationService();
