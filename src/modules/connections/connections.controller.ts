import { Request, Response, NextFunction } from 'express';
import { connectionsService } from './connections.service.js';
import { SendInterestDTO, AcceptInterestDTO, DeclineInterestDTO, WithdrawInterestDTO } from './connections.dto.js';
import { idempotencyService } from './idempotency.service.js';
import { sendSuccess } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';

export class ConnectionsController {
  async sendInterest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const dto: SendInterestDTO = req.body;
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

      logger.info('Send interest request', {
        userId,
        toUserId: dto.toUserId,
        idempotencyKey,
        requestId: req.requestId,
      });

      if (idempotencyKey) {
        const idempotencyCheck = await idempotencyService.checkIdempotency(idempotencyKey);
        if (idempotencyCheck.isReplay) {
          logger.info('Returning cached response for idempotent request', { idempotencyKey });
          return res.status(200).json(idempotencyCheck.cachedResponse);
        }
      }

      const result = await connectionsService.sendInterest(userId, dto);

      const response = {
        success: true,
        data: result,
        message: 'Interest sent successfully',
      };

      if (idempotencyKey) {
        await idempotencyService.storeResponse(idempotencyKey, response);
      }

      return sendSuccess(res, result, 'Interest sent successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async acceptInterest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const dto: AcceptInterestDTO = req.body;
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

      logger.info('Accept interest request', {
        userId,
        fromUserId: dto.fromUserId,
        idempotencyKey,
        requestId: req.requestId,
      });

      if (idempotencyKey) {
        const idempotencyCheck = await idempotencyService.checkIdempotency(idempotencyKey);
        if (idempotencyCheck.isReplay) {
          logger.info('Returning cached response for idempotent request', { idempotencyKey });
          return res.status(200).json(idempotencyCheck.cachedResponse);
        }
      }

      const result = await connectionsService.acceptInterest(userId, dto);

      const response = {
        success: true,
        data: result,
        message: 'Interest accepted successfully',
      };

      if (idempotencyKey) {
        await idempotencyService.storeResponse(idempotencyKey, response);
      }

      return sendSuccess(res, result, 'Interest accepted successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async declineInterest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const dto: DeclineInterestDTO = req.body;
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

      logger.info('Decline interest request', {
        userId,
        fromUserId: dto.fromUserId,
        idempotencyKey,
        requestId: req.requestId,
      });

      if (idempotencyKey) {
        const idempotencyCheck = await idempotencyService.checkIdempotency(idempotencyKey);
        if (idempotencyCheck.isReplay) {
          logger.info('Returning cached response for idempotent request', { idempotencyKey });
          return res.status(200).json(idempotencyCheck.cachedResponse);
        }
      }

      const result = await connectionsService.declineInterest(userId, dto);

      const response = {
        success: true,
        data: result,
        message: 'Interest declined',
      };

      if (idempotencyKey) {
        await idempotencyService.storeResponse(idempotencyKey, response);
      }

      return sendSuccess(res, result, 'Interest declined', 200);
    } catch (error) {
      next(error);
    }
  }

  async withdrawInterest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const dto: WithdrawInterestDTO = req.body;
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

      logger.info('Withdraw interest request', {
        userId,
        toUserId: dto.toUserId,
        idempotencyKey,
        requestId: req.requestId,
      });

      if (idempotencyKey) {
        const idempotencyCheck = await idempotencyService.checkIdempotency(idempotencyKey);
        if (idempotencyCheck.isReplay) {
          logger.info('Returning cached response for idempotent request', { idempotencyKey });
          return res.status(200).json(idempotencyCheck.cachedResponse);
        }
      }

      const result = await connectionsService.withdrawInterest(userId, dto);

      const response = {
        success: true,
        data: result,
        message: 'Interest withdrawn',
      };

      if (idempotencyKey) {
        await idempotencyService.storeResponse(idempotencyKey, response);
      }

      return sendSuccess(res, result, 'Interest withdrawn', 200);
    } catch (error) {
      next(error);
    }
  }

  async getSentInterests(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;

      logger.info('Get sent interests request', { userId, requestId: req.requestId });

      const interests = await connectionsService.getSentInterests(userId);

      return sendSuccess(res, interests, 'Sent interests retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getReceivedInterests(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;

      logger.info('Get received interests request', { userId, requestId: req.requestId });

      const interests = await connectionsService.getReceivedInterests(userId);

      return sendSuccess(res, interests, 'Received interests retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getMatches(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;

      logger.info('Get matches request', { userId, requestId: req.requestId });

      const matches = await connectionsService.getMatches(userId);

      return sendSuccess(res, matches, 'Matches retrieved', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const connectionsController = new ConnectionsController();
