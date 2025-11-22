import { Request, Response, NextFunction } from 'express';
import { profileService } from './profile.service.js';
import { profilePermissions } from './profile.permissions.js';
import { CreateProfileDTO, StepUpdateDTO } from './profile.dto.js';
import { RequesterContext } from './profile.types.js';
import { sendSuccess } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';

export class ProfileController {
  async createProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const dto: CreateProfileDTO = req.body;

      const profile = await profileService.createProfile(userId, dto);

      return sendSuccess(res, profile, 'Profile created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getMyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;

      const profile = await profileService.getMyProfile(userId);

      if (!profile) {
        return sendSuccess(res, null, 'No profile found', 404);
      }

      return sendSuccess(res, profile, 'Profile retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getProfileById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;

      const requester: RequesterContext = {
        userId,
        isOwner: false,
        isGuardian: false,
        isPremium: false,
      };

      const profile = await profileService.getProfileById(id, requester);

      const maskedProfile = profilePermissions.maskProfile(profile, requester);

      return sendSuccess(res, maskedProfile, 'Profile retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async updateProfileStep(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;
      const stepData: StepUpdateDTO = req.body;

      const profile = await profileService.updateProfileStep(id, userId, stepData);

      return sendSuccess(res, profile, 'Profile step updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async publishProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;

      const profile = await profileService.publishProfile(id, userId);

      return sendSuccess(res, profile, 'Profile published successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async unpublishProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;

      const profile = await profileService.unpublishProfile(id, userId);

      return sendSuccess(res, profile, 'Profile unpublished successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async deleteProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;

      await profileService.softDeleteProfile(id, userId);

      return sendSuccess(res, null, 'Profile deleted successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const profileController = new ProfileController();
