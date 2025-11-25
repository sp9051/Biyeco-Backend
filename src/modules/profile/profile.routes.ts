import { Router } from 'express';
import { profileController } from './profile.controller.js';
import { authenticateToken } from '../../middleware/authMiddleware.js';
// import { validate } from '../../middleware/validate.js';
import { validate } from 'middleware/validate.js';
import {
  CreateProfileSchema,
  StepUpdateSchema,
  aboutMeSchema,
  demographicsSchema,
  familySchema,
  lifestyleSchema,
  partnerPreferenceSchema,
} from './profile.dto.js';

const router = Router();

router.post(
  '/',
  authenticateToken,
  validate(CreateProfileSchema),
  profileController.createProfile.bind(profileController)
);

router.get('/me', authenticateToken, profileController.getMyProfile.bind(profileController));

router.get('/:id', authenticateToken, profileController.getProfileById.bind(profileController));

router.patch(
  '/:id/step',
  authenticateToken,
  validate(StepUpdateSchema),
  profileController.updateProfileStep.bind(profileController)
);

router.post('/:id/publish', authenticateToken, profileController.publishProfile.bind(profileController));

router.post(
  '/:id/unpublish',
  authenticateToken,
  profileController.unpublishProfile.bind(profileController)
);

router.delete('/:id', authenticateToken, profileController.deleteProfile.bind(profileController));

// Expanded Profile Wizard Routes
router.patch(
  '/:id/about',
  authenticateToken,
  validate(aboutMeSchema),
  profileController.updateAboutMe.bind(profileController)
);

router.patch(
  '/:id/demographics',
  authenticateToken,
  validate(demographicsSchema),
  profileController.updateDemographics.bind(profileController)
);

router.patch(
  '/:id/family',
  authenticateToken,
  validate(familySchema),
  profileController.updateFamilyDetails.bind(profileController)
);

router.patch(
  '/:id/lifestyle',
  authenticateToken,
  validate(lifestyleSchema),
  profileController.updateLifestyle.bind(profileController)
);

router.patch(
  '/:id/preferences',
  authenticateToken,
  validate(partnerPreferenceSchema),
  profileController.updatePartnerPreferences.bind(profileController)
);

export default router;
