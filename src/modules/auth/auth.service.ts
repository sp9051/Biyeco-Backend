import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { RegisterDTO, VerifyOTPDTO, LoginDTO, SelfRegistrationDTO, ParentRegistrationDTO, CandidateStartDTO, InviteChildDTO } from './auth.dto.js';
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

    if (user.role === 'candidate' || user.role === 'guardian') {
      await prisma.candidateLink.updateMany({
        where: {
          childUserId: user.id,
          status: 'pending',
        },
        data: {
          status: 'active',
        },
      });
    }

    logger.info('User verified successfully', { email, userId: user.id, role: user.role });

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
    const { email, firstName, lastName, phoneNumber, password } = dto;

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
      parentEmail,
      parentFirstName,
      parentLastName,
      parentPhoneNumber,
      password,
      candidateEmail,
      candidateFirstName,
      candidateLastName,
      candidateGender,
      candidateDob,
      candidateCity,
      candidateState,
      candidateCountry,
      candidatePhoneNumber,
      lookingFor,
      creatingFor,
    } = dto;

    await this.checkOTPRateLimit(parentEmail);

    const existingParent = await prisma.user.findUnique({
      where: { email: parentEmail },
    });

    if (existingParent && existingParent.isVerified) {
      throw new Error('Email already exists and is verified. Please log in instead.');
    }

    const existingCandidate = await prisma.user.findUnique({
      where: { email: candidateEmail },
    });

    if (existingCandidate && existingCandidate.isVerified) {
      throw new Error('Candidate email already exists and is verified.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = this.generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const parentUser = existingParent
        ? await tx.user.update({
            where: { email: parentEmail },
            data: {
              role: 'parent',
              firstName: parentFirstName,
              lastName: parentLastName,
              phoneNumber: parentPhoneNumber,
              passwordHash,
              otpHash,
              otpExpiry,
              lookingFor,
              creatingFor,
            },
          })
        : await tx.user.create({
            data: {
              role: 'parent',
              firstName: parentFirstName,
              lastName: parentLastName,
              email: parentEmail,
              phoneNumber: parentPhoneNumber,
              passwordHash,
              otpHash,
              otpExpiry,
              isVerified: false,
              lookingFor,
              creatingFor,
            },
          });

      const candidateUser = existingCandidate
        ? await tx.user.update({
            where: { email: candidateEmail },
            data: {
              role: 'candidate',
              firstName: candidateFirstName,
              lastName: candidateLastName,
              phoneNumber: candidatePhoneNumber,
            },
          })
        : await tx.user.create({
            data: {
              role: 'candidate',
              firstName: candidateFirstName,
              lastName: candidateLastName,
              email: candidateEmail,
              phoneNumber: candidatePhoneNumber,
              isVerified: false,
            },
          });

      let profile = await tx.profile.findUnique({
        where: { userId: candidateUser.id },
      });

      if (!profile) {
        profile = await tx.profile.create({
          data: {
            userId: candidateUser.id,
            gender: candidateGender,
            dob: new Date(candidateDob),
            location: {
              city: candidateCity,
              state: candidateState,
              country: candidateCountry,
            },
          },
        });
      } else {
        profile = await tx.profile.update({
          where: { id: profile.id },
          data: {
            gender: candidateGender,
            dob: new Date(candidateDob),
            location: {
              city: candidateCity,
              state: candidateState,
              country: candidateCountry,
            },
          },
        });
      }

      const existingLink = await tx.candidateLink.findFirst({
        where: {
          profileId: profile.id,
          parentUserId: parentUser.id,
          role: 'parent',
        },
      });

      if (!existingLink) {
        await tx.candidateLink.create({
          data: {
            profileId: profile.id,
            parentUserId: parentUser.id,
            childUserId: candidateUser.id,
            relationship: creatingFor,
            role: 'parent',
            status: 'active',
          },
        });
      }

      return { parentUser, candidateUser, profile };
    });

    await emailService.sendOTP(parentEmail, otp, 'register');
    await this.incrementOTPRateLimit(parentEmail);

    await emailService.sendCandidateInvite(candidateEmail, {
      parentName: `${parentFirstName} ${parentLastName}`,
      profileId: result.profile.id,
    });

    logger.info('New parent registration with candidate initiated', { 
      parentEmail, 
      candidateEmail,
      profileId: result.profile.id 
    });

    return {
      success: true,
      message: 'OTP sent to parent email. Candidate has been invited.',
    };
  }

  async candidateStart(dto: CandidateStartDTO): Promise<{ success: boolean; message: string }> {
    const { email, password, phoneNumber } = dto;

    await this.checkOTPRateLimit(email);

    const candidateUser = await prisma.user.findUnique({ where: { email } });

    if (!candidateUser) {
      throw new Error('No invitation found for this email address.');
    }

    if (candidateUser.role !== 'candidate') {
      throw new Error('This email is not associated with a candidate account.');
    }

    if (candidateUser.isVerified) {
      throw new Error('This account is already verified. Please login instead.');
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: candidateUser.id },
    });

    if (!profile) {
      throw new Error('Profile not found for this candidate.');
    }

    let candidateLink = await prisma.candidateLink.findFirst({
      where: {
        profileId: profile.id,
        childUserId: candidateUser.id,
        role: 'candidate',
      },
    });

    if (!candidateLink) {
      const parentLink = await prisma.candidateLink.findFirst({
        where: {
          profileId: profile.id,
          role: 'parent',
        },
      });

      if (!parentLink) {
        throw new Error('Invalid invitation. Please contact support.');
      }

      candidateLink = await prisma.candidateLink.create({
        data: {
          profileId: profile.id,
          parentUserId: parentLink.parentUserId,
          childUserId: candidateUser.id,
          relationship: 'candidate',
          role: 'candidate',
          status: 'pending',
        },
      });
    } else if (candidateLink.status === 'active') {
      throw new Error('This account is already active. Please login instead.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = this.generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: candidateUser.id },
      data: {
        passwordHash,
        phoneNumber: phoneNumber || candidateUser.phoneNumber,
        otpHash,
        otpExpiry,
      },
    });

    await emailService.sendOTP(email, otp, 'register');
    await this.incrementOTPRateLimit(email);

    logger.info('Candidate start OTP sent', { email, profileId: profile.id });

    return {
      success: true,
      message: 'OTP sent to your email. Please verify to complete your registration.',
    };
  }

  async inviteChild(dto: InviteChildDTO, inviterId: string): Promise<{ success: boolean; message: string }> {
    const { profileId, email, firstName, lastName, phoneNumber, relationship } = dto;

    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new Error('Profile not found.');
    }

    const inviterLink = await prisma.candidateLink.findFirst({
      where: {
        profileId,
        OR: [
          { parentUserId: inviterId },
          { childUserId: inviterId },
        ],
        role: { in: ['parent', 'candidate'] },
        status: 'active',
      },
    });

    if (!inviterLink) {
      throw new Error('You do not have permission to invite users to this profile.');
    }

    let childUser = await prisma.user.findUnique({ where: { email } });

    if (!childUser) {
      childUser = await prisma.user.create({
        data: {
          role: 'guardian',
          firstName,
          lastName,
          email,
          phoneNumber,
          isVerified: false,
        },
      });
    }

    const existingLink = await prisma.candidateLink.findFirst({
      where: {
        profileId,
        childUserId: childUser.id,
      },
    });

    if (existingLink) {
      throw new Error('This user has already been invited to this profile.');
    }

    await prisma.candidateLink.create({
      data: {
        profileId,
        parentUserId: inviterLink.parentUserId,
        childUserId: childUser.id,
        relationship,
        role: 'guardian',
        status: 'pending',
      },
    });

    const inviter = await prisma.user.findUnique({ where: { id: inviterId } });

    await emailService.sendGuardianInvite(email, {
      inviterName: `${inviter?.firstName || ''} ${inviter?.lastName || ''}`.trim() || 'A family member',
      relationship,
    });

    logger.info('Guardian invite sent', { 
      email, 
      profileId, 
      inviterId,
      relationship 
    });

    return {
      success: true,
      message: 'Invitation sent successfully.',
    };
  }

  async guardianStart(dto: CandidateStartDTO): Promise<{ success: boolean; message: string }> {
    const { email, password, phoneNumber } = dto;

    await this.checkOTPRateLimit(email);

    const guardianUser = await prisma.user.findUnique({ where: { email } });

    if (!guardianUser) {
      throw new Error('No invitation found for this email address.');
    }

    if (guardianUser.role !== 'guardian') {
      throw new Error('This email is not associated with a guardian account.');
    }

    if (guardianUser.isVerified) {
      throw new Error('This account is already verified. Please login instead.');
    }

    const guardianLink = await prisma.candidateLink.findFirst({
      where: {
        childUserId: guardianUser.id,
        role: 'guardian',
      },
    });

    if (!guardianLink) {
      throw new Error('No invitation found for this email address.');
    }

    if (guardianLink.status === 'active') {
      throw new Error('This account is already active. Please login instead.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = this.generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: guardianUser.id },
      data: {
        passwordHash,
        phoneNumber: phoneNumber || guardianUser.phoneNumber,
        otpHash,
        otpExpiry,
      },
    });

    await emailService.sendOTP(email, otp, 'register');
    await this.incrementOTPRateLimit(email);

    logger.info('Guardian start OTP sent', { email, profileId: guardianLink.profileId });

    return {
      success: true,
      message: 'OTP sent to your email. Please verify to complete your registration.',
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
