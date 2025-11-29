import { PrismaClient } from '@prisma/client';
import { SendInterestDTO, AcceptInterestDTO, DeclineInterestDTO, WithdrawInterestDTO } from './connections.dto.js';
import { interestRateLimitService } from './interestRateLimit.service.js';
import { logger } from '../../utils/logger.js';
import { eventBus } from '../../events/eventBus.js';


const prisma = new PrismaClient();

export class ConnectionsService {
  async sendInterest(fromUserId: string, dto: SendInterestDTO) {
    const { toUserId } = dto;

    if (fromUserId === toUserId) {
      throw new Error('Cannot send interest to yourself');
    }

    const fromProfile = await prisma.profile.findFirst({
      where: { userId: fromUserId },
    });

    if (!fromProfile || !fromProfile.published) {
      throw new Error('You must have a published profile to send interests');
    }

    const toProfile = await prisma.profile.findFirst({
      where: { userId: toUserId },
    });
    console.log(toProfile)

    if (!toProfile || !toProfile.published) {
      throw new Error('Target profile not found or not published');
    }

    const canSend = await interestRateLimitService.checkRateLimit(fromUserId);
    if (!canSend) {
      const remaining = await interestRateLimitService.getRemainingCount(fromUserId);
      throw new Error(`LIMIT_REACHED: You have reached your daily limit of 20 interests. Remaining: ${remaining}`);
    }

    const existingInterest = await prisma.interest.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId,
          toUserId,
        },
      },
    });

    if (existingInterest) {
      if (existingInterest.status === 'pending') {
        logger.info('Interest already exists with pending status', {
          fromUserId,
          toUserId,
          interestId: existingInterest.id,
        });
        return {
          id: existingInterest.id,
          status: 'pending',
          createdAt: existingInterest.createdAt,
        };
      }

      if (existingInterest.status === 'declined' || existingInterest.status === 'withdrawn') {
        const updated = await prisma.interest.update({
          where: { id: existingInterest.id },
          data: { status: 'pending', updatedAt: new Date() },
        });

        await interestRateLimitService.incrementRateLimit(fromUserId);

        logger.info('Interest re-sent (updated from declined/withdrawn to pending)', {
          fromUserId,
          toUserId,
          interestId: updated.id,
        });

        return {
          id: updated.id,
          status: 'pending',
          createdAt: updated.createdAt,
        };
      }

      if (existingInterest.status === 'accepted') {
        throw new Error('Interest already accepted');
      }
    }

    const interest = await prisma.interest.create({
      data: {
        fromUserId,
        toUserId,
        status: 'pending',
      },
    });

    await interestRateLimitService.incrementRateLimit(fromUserId);

    logger.info('Interest sent successfully', {
      fromUserId,
      toUserId,
      interestId: interest.id,
    });
    let user = await prisma.user.findUnique({ where: { id: fromUserId } });

    // Emit notification
    eventBus.emitNotification({
      userId: toUserId,
      type: "interest_received",
      metadata: {
        fromName: user?.firstName,
        fromUserId: fromUserId
      },
      priority: "HIGH"
    });

    return {
      id: interest.id,
      status: 'pending',
      createdAt: interest.createdAt,
    };
  }

  async acceptInterest(userId: string, dto: AcceptInterestDTO) {
    const { fromUserId } = dto;

    const interest = await prisma.interest.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId,
          toUserId: userId,
        },
      },
    });

    if (!interest) {
      throw new Error('Interest not found');
    }

    if (interest.status !== 'pending') {
      throw new Error(`Interest is not pending (current status: ${interest.status})`);
    }

    const updated = await prisma.interest.update({
      where: { id: interest.id },
      data: { status: 'accepted', updatedAt: new Date() },
    });

    const reverseInterest = await prisma.interest.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId: userId,
          toUserId: fromUserId,
        },
      },
    });

    const isMatch = reverseInterest?.status === 'accepted';

    logger.info('Interest accepted', {
      fromUserId,
      toUserId: userId,
      interestId: updated.id,
      isMatch,
    });

    return {
      id: updated.id,
      status: 'accepted',
      isMatch,
      updatedAt: updated.updatedAt,
    };
  }

  async declineInterest(userId: string, dto: DeclineInterestDTO) {
    const { fromUserId } = dto;

    const interest = await prisma.interest.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId,
          toUserId: userId,
        },
      },
    });

    if (!interest) {
      throw new Error('Interest not found');
    }

    if (interest.status !== 'pending') {
      throw new Error(`Interest is not pending (current status: ${interest.status})`);
    }

    const updated = await prisma.interest.update({
      where: { id: interest.id },
      data: { status: 'declined', updatedAt: new Date() },
    });

    logger.info('Interest declined', {
      fromUserId,
      toUserId: userId,
      interestId: updated.id,
    });

    return {
      id: updated.id,
      status: 'declined',
      updatedAt: updated.updatedAt,
    };
  }

  async withdrawInterest(userId: string, dto: WithdrawInterestDTO) {
    const { toUserId } = dto;

    const interest = await prisma.interest.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId: userId,
          toUserId,
        },
      },
    });

    if (!interest) {
      throw new Error('Interest not found');
    }

    if (interest.fromUserId !== userId) {
      throw new Error('Unauthorized: You can only withdraw your own sent interests');
    }

    if (interest.status === 'withdrawn') {
      return {
        id: interest.id,
        status: 'withdrawn',
        updatedAt: interest.updatedAt,
      };
    }

    const updated = await prisma.interest.update({
      where: { id: interest.id },
      data: { status: 'withdrawn', updatedAt: new Date() },
    });

    logger.info('Interest withdrawn', {
      fromUserId: userId,
      toUserId,
      interestId: updated.id,
    });

    return {
      id: updated.id,
      status: 'withdrawn',
      updatedAt: updated.updatedAt,
    };
  }

  async getSentInterests(userId: string) {
    const interests = await prisma.interest.findMany({
      where: {
        fromUserId: userId,
        status: { in: ['pending', 'accepted'] },
      },
      include: {
        toUser: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return interests.map((interest: any) => ({
      id: interest.id,
      toUserId: interest.toUserId,
      toUser: interest.toUser,
      status: interest.status,
      createdAt: interest.createdAt,
      updatedAt: interest.updatedAt,
    }));
  }

  async getReceivedInterests(userId: string) {
    const interests = await prisma.interest.findMany({
      where: {
        toUserId: userId,
        status: { in: ['pending', 'accepted'] },
      },
      include: {
        fromUser: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return interests.map((interest: any) => ({
      id: interest.id,
      fromUserId: interest.fromUserId,
      fromUser: interest.fromUser,
      status: interest.status,
      createdAt: interest.createdAt,
      updatedAt: interest.updatedAt,
    }));
  }

  async getMatches(userId: string) {
    const sentAccepted = await prisma.interest.findMany({
      where: {
        fromUserId: userId,
        status: 'accepted',
      },
      include: {
        toUser: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    const matches = [];

    for (const sent of sentAccepted) {
      const reverseMatch = await prisma.interest.findUnique({
        where: {
          fromUserId_toUserId: {
            fromUserId: sent.toUserId,
            toUserId: userId,
          },
        },
      });

      if (reverseMatch?.status === 'accepted') {
        matches.push({
          matchedUserId: sent.toUserId,
          matchedUser: sent.toUser,
          matchedAt: sent.updatedAt > reverseMatch.updatedAt ? sent.updatedAt : reverseMatch.updatedAt,
        });
      }
    }

    logger.info('Matches retrieved', { userId, matchCount: matches.length });

    return matches;
  }
}

export const connectionsService = new ConnectionsService();
