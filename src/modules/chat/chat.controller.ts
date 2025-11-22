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

export class ChatController {
  async getThreads(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const query = getThreadsQuerySchema.parse(req.query);

      const result = await chatService.getThreads(
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

      const thread = await chatService.getThread(threadId, userId);

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

      const input = createThreadSchema.parse(req.body);

      if (!input.participantIds.includes(userId)) {
        input.participantIds.push(userId);
      }

      const thread = await chatService.createThread({
        participants: input.participantIds,
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

      const query = getMessagesQuerySchema.parse(req.query);

      const result = await chatService.getMessages(
        threadId,
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

      const input = markAsReadSchema.parse(req.body);

      await chatService.markAsRead(threadId, userId, input.uptoMessageId);

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
}

export const chatController = new ChatController();
