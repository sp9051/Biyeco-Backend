import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { RegisterSchema, VerifyOTPSchema, LoginSchema, SelfRegistrationSchema, ParentRegistrationSchema, CandidateClaimSchema, CandidateVerifySchema } from './auth.dto.js';
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

// Register endpoint accepts both self and parent registration
// Validation is flexible to handle both schemas
router.post('/register', otpLimiter, authController.register.bind(authController));

router.post('/verify', authLimiter, validate(VerifyOTPSchema), authController.verify.bind(authController));

router.post('/login', otpLimiter, validate(LoginSchema), authController.login.bind(authController));

router.post('/refresh', authLimiter, authController.refresh.bind(authController));

router.post('/logout', authenticateToken, authController.logout.bind(authController));

router.get('/me', authenticateToken, authController.me.bind(authController));

// Candidate endpoints
router.post('/candidate/claim', otpLimiter, validate(CandidateClaimSchema), authController.candidateClaim.bind(authController));

router.post('/candidate/verify', authLimiter, validate(CandidateVerifySchema), authController.candidateVerify.bind(authController));

export default router;
