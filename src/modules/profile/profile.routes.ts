import { Router } from 'express';
import { profileController } from './profile.controller.js';
import { authenticate } from '../../middleware/authMiddleware.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import {
  CreateProfileSchema,
  StepUpdateSchema,
} from './profile.dto.js';

const router = Router();

router.post(
  '/',
  authenticate,
  validateRequest(CreateProfileSchema),
  profileController.createProfile.bind(profileController)
);

router.get('/me', authenticate, profileController.getMyProfile.bind(profileController));

router.get('/:id', authenticate, profileController.getProfileById.bind(profileController));

router.patch(
  '/:id/step',
  authenticate,
  validateRequest(StepUpdateSchema),
  profileController.updateProfileStep.bind(profileController)
);

router.post('/:id/publish', authenticate, profileController.publishProfile.bind(profileController));

router.post(
  '/:id/unpublish',
  authenticate,
  profileController.unpublishProfile.bind(profileController)
);

router.delete('/:id', authenticate, profileController.deleteProfile.bind(profileController));

export default router;
