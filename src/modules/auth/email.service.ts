import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger.js';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export class EmailService {
  async sendOTP(email: string, otp: string, type: 'register' | 'login'): Promise<void> {
    logger.info(`[EmailService] Sending OTP to ${email}`, {
      type,
      otpLength: otp.length,
    });

    if (process.env.NODE_ENV === 'development') {
      logger.debug(`[EmailService] OTP for ${email}: ${otp}`);
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Biye OTP Code</h2>
        <p>Your OTP is <strong style="font-size: 24px; color: #4CAF50;">${otp}</strong></p>
        <p>This code is valid for <strong>5 minutes</strong>.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <hr style="margin-top: 20px; border: none; border-top: 1px solid #ddd;">
        <p style="color: #888; font-size: 12px;">This is an automated email from Biye. Please do not reply.</p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"Biye" <noreply@biye.com>',
        to: email,
        subject: 'Your Biye OTP Code',
        html,
      });

      logger.info(`[EmailService] OTP email sent successfully to ${email}`);
    } catch (error) {
      logger.error(`[EmailService] Failed to send OTP email to ${email}`, { error });
      throw new Error('Failed to send OTP email');
    }
  }

  async sendWelcomeEmail(email: string, fullName?: string): Promise<void> {
    logger.info(`[EmailService] Sending welcome email to ${email}`, {
      fullName,
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Biye!</h2>
        <p>Hi ${fullName || 'there'},</p>
        <p>Thank you for registering with Biye. Your account has been successfully verified.</p>
        <p>You can now log in and start exploring our platform.</p>
        <hr style="margin-top: 20px; border: none; border-top: 1px solid #ddd;">
        <p style="color: #888; font-size: 12px;">This is an automated email from Biye. Please do not reply.</p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"Biye" <noreply@biye.com>',
        to: email,
        subject: 'Welcome to Biye!',
        html,
      });

      logger.info(`[EmailService] Welcome email sent successfully to ${email}`);
    } catch (error) {
      logger.error(`[EmailService] Failed to send welcome email to ${email}`, { error });
    }
  }
}

export const emailService = new EmailService();
