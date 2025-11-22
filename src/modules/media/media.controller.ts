import { Request, Response, NextFunction } from 'express';
import { mediaService } from './media.service.js';
import { CreateUploadUrlDTO } from './upload.dto.js';
import { sendSuccess } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';

export class MediaController {
  async createUploadUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const dto: CreateUploadUrlDTO = req.body;
      const userId = req.userId!;

      logger.info('Creating upload URL', {
        userId,
        profileId: dto.profileId,
        requestId: req.requestId,
      });

      const result = await mediaService.createUploadUrl(dto, userId);

      return sendSuccess(res, result, 'Upload URL created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getPhotoById(req: Request, res: Response, next: NextFunction) {
    try {
      const { photoId } = req.params;
      const userId = req.userId;

      const photo = await mediaService.getPhotoById(photoId, userId);

      if (!photo) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Photo not found or you do not have permission to view it',
            code: 'PHOTO_NOT_FOUND',
          },
        });
      }

      return sendSuccess(res, photo, 'Photo retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async deletePhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const { photoId } = req.params;
      const userId = req.userId!;

      await mediaService.deletePhoto(photoId, userId);

      return sendSuccess(res, null, 'Photo deleted successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async listProfilePhotos(req: Request, res: Response, next: NextFunction) {
    try {
      const { profileId } = req.params;
      const userId = req.userId;

      const photos = await mediaService.listProfilePhotos(profileId, userId);

      return sendSuccess(res, photos, 'Photos retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const mediaController = new MediaController();
