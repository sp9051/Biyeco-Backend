import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { RegisterDTO, VerifyOTPDTO, LoginDTO } from './auth.dto.js';
import { SessionInfo } from './auth.types.js';
import { successResponse } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const dto: RegisterDTO = req.body;

      const result = await authService.register(dto);

      return successResponse(res, result, result.message, 201);
    } catch (error) {
      next(error);
    }
  }

  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const dto: VerifyOTPDTO = req.body;

      const sessionInfo: SessionInfo = {
        deviceId: req.headers['x-device-id'] as string,
        ip: (req.headers['x-forwarded-for'] as string) || req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await authService.verify(dto, sessionInfo);

      res.cookie('refreshToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return successResponse(res, result, 'Verification successful', 200);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const dto: LoginDTO = req.body;

      const result = await authService.login(dto);

      return successResponse(res, result, result.message, 200);
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        throw new Error('Refresh token not found');
      }

      const sessionInfo: SessionInfo = {
        deviceId: req.headers['x-device-id'] as string,
        ip: (req.headers['x-forwarded-for'] as string) || req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await authService.refresh(refreshToken, sessionInfo);

      res.cookie('refreshToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return successResponse(res, result, 'Token refreshed successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies.refreshToken;
      const sessionId = (req as any).sessionId;

      if (!refreshToken || !sessionId) {
        throw new Error('Invalid logout request');
      }

      await authService.logout(refreshToken, sessionId);

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });

      return successResponse(res, null, 'Logged out successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;

      if (!userId) {
        throw new Error('Unauthorized');
      }

      const user = await authService.getMe(userId);

      return successResponse(res, user, 'User retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
