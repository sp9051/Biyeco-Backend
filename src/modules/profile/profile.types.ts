export interface ProfileData {
  id: string;
  userId: string;
  displayName?: string;
  headline?: string;
  about?: string;
  gender?: string;
  dob?: Date;
  location?: any;
  published: boolean;
  completeness: number;
  photos?: PhotoData[];
  preferences?: PreferenceData;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface PhotoData {
  id: string;
  profileId: string;
  objectKey?: string;
  url?: string;
  fileSize?: number;
  privacyLevel: string;
  moderationStatus: string;
  createdAt: Date;
}

export interface PreferenceData {
  id: string;
  profileId: string;
  basic?: any;
  lifestyle?: any;
  education?: any;
  community?: any;
  location?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaskedProfile {
  id: string;
  displayName: string;
  headline?: string;
  about?: string;
  gender?: string;
  age?: number;
  location?: any;
  completeness: number;
  photos?: PhotoData[];
  preferences?: PreferenceData;
}

export interface RequesterContext {
  userId?: string;
  isOwner?: boolean;
  isGuardian?: boolean;
  isPremium?: boolean;
}

export type ProfileStep =
  | 'about'
  | 'demographics'
  | 'family'
  | 'lifestyle'
  | 'location'
  | 'photos-metadata'
  | 'preferences';
