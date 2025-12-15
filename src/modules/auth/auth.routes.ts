import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { VerifyOTPSchema, LoginSchema, CandidateStartSchema, InviteChildSchema, GoogleAuthSchema, GoogleOnboardingSchema } from './auth.dto.js';
import { authenticateToken } from '../../middleware/authMiddleware.js';

const router = Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many OTP requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', otpLimiter, authController.register.bind(authController));

router.post('/verify', authLimiter, validate(VerifyOTPSchema), authController.verify.bind(authController));

router.post('/login', otpLimiter, validate(LoginSchema), authController.login.bind(authController));

router.post('/refresh', authLimiter, authController.refresh.bind(authController));

router.post('/logout', authenticateToken, authController.logout.bind(authController));

router.get('/me', authenticateToken, authController.me.bind(authController));

router.post('/candidate/start', otpLimiter, validate(CandidateStartSchema), authController.candidateStart.bind(authController));

router.post('/guardian/start', otpLimiter, validate(CandidateStartSchema), authController.guardianStart.bind(authController));

router.post('/invite-child', authenticateToken, validate(InviteChildSchema), authController.inviteChild.bind(authController));

router.post(
  '/google',
  authLimiter,
  validate(GoogleAuthSchema),
  authController.googleAuth.bind(authController)
);
router.post(
  '/google/complete',
  authenticateToken,
  authLimiter,
  validate(GoogleOnboardingSchema),
  authController.completeGoogleOnboarding.bind(authController)
);


export default router;
