import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { RegisterSchema, VerifyOTPSchema, LoginSchema } from './auth.dto.js';
import { authenticateToken } from '../../middleware/authMiddleware.js';

const router = Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
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

router.post('/register', otpLimiter, validate(RegisterSchema), authController.register.bind(authController));

router.post('/verify', authLimiter, validate(VerifyOTPSchema), authController.verify.bind(authController));

router.post('/login', otpLimiter, validate(LoginSchema), authController.login.bind(authController));

router.post('/refresh', authLimiter, authController.refresh.bind(authController));

router.post('/logout', authenticateToken, authController.logout.bind(authController));

router.get('/me', authenticateToken, authController.me.bind(authController));

export default router;
