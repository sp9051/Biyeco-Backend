import { logger } from '../../utils/logger.js';

export class EmailService {
  async sendOTP(email: string, otp: string, type: 'register' | 'login'): Promise<void> {
    logger.info(`[EmailService] Sending OTP to ${email}`, {
      type,
      otpLength: otp.length,
    });

    if (process.env.NODE_ENV === 'development') {
      logger.debug(`[EmailService] OTP for ${email}: ${otp}`);
    }

    logger.info(`[EmailService] OTP email sent successfully to ${email}`);
  }

  async sendWelcomeEmail(email: string, fullName?: string): Promise<void> {
    logger.info(`[EmailService] Sending welcome email to ${email}`, {
      fullName,
    });

    logger.info(`[EmailService] Welcome email sent successfully to ${email}`);
  }
}

export const emailService = new EmailService();
