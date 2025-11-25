import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { RegisterDTO, VerifyOTPDTO, LoginDTO, SelfRegistrationDTO, ParentRegistrationDTO, CandidateVerifyDTO } from './auth.dto.js';
import { emailService } from './email.service.js';
import { tokenService } from './token.service.js';
import { sessionService } from './session.service.js';
import { AuthResponse, SessionInfo, UserResponse } from './auth.types.js';
import { logger } from '../../utils/logger.js';
import { redis } from '../../config/redis.js';

const prisma = new PrismaClient();

const OTP_RATE_LIMIT_PREFIX = 'otp_rate_limit:';
const OTP_RATE_LIMIT_MAX = 5;
const OTP_RATE_LIMIT_WINDOW = 900;
const OTP_EXPIRY_MINUTES = 5;

export class AuthService {
  async register(dto: RegisterDTO): Promise<{ success: boolean; message: string }> {
    const { email, phoneNumber, password } = dto;

    await this.checkOTPRateLimit(email);

    let user = await prisma.user.findUnique({ where: { email } });

    if (user && user.isVerified) {
      throw new Error('User already exists and is verified. Please login instead.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = this.generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    if (user && !user.isVerified) {
      await prisma.user.update({
        where: { email },
        data: {
          phoneNumber: phoneNumber || user.phoneNumber,
          passwordHash,
          otpHash,
          otpExpiry,
        },
      });

      logger.info('Resending OTP to unverified user', { email });
    } else {
      await prisma.user.create({
        data: {
          email,
          phoneNumber,
          passwordHash,
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
      await emailService.sendWelcomeEmail(email, user.firstName || undefined);
    }

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDTO): Promise<{ success: boolean; otpSent: boolean }> {
    const { email, password } = dto;

    await this.checkOTPRateLimit(email);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new Error('User not found. Please register first.');
    }

    if (!user.isVerified) {
      throw new Error('User not verified. Please complete registration first.');
    }

    if (!user.passwordHash) {
      throw new Error('Password not set for this user. Please contact support.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      logger.warn('Invalid password attempt', { email });
      throw new Error('Invalid email or password.');
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
      otpSent: true,
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
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
      refreshToken: newRefreshToken,
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

  async registerSelf(dto: SelfRegistrationDTO): Promise<{ success: boolean; message: string }> {
    const { email, firstName, lastName, gender, dob, city, state, country, phoneNumber, password, lookingFor } = dto;

    await this.checkOTPRateLimit(email);

    let user = await prisma.user.findUnique({ where: { email } });

    if (user && user.isVerified) {
      throw new Error('User already exists and is verified. Please login instead.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = this.generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    if (user && !user.isVerified) {
      await prisma.user.update({
        where: { email },
        data: {
          role: 'self',
          firstName,
          lastName,
          gender,
          dob: new Date(dob),
          city,
          state,
          country,
          lookingFor,
          phoneNumber: phoneNumber || user.phoneNumber,
          passwordHash,
          otpHash,
          otpExpiry,
          creatingFor: 'self',
        },
      });

      logger.info('Resending OTP to unverified self-registration user', { email });
    } else {
      await prisma.user.create({
        data: {
          role: 'self',
          firstName,
          lastName,
          gender,
          dob: new Date(dob),
          city,
          state,
          country,
          lookingFor,
          email,
          phoneNumber,
          passwordHash,
          isVerified: false,
          otpHash,
          otpExpiry,
          creatingFor: 'self',
        },
      });

      logger.info('New self-registration initiated', { email });
    }

    await emailService.sendOTP(email, otp, 'register');
    await this.incrementOTPRateLimit(email);

    return {
      success: true,
      message: 'OTP sent to your email. Please verify to complete registration.',
    };
  }

  async registerParent(dto: ParentRegistrationDTO): Promise<{ success: boolean; message: string }> {
    const {
      email: parentEmail,
      parentFirstName,
      parentLastName,
      password,
      candidateEmail,
      creatingFor,
      phoneNumber: parentPhone,
    } = dto;

    await this.checkOTPRateLimit(parentEmail);

    // Create parent user
    const passwordHash = await bcrypt.hash(password, 10);
    const otp = this.generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const parentUser = await prisma.user.create({
      data: {
        role: 'parent',
        firstName: parentFirstName,
        lastName: parentLastName,
        email: parentEmail,
        phoneNumber: parentPhone,
        passwordHash,
        otpHash,
        otpExpiry,
        isVerified: false,
        candidateEmail,
        creatingFor,
      },
    });

    // Create CandidateLink record
    await prisma.candidateLink.create({
      data: {
        parentUserId: parentUser.id,
        candidateEmail,
        status: 'pending',
      },
    });

    // Send OTP to parent's email
    await emailService.sendOTP(parentEmail, otp, 'register');
    await this.incrementOTPRateLimit(parentEmail);

    logger.info('New parent registration initiated', { email: parentEmail, candidateEmail });

    return {
      success: true,
      message: 'Parent email verified via OTP. Candidate will be notified.',
    };
  }

  async candidateClaim(email: string): Promise<{ success: boolean; message: string }> {
    await this.checkOTPRateLimit(email);

    const candidateLink = await prisma.candidateLink.findFirst({
      where: { candidateEmail: email },
    });

    if (!candidateLink) {
      throw new Error('No invitation found for this email address.');
    }

    if (candidateLink.status === 'claimed') {
      throw new Error('This invitation has already been claimed.');
    }

    const otp = this.generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.candidateLink.update({
      where: { id: candidateLink.id },
      data: { otpCode: otpHash, otpExpiry },
    });

    await emailService.sendOTP(email, otp, 'register');
    await this.incrementOTPRateLimit(email);

    logger.info('Candidate claim OTP sent', { email });

    return {
      success: true,
      message: 'OTP sent to your email. Please verify to claim your profile.',
    };
  }

  async candidateVerify(dto: CandidateVerifyDTO, sessionInfo: SessionInfo): Promise<AuthResponse> {
    const { email, otp, password } = dto;

    const candidateLink = await prisma.candidateLink.findFirst({
      where: { candidateEmail: email },
    });

    if (!candidateLink) {
      throw new Error('Invalid claim request. Please contact support.');
    }

    if (!candidateLink.otpCode || !candidateLink.otpExpiry) {
      throw new Error('No OTP found. Please request a new one.');
    }

    if (new Date() > candidateLink.otpExpiry) {
      throw new Error('OTP has expired. Please request a new one.');
    }

    const isOTPValid = await bcrypt.compare(otp, candidateLink.otpCode);

    if (!isOTPValid) {
      logger.warn('Invalid candidate claim OTP attempt', { email });
      throw new Error('Invalid OTP. Please try again.');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create or update candidate account
    let candidateUser = await prisma.user.findUnique({ where: { email } });

    if (!candidateUser) {
      candidateUser = await prisma.user.create({
        data: {
          role: 'candidate',
          email,
          passwordHash,
          isVerified: true,
        },
      });
    } else {
      candidateUser = await prisma.user.update({
        where: { email },
        data: {
          role: 'candidate',
          passwordHash,
          isVerified: true,
        },
      });
    }

    // Mark CandidateLink as claimed
    await prisma.candidateLink.update({
      where: { id: candidateLink.id },
      data: {
        status: 'claimed',
        otpCode: null,
        otpExpiry: null,
      },
    });

    logger.info('Candidate claim verified', { email, candidateUserId: candidateUser.id });

    const sessionId = await sessionService.createSession(candidateUser.id, sessionInfo);
    const accessToken = tokenService.generateAccessToken(candidateUser.id, candidateUser.email, sessionId);
    const refreshToken = await tokenService.generateRefreshToken(candidateUser.id, sessionId);

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(candidateUser),
    };
  }

  private sanitizeUser(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      phoneNumber: user.phoneNumber,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
