import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const SelfRegistrationSchema = z.object({
  // lookingFor: z.enum(['bride', 'groom']),
  // creatingFor: z.literal('self'),
  lookingFor: z.string(),
  creatingFor: z.string(),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  gender: z.string(),
  dob: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  email: z.string().email(),
  phoneNumber: z.string().optional(),
  password: z.string().min(8),
});

export const ParentRegistrationSchema = z.object({
  // lookingFor: z.enum(['bride', 'groom']),
  // creatingFor: z.enum(['brother', 'sister', 'son', 'daughter', 'nephew', 'niece']),
  lookingFor: z.string(),
  creatingFor: z.string(),
  // Candidate details
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  gender: z.string(),
  dob: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  // Parent details
  parentFirstName: z.string().min(2),
  parentLastName: z.string().min(2),
  email: z.string().email(),
  phoneNumber: z.string().optional(),
  password: z.string().min(8),
  candidateEmail: z.string().email(),
  candidatePhone: z.string().optional(),
});

export const VerifyOTPSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

export const CandidateClaimSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const CandidateVerifySchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
  password: z.string().min(8),
});

export type RegisterDTO = z.infer<typeof RegisterSchema>;
export type SelfRegistrationDTO = z.infer<typeof SelfRegistrationSchema>;
export type ParentRegistrationDTO = z.infer<typeof ParentRegistrationSchema>;
export type VerifyOTPDTO = z.infer<typeof VerifyOTPSchema>;
export type LoginDTO = z.infer<typeof LoginSchema>;
export type RefreshTokenDTO = z.infer<typeof RefreshTokenSchema>;
export type CandidateClaimDTO = z.infer<typeof CandidateClaimSchema>;
export type CandidateVerifyDTO = z.infer<typeof CandidateVerifySchema>;
