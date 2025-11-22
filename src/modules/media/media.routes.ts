import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { mediaController } from './media.controller.js';
import { validate } from '../../middleware/validate.js';
import { CreateUploadUrlSchema } from './upload.dto.js';
import { authenticateToken, optionalAuthMiddleware } from '../../middleware/authMiddleware.js';

const router = Router();

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many upload requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/upload-url',
  authenticateToken,
  uploadLimiter,
  validate(CreateUploadUrlSchema),
  mediaController.createUploadUrl.bind(mediaController)
);

router.get(
  '/:photoId',
  optionalAuthMiddleware,
  mediaController.getPhotoById.bind(mediaController)
);

router.delete(
  '/:photoId',
  authenticateToken,
  mediaController.deletePhoto.bind(mediaController)
);

export default router;
