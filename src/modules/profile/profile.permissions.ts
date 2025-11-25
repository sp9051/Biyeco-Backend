import { ProfileData, MaskedProfile, RequesterContext, PhotoData } from './profile.types.js';
import { logger } from '../../utils/logger.js';

export class ProfilePermissions {
  maskProfile(profile: ProfileData, requester: RequesterContext): MaskedProfile {
    const isOwner = requester.userId === profile.userId;
    const isGuardian = requester.isGuardian || false;
    const isPremium = requester.isPremium || false;

    const age = profile.dob ? this.calculateAge(profile.dob) : undefined;

    const maskedProfile: MaskedProfile = {
      id: profile.id,
      displayName: profile.displayName || '',
      completeness: profile.completeness,
    };

    if (isOwner) {
      return {
        ...maskedProfile,
        headline: profile.headline,
        about: profile.about,
        gender: profile.gender,
        age,
        location: profile.location,
        photos: profile.photos,
        preferences: profile.preferences,
      };
    }

    if (!profile.published) {
      logger.warn('Attempted to view unpublished profile', {
        profileId: profile.id,
        requesterId: requester.userId,
      });
      throw new Error('Profile is not published');
    }

    if (isGuardian || isPremium) {
      maskedProfile.headline = profile.headline;
      maskedProfile.about = profile.about;
      maskedProfile.gender = profile.gender;
      maskedProfile.age = age;
      maskedProfile.location = this.maskLocation(profile.location);
      maskedProfile.photos = this.filterPhotos(profile.photos || [], 'all');
      maskedProfile.preferences = profile.preferences;
    } else {
      maskedProfile.headline = profile.headline;
      maskedProfile.about = this.maskAbout(profile.about);
      maskedProfile.gender = profile.gender;
      maskedProfile.age = age;
      maskedProfile.location = this.maskLocation(profile.location);
      maskedProfile.photos = this.filterPhotos(profile.photos || [], 'public');
    }

    return maskedProfile;
  }

  canViewProfile(profile: ProfileData, requester: RequesterContext): boolean {
    const isOwner = requester.userId === profile.userId;

    if (isOwner) {
      return true;
    }

    if (!profile.published) {
      return false;
    }

    return true;
  }

  canEditProfile(profile: ProfileData, requester: RequesterContext): boolean {
    return requester.userId === profile.userId;
  }

  canPublishProfile(profile: ProfileData, requester: RequesterContext): boolean {
    return requester.userId === profile.userId;
  }

  private calculateAge(dob: Date): number {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  private maskAbout(about?: string): string | undefined {
    if (!about) return undefined;

    if (about.length <= 150) {
      return about;
    }

    return about.substring(0, 150) + '...';
  }

  private maskLocation(location: any): any {
    if (!location || typeof location !== 'object') {
      return undefined;
    }

    return {
      city: location.city,
      state: location.state,
      country: location.country,
    };
  }

  private filterPhotos(photos: PhotoData[], level: 'public' | 'all'): PhotoData[] {
    if (level === 'all') {
      return photos;
    }

    return photos.filter((photo) => photo.privacyLevel === 'public');
  }
}

export const profilePermissions = new ProfilePermissions();
