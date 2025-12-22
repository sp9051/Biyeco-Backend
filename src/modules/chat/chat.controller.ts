import { Request, Response } from 'express';
import { logger } from '../../utils/logger.js';
import { chatService } from './chat.service.js';
import {
  createThreadSchema,
  getThreadsQuerySchema,
  getMessagesQuerySchema,
  markAsReadSchema,
} from './chat.dto.js';
import { sendSuccess, sendError } from '../../utils/response.js';

import { prisma } from '../../prisma.js';

export class ChatController {
  async getThreads(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const effectiveUserId = await this.resolveCandidateUserId(userId);
      const query = getThreadsQuerySchema.parse(req.query);

      logger.info('Get threads request', {
        userId,
        effectiveUserId,
        requestId: req.requestId,
      });

      const result = await chatService.getThreads(
        // effectiveUserId,
        userId,
        query.cursor,
        query.limit
      );

      sendSuccess(res, result, 'Threads retrieved successfully');
    } catch (error: any) {
      logger.error('Error fetching threads:', error);
      sendError(res, error.message || 'Failed to fetch threads', 500);
    }
  }

  async getThread(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const { threadId } = req.params;

      if (!userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const effectiveUserId = await this.resolveCandidateUserId(userId);

      logger.info('Get thread request', {
        userId,
        effectiveUserId,
        threadId,
        requestId: req.requestId,
      });

      const thread = await chatService.getThread(threadId, userId);
      console.log(thread)

      sendSuccess(res, thread, 'Thread retrieved successfully');
    } catch (error: any) {
      logger.error('Error fetching thread:', error);
      if (error.message.includes('not found')) {
        sendError(res, error.message, 404);
      } else if (error.message.includes('not a participant')) {
        sendError(res, error.message, 403);
      } else {
        sendError(res, error.message || 'Failed to fetch thread', 500);
      }
    }
  }

  async createThread(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const effectiveUserId = await this.resolveCandidateUserId(userId);
      const input = createThreadSchema.parse(req.body);
      console.log(input)
      console.log(input.participantIds)


      if (!input.participantIds.includes(userId)) {
        input.participantIds.push(userId);
      }
      console.log(input.participantIds)

      logger.info('Create thread request', {
        userId,
        effectiveUserId,
        participantIds: input.participantIds,
        requestId: req.requestId,
      });

      const thread = await chatService.createThread({
        participants: input.participantIds,
        effectiveUserId: effectiveUserId,
      });

      sendSuccess(res, thread, 'Thread created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating thread:', error);
      if (error.message.includes('not allowed') || error.message.includes('Mutual match')) {
        sendError(res, error.message, 403);
      } else if (error.message.includes('validation')) {
        sendError(res, error.message, 400);
      } else {
        sendError(res, error.message || 'Failed to create thread', 500);
      }
    }
  }

  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const { threadId } = req.params;

      if (!userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const effectiveUserId = await this.resolveCandidateUserId(userId);
      const query = getMessagesQuerySchema.parse(req.query);

      logger.info('Get messages request', {
        userId,
        effectiveUserId,
        threadId,
        requestId: req.requestId,
      });

      const result = await chatService.getMessages(
        threadId,
        // effectiveUserId,
        userId,
        query.cursor,
        query.limit
      );

      sendSuccess(res, result, 'Messages retrieved successfully');
    } catch (error: any) {
      logger.error('Error fetching messages:', error);
      if (error.message.includes('not found')) {
        sendError(res, error.message, 404);
      } else if (error.message.includes('not a participant')) {
        sendError(res, error.message, 403);
      } else {
        sendError(res, error.message || 'Failed to fetch messages', 500);
      }
    }
  }

  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const { threadId } = req.params;

      if (!userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const effectiveUserId = await this.resolveCandidateUserId(userId);
      const input = markAsReadSchema.parse(req.body);

      logger.info('Mark as read request', {
        userId,
        effectiveUserId,
        threadId,
        uptoMessageId: input.uptoMessageId,
        requestId: req.requestId,
      });

      await chatService.markAsRead(threadId, userId,
        // effectiveUserId,
        input.uptoMessageId
      );

      sendSuccess(res, { success: true }, 'Messages marked as read');
    } catch (error: any) {
      logger.error('Error marking messages as read:', error);
      if (error.message.includes('not found')) {
        sendError(res, error.message, 404);
      } else if (error.message.includes('not a participant')) {
        sendError(res, error.message, 403);
      } else {
        sendError(res, error.message || 'Failed to mark messages as read', 500);
      }
    }
  }

  /**
   * Same role logic as elsewhere:
   * - self/candidate → act as themselves
   * - parent        → act as the linked candidate (via CandidateLink.profile.userId)
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
        include: {
          profile: true,
        },
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

    // Other roles (guardian/etc) can be extended later
    return userId;
  }
}

export const chatController = new ChatController();
