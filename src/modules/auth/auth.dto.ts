import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(1, 'Full name is required').optional(),
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .optional(),
});

export const VerifyOTPSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

export type RegisterDTO = z.infer<typeof RegisterSchema>;
export type VerifyOTPDTO = z.infer<typeof VerifyOTPSchema>;
export type LoginDTO = z.infer<typeof LoginSchema>;
export type RefreshTokenDTO = z.infer<typeof RefreshTokenSchema>;
