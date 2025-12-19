import { logger } from '../../utils/logger.js';
import { sanitizeMessage } from '../../utils/sanitizer.js';
import { profanityService } from './profanity.service.js';
import {
  SaveMessageParams,
  CreateThreadParams,
  MessageResponse,
  ThreadWithPreview,
  ChatServer,
} from './chat.types.js';
import { eventBus } from '../../events/eventBus.js';

import { prisma } from '../../prisma.js';

export class ChatService {
  private io: ChatServer | null = null;

  setSocketServer(io: ChatServer): void {
    this.io = io;
  }

  async saveMessage(params: SaveMessageParams): Promise<MessageResponse> {
    const { threadId, fromUserId, toUserId, content, metadata = {} } = params;

    const sanitizedContent = sanitizeMessage(content);

    const isContentClean = profanityService.isClean(sanitizedContent);
    if (!isContentClean) {
      metadata.moderation = 'flagged';
      logger.warn(`Message from ${fromUserId} flagged for profanity`);
    }

    let thread;
    if (threadId) {
      thread = await prisma.thread.findUnique({
        where: { id: threadId },
      });

      if (!thread) {
        throw new Error('Thread not found');
      }

      if (!thread.participants.includes(fromUserId)) {
        throw new Error('User not a participant in this thread');
      }
    } else {
      thread = await this.findOrCreateThread([fromUserId, toUserId]);
    }

    const isRecipientOnline = this.io?.sockets.adapter.rooms.has(`user:${toUserId}`) || false;

    const message = await prisma.message.create({
      data: {
        threadId: thread.id,
        fromUserId,
        toUserId,
        content: sanitizedContent,
        metadata,
        delivered: isRecipientOnline,
      },
    });

    await prisma.thread.update({
      where: { id: thread.id },
      data: { lastMsgAt: new Date() },
    });

    const messageResponse: MessageResponse = {
      id: message.id,
      threadId: message.threadId,
      fromUserId: message.fromUserId,
      toUserId: message.toUserId,
      content: message.content,
      metadata: message.metadata as Record<string, any> | undefined,
      delivered: message.delivered,
      read: message.read,
      createdAt: message.createdAt,
    };

    if (this.io && toUserId) {
      this.io.to(`user:${toUserId}`).emit('message', messageResponse);

      if (isRecipientOnline) {
        this.io.to(`user:${toUserId}`).emit('delivery_receipt', {
          messageId: message.id,
          threadId: thread.id,
          delivered: true,
          deliveredAt: new Date(),
        });
      } else {
        logger.info(`Recipient ${toUserId} offline, enqueue notification`);
      }
    }

    let user = await prisma.user.findUnique({ where: { id: fromUserId } });
    // Emit notification
    console.log("🔥 EVENT EMITTED", {
      userId: toUserId,
      type: "new_message"
    });
    eventBus.emitNotification({
      userId: toUserId,
      type: "new_message",
      metadata: {
        fromName: user?.firstName,
        threadId: threadId
      },
      priority: "HIGH"
    });

    return messageResponse;
  }

  async findOrCreateThread(participants: string[]): Promise<any> {
    const sortedParticipants = [...participants].sort();

    const existingThread = await prisma.thread.findFirst({
      where: {
        AND: sortedParticipants.map((participantId) => ({
          participants: {
            has: participantId,
          },
        })),
      },
    });

    if (existingThread) {
      return existingThread;
    }

    const thread = await prisma.thread.create({
      data: {
        participants: sortedParticipants,
      },
    });

    return thread;
  }

  async createThread(params: CreateThreadParams): Promise<any> {
    const { participants } = params;

    if (participants.length < 2) {
      throw new Error('Thread must have at least 2 participants');
    }

    const canCreate = await this.canCreateThread(participants[0], participants[1]);
    if (!canCreate) {
      throw new Error('Users not allowed to chat. Mutual match required.');
    }

    const thread = await this.findOrCreateThread(participants);
    return thread;
  }

  async getThreads(
    userId: string,
    cursor?: string,
    limit: number = 20
  ): Promise<{ threads: ThreadWithPreview[]; nextCursor: string | null }> {
    const whereClause: any = {
      participants: {
        has: userId,
      },
    };

    if (cursor) {
      const [lastMsgAt, id] = cursor.split('_');
      whereClause.OR = [
        { lastMsgAt: { lt: new Date(lastMsgAt) } },
        {
          AND: [
            { lastMsgAt: new Date(lastMsgAt) },
            { id: { lt: id } },
          ],
        },
      ];
    }

    const threads = await prisma.thread.findMany({
      where: whereClause,
      orderBy: [{ lastMsgAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const hasMore = threads.length > limit;
    const items = hasMore ? threads.slice(0, -1) : threads;

    const threadsWithPreview: ThreadWithPreview[] = items.map((thread: any) => ({
      id: thread.id,
      participants: thread.participants,
      lastMsgAt: thread.lastMsgAt,
      lastMessage: thread.messages[0]
        ? {
          id: thread.messages[0].id,
          content: thread.messages[0].content,
          fromUserId: thread.messages[0].fromUserId,
          createdAt: thread.messages[0].createdAt,
        }
        : undefined,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    }));

    const nextCursor =
      hasMore && items.length > 0
        ? `${items[items.length - 1].lastMsgAt?.toISOString()}_${items[items.length - 1].id}`
        : null;

    return {
      threads: threadsWithPreview,
      nextCursor,
    };
  }

  async getThread(threadId: string, userId: string): Promise<any> {
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new Error('Thread not found');
    }

    if (!thread.participants.includes(userId)) {
      throw new Error('User not a participant in this thread');
    }

    return thread;
  }

  async getMessages(
    threadId: string,
    userId: string,
    cursor?: string,
    limit: number = 50
  ): Promise<{ messages: MessageResponse[]; nextCursor: string | null }> {
    const thread = await this.getThread(threadId, userId);

    const whereClause: any = {
      threadId: thread.id,
    };

    if (cursor) {
      const [createdAt, id] = cursor.split('_');
      whereClause.OR = [
        { createdAt: { lt: new Date(createdAt) } },
        {
          AND: [
            { createdAt: new Date(createdAt) },
            { id: { lt: id } },
          ],
        },
      ];
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, -1) : messages;

    const messageResponses: MessageResponse[] = items.map((msg: any) => ({
      id: msg.id,
      threadId: msg.threadId,
      fromUserId: msg.fromUserId,
      toUserId: msg.toUserId,
      content: msg.content,
      metadata: msg.metadata as Record<string, any> | undefined,
      delivered: msg.delivered,
      read: msg.read,
      createdAt: msg.createdAt,
    }));

    const nextCursor =
      hasMore && items.length > 0
        ? `${items[items.length - 1].createdAt.toISOString()}_${items[items.length - 1].id}`
        : null;

    return {
      messages: messageResponses,
      nextCursor,
    };
  }

  async markAsRead(
    threadId: string,
    userId: string,
    uptoMessageId?: string
  ): Promise<void> {
    const thread = await this.getThread(threadId, userId);

    const whereClause: any = {
      threadId: thread.id,
      toUserId: userId,
      read: false,
    };

    if (uptoMessageId) {
      const message = await prisma.message.findUnique({
        where: { id: uptoMessageId },
      });

      if (message) {
        whereClause.createdAt = { lte: message.createdAt };
      }
    }

    const updatedMessages = await prisma.message.updateMany({
      where: whereClause,
      data: { read: true },
    });

    if (updatedMessages.count > 0 && this.io) {
      const otherParticipants = thread.participants.filter((p: string) => p !== userId);
      otherParticipants.forEach((participantId: string) => {
        this.io?.to(`user:${participantId}`).emit('read_receipt', {
          messageId: uptoMessageId || 'multiple',
          threadId,
          userId,
          readAt: new Date(),
        });
      });
    }

    logger.info(`Marked ${updatedMessages.count} messages as read in thread ${threadId} for user ${userId}`);
  }

  async canCreateThread(userA: string, userB: string): Promise<boolean> {
    const mutualMatch = await prisma.interest.findFirst({
      where: {
        OR: [
          {
            AND: [
              { fromUserId: userA, toUserId: userB, status: 'accepted' },
            ],
          },
          {
            AND: [
              { fromUserId: userB, toUserId: userA, status: 'accepted' },
            ],
          },
        ],
      },
    });

    // if (mutualMatch) {
    //   const reverseMatch = await prisma.interest.findFirst({
    //     where: {
    //       fromUserId: mutualMatch.toUserId,
    //       toUserId: mutualMatch.fromUserId,
    //       status: 'accepted',
    //     },
    //   });

    //   return !!reverseMatch;
    // }

    return !!mutualMatch;
  }

  async canUserChat(userA: string, userB: string): Promise<boolean> {
    return this.canCreateThread(userA, userB);
  }
}

export const chatService = new ChatService();
