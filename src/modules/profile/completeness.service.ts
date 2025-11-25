import { ProfileData } from './profile.types.js';
import { logger } from '../../utils/logger.js';

interface CompletenessWeights {
  displayName: number;
  headline: number;
  about: number;
  gender: number;
  dob: number;
  location: number;
  photos: number;
  preferences: number;
}

const WEIGHTS: CompletenessWeights = {
  displayName: 10,
  headline: 10,
  about: 15,
  gender: 10,
  dob: 10,
  location: 15,
  photos: 20,
  preferences: 10,
};

export class CompletenessService {
  calculateCompleteness(profile: ProfileData): number {
    let score = 0;

    if (profile.displayName && profile.displayName.length >= 2) {
      score += WEIGHTS.displayName;
    }

    if (profile.headline && profile.headline.length >= 10) {
      score += WEIGHTS.headline;
    }

    if (profile.about && profile.about.length >= 50) {
      score += WEIGHTS.about;
    }

    if (profile.gender) {
      score += WEIGHTS.gender;
    }

    if (profile.dob) {
      score += WEIGHTS.dob;
    }

    if (profile.location && this.isValidLocation(profile.location)) {
      score += WEIGHTS.location;
    }

    if (profile.photos && profile.photos.length > 0) {
      score += WEIGHTS.photos;
    }

    if (profile.preferences && this.isValidPreferences(profile.preferences)) {
      score += WEIGHTS.preferences;
    }

    logger.debug('Profile completeness calculated', {
      profileId: profile.id,
      score,
    });

    return Math.min(score, 100);
  }

  getIncompleteSections(profile: ProfileData): string[] {
    const incomplete: string[] = [];

    if (!profile.displayName || profile.displayName.length < 2) {
      incomplete.push('displayName');
    }

    if (!profile.headline || profile.headline.length < 10) {
      incomplete.push('headline');
    }

    if (!profile.about || profile.about.length < 50) {
      incomplete.push('about');
    }

    if (!profile.gender) {
      incomplete.push('gender');
    }

    if (!profile.dob) {
      incomplete.push('dob');
    }

    if (!profile.location || !this.isValidLocation(profile.location)) {
      incomplete.push('location');
    }

    if (!profile.photos || profile.photos.length === 0) {
      incomplete.push('photos');
    }

    if (!profile.preferences || !this.isValidPreferences(profile.preferences)) {
      incomplete.push('preferences');
    }

    return incomplete;
  }

  canPublish(profile: ProfileData): { canPublish: boolean; missingFields: string[] } {
    const missingFields: string[] = [];

    // if (!profile.displayName || profile.displayName.length < 2) {
    //   missingFields.push('displayName');
    // }

    // if (!profile.gender) {
    //   missingFields.push('gender');
    // }

    // if (!profile.dob) {
    //   missingFields.push('dob');
    // }

    // if (!profile.location || !this.isValidLocation(profile.location)) {
    //   missingFields.push('location');
    // }

    // if (!profile.about || profile.about.length < 50) {
    //   missingFields.push('about');
    // }

    // if (!profile.headline || profile.headline.length < 10) {
    //   missingFields.push('headline');
    // }

    if (!profile.photos || profile.photos.length === 0) {
      missingFields.push('photos (at least 1 required)');
    }

    return {
      canPublish: missingFields.length === 0,
      missingFields,
    };
  }

  private isValidLocation(location: any): boolean {
    return (
      location &&
      typeof location === 'object' &&
      location.city &&
      location.state &&
      location.country
    );
  }

  private isValidPreferences(preferences: any): boolean {
    return preferences && typeof preferences === 'object' && Object.keys(preferences).length > 0;
  }
}

export const completenessService = new CompletenessService();
