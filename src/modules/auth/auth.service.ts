import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { RegisterDTO, VerifyOTPDTO, LoginDTO } from './auth.dto.js';
import { emailService } from './email.service.js';
import { tokenService } from './token.service.js';
import { sessionService } from './session.service.js';
import { AuthResponse, SessionInfo, UserResponse } from './auth.types.js';
import { logger } from '../../utils/logger.js';
import { redis } from '../../config/redis.js';

const prisma = new PrismaClient();

const OTP_RATE_LIMIT_PREFIX = 'otp_rate_limit:';
const OTP_RATE_LIMIT_MAX = 3;
const OTP_RATE_LIMIT_WINDOW = 900;
const OTP_EXPIRY_MINUTES = 5;

export class AuthService {
  async register(dto: RegisterDTO): Promise<{ success: boolean; message: string }> {
    const { email, fullName, phoneNumber } = dto;

    await this.checkOTPRateLimit(email);

    let user = await prisma.user.findUnique({ where: { email } });

    if (user && user.isVerified) {
      throw new Error('User already exists and is verified. Please login instead.');
    }

    const otp = this.generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    if (user && !user.isVerified) {
      await prisma.user.update({
        where: { email },
        data: {
          fullName: fullName || user.fullName,
          phoneNumber: phoneNumber || user.phoneNumber,
          otpHash,
          otpExpiry,
        },
      });

      logger.info('Resending OTP to unverified user', { email });
    } else {
      await prisma.user.create({
        data: {
          email,
          fullName,
          phoneNumber,
          isVerified: false,
          otpHash,
          otpExpiry,
        },
      });

      logger.info('New user registration initiated', { email });
    }

    await emailService.sendOTP(email, otp, 'register');

    await this.incrementOTPRateLimit(email);

    return {
      success: true,
      message: 'OTP sent to your email. Please verify to complete registration.',
    };
  }

  async verify(dto: VerifyOTPDTO, sessionInfo: SessionInfo): Promise<AuthResponse> {
    const { email, otp } = dto;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.otpHash || !user.otpExpiry) {
      throw new Error('Invalid verification request. Please request a new OTP.');
    }

    if (new Date() > user.otpExpiry) {
      throw new Error('OTP has expired. Please request a new one.');
    }

    const isOTPValid = await bcrypt.compare(otp, user.otpHash);

    if (!isOTPValid) {
      logger.warn('Invalid OTP attempt', { email });
      throw new Error('Invalid OTP. Please try again.');
    }

    await prisma.user.update({
      where: { email },
      data: {
        isVerified: true,
        otpHash: null,
        otpExpiry: null,
      },
    });

    logger.info('User verified successfully', { email, userId: user.id });

    const sessionId = await sessionService.createSession(user.id, sessionInfo);

    const accessToken = tokenService.generateAccessToken(user.id, user.email, sessionId);
    const refreshToken = await tokenService.generateRefreshToken(user.id, sessionId);

    if (!user.isVerified) {
      await emailService.sendWelcomeEmail(email, user.fullName || undefined);
    }

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDTO): Promise<{ success: boolean; message: string }> {
    const { email } = dto;

    await this.checkOTPRateLimit(email);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new Error('User not found. Please register first.');
    }

    if (!user.isVerified) {
      throw new Error('User not verified. Please complete registration first.');
    }

    const otp = this.generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: { otpHash, otpExpiry },
    });

    await emailService.sendOTP(email, otp, 'login');

    await this.incrementOTPRateLimit(email);

    logger.info('Login OTP sent', { email });

    return {
      success: true,
      message: 'OTP sent to your email. Please verify to login.',
    };
  }

  async refresh(refreshToken: string, sessionInfo: SessionInfo): Promise<AuthResponse> {
    const tokenData = await tokenService.verifyRefreshToken(refreshToken);

    const isSessionValid = await sessionService.isSessionValid(tokenData.sessionId);
    if (!isSessionValid) {
      throw new Error('Session has been revoked. Please login again.');
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    await sessionService.updateSessionActivity(tokenData.sessionId);

    const newRefreshToken = await tokenService.rotateRefreshToken(
      refreshToken,
      tokenData.userId,
      tokenData.sessionId
    );

    const accessToken = tokenService.generateAccessToken(
      user.id,
      user.email,
      tokenData.sessionId
    );

    logger.info('Tokens refreshed', { userId: user.id, sessionId: tokenData.sessionId });

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  async logout(refreshToken: string, sessionId: string): Promise<void> {
    await tokenService.invalidateRefreshToken(refreshToken);
    await sessionService.revokeSession(sessionId);

    logger.info('User logged out', { sessionId });
  }

  async getMe(userId: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return this.sanitizeUser(user);
  }

  private generateOTP(): string {
    return randomInt(100000, 999999).toString();
  }

  private async checkOTPRateLimit(email: string): Promise<void> {
    const key = `${OTP_RATE_LIMIT_PREFIX}${email}`;
    const count = await redis.get(key);

    if (count && parseInt(count, 10) >= OTP_RATE_LIMIT_MAX) {
      throw new Error('Too many OTP requests. Please try again in 15 minutes.');
    }
  }

  private async incrementOTPRateLimit(email: string): Promise<void> {
    const key = `${OTP_RATE_LIMIT_PREFIX}${email}`;
    const current = await redis.get(key);

    if (current) {
      await redis.incr(key);
    } else {
      await redis.setex(key, OTP_RATE_LIMIT_WINDOW, '1');
    }
  }

  private sanitizeUser(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
