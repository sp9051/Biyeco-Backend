import { PrismaClient } from '@prisma/client';
import { ProfileData, RequesterContext } from './profile.types.js';
import {
  CreateProfileDTO,
  StepUpdateDTO,
  UpdatePhotosMetadataStepDTO,
  UpdatePreferencesStepDTO,
  AboutMeDTO,
  DemographicsDTO,
  FamilyDTO,
  LifestyleDTO,
  PartnerPreferenceDTO,
} from './profile.dto.js';
import { completenessService } from './completeness.service.js';
import { profilePermissions } from './profile.permissions.js';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

export class ProfileService {
  async createProfile(userId: string, dto: CreateProfileDTO): Promise<ProfileData> {
    const existingProfile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        photos: true,
        preferences: true,
      },
    });

    if (existingProfile && !existingProfile.deletedAt) {
      throw new Error('Profile already exists for this user');
    }

    const profile = await prisma.profile.create({
      data: {
        userId,
        displayName: dto.displayName,
        headline: dto.headline,
        about: dto.about,
        published: false,
        completeness: 0,
      },
      include: {
        photos: true,
        preferences: true,
      },
    });

    const completeness = completenessService.calculateCompleteness(profile as ProfileData);

    const updatedProfile = await prisma.profile.update({
      where: { id: profile.id },
      data: { completeness },
      include: {
        photos: true,
        preferences: true,
      },
    });

    logger.info('Profile created', { userId, profileId: updatedProfile.id });

    return updatedProfile as ProfileData;
  }

  async getMyProfile(userId: string): Promise<ProfileData | null> {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        photos: true,
        preferences: true,
      },
    });

    if (!profile || profile.deletedAt) {
      return null;
    }

    return profile as ProfileData;
  }

  async getProfileById(profileId: string, requester: RequesterContext): Promise<ProfileData> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        photos: true,
        preferences: true,
      },
    });

    if (!profile || profile.deletedAt) {
      throw new Error('Profile not found');
    }

    const canView = profilePermissions.canViewProfile(profile as ProfileData, requester);

    if (!canView) {
      throw new Error('You do not have permission to view this profile');
    }

    return profile as ProfileData;
  }

  async updateProfileStep(
    profileId: string,
    userId: string,
    stepData: StepUpdateDTO
  ): Promise<ProfileData> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        photos: true,
        preferences: true,
      },
    });

    if (!profile || profile.deletedAt) {
      throw new Error('Profile not found');
    }

    if (profile.userId !== userId) {
      throw new Error('You do not have permission to update this profile');
    }

    let updatedProfile: any;

    switch (stepData.step) {
      case 'about':
        updatedProfile = await prisma.profile.update({
          where: { id: profileId },
          data: {
            about: stepData.data.about,
            headline: stepData.data.headline || profile.headline,
          },
          include: {
            photos: true,
            preferences: true,
          },
        });
        break;

      case 'demographics':
        updatedProfile = await prisma.profile.update({
          where: { id: profileId },
          data: {
            gender: stepData.data.gender,
            dob: new Date(stepData.data.dob),
          },
          include: {
            photos: true,
            preferences: true,
          },
        });
        break;

      case 'family':
        updatedProfile = await prisma.profile.update({
          where: { id: profileId },
          data: {
            location: {
              ...(profile.location as any),
              family: stepData.data.familyDetails,
            },
          },
          include: {
            photos: true,
            preferences: true,
          },
        });
        break;

      case 'lifestyle':
        updatedProfile = await prisma.profile.update({
          where: { id: profileId },
          data: {
            location: {
              ...(profile.location as any),
              lifestyle: stepData.data.lifestyle,
            },
          },
          include: {
            photos: true,
            preferences: true,
          },
        });
        break;

      case 'location':
        updatedProfile = await prisma.profile.update({
          where: { id: profileId },
          data: {
            location: stepData.data.location,
          },
          include: {
            photos: true,
            preferences: true,
          },
        });
        break;

      case 'photos-metadata':
        await prisma.photo.deleteMany({
          where: { profileId },
        });

        await prisma.photo.createMany({
          data: stepData.data.photos.map((photo) => ({
            profileId,
            objectKey: photo.objectKey,
            url: photo.url,
            fileSize: photo.fileSize,
            privacyLevel: photo.privacyLevel,
          })),
        });

        updatedProfile = await prisma.profile.findUnique({
          where: { id: profileId },
          include: {
            photos: true,
            preferences: true,
          },
        });
        break;

      case 'preferences':
        const existingPreferences = await prisma.preference.findUnique({
          where: { profileId },
        });

        if (existingPreferences) {
          await prisma.preference.update({
            where: { profileId },
            data: {
              basic: stepData.data.preferences.basic || existingPreferences.basic,
              lifestyle: stepData.data.preferences.lifestyle || existingPreferences.lifestyle,
              education: stepData.data.preferences.education || existingPreferences.education,
              community: stepData.data.preferences.community || existingPreferences.community,
              location: stepData.data.preferences.location || existingPreferences.location,
            },
          });
        } else {
          await prisma.preference.create({
            data: {
              profileId,
              basic: stepData.data.preferences.basic,
              lifestyle: stepData.data.preferences.lifestyle,
              education: stepData.data.preferences.education,
              community: stepData.data.preferences.community,
              location: stepData.data.preferences.location,
            },
          });
        }

        updatedProfile = await prisma.profile.findUnique({
          where: { id: profileId },
          include: {
            photos: true,
            preferences: true,
          },
        });
        break;

      default:
        throw new Error('Invalid step');
    }

    const completeness = completenessService.calculateCompleteness(updatedProfile as ProfileData);

    const finalProfile = await prisma.profile.update({
      where: { id: profileId },
      data: { completeness },
      include: {
        photos: true,
        preferences: true,
      },
    });

    logger.info('Profile step updated', {
      profileId,
      step: stepData.step,
      completeness,
    });

    return finalProfile as ProfileData;
  }

  async publishProfile(profileId: string, userId: string): Promise<ProfileData> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        photos: true,
        preferences: true,
      },
    });

    if (!profile || profile.deletedAt) {
      throw new Error('Profile not found');
    }

    if (profile.userId !== userId) {
      throw new Error('You do not have permission to publish this profile');
    }

    const { canPublish, missingFields } = completenessService.canPublish(profile as ProfileData);

    if (!canPublish) {
      throw new Error(
        `Profile cannot be published. Missing required fields: ${missingFields.join(', ')}`
      );
    }

    const updatedProfile = await prisma.profile.update({
      where: { id: profileId },
      data: { published: true },
      include: {
        photos: true,
        preferences: true,
      },
    });

    logger.info('Profile published', { profileId, userId });

    return updatedProfile as ProfileData;
  }

  async unpublishProfile(profileId: string, userId: string): Promise<ProfileData> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile || profile.deletedAt) {
      throw new Error('Profile not found');
    }

    if (profile.userId !== userId) {
      throw new Error('You do not have permission to unpublish this profile');
    }

    const updatedProfile = await prisma.profile.update({
      where: { id: profileId },
      data: { published: false },
      include: {
        photos: true,
        preferences: true,
      },
    });

    logger.info('Profile unpublished', { profileId, userId });

    return updatedProfile as ProfileData;
  }

  async softDeleteProfile(profileId: string, userId: string): Promise<void> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new Error('Profile not found');
    }

    if (profile.userId !== userId) {
      throw new Error('You do not have permission to delete this profile');
    }

    await prisma.profile.update({
      where: { id: profileId },
      data: {
        deletedAt: new Date(),
        published: false,
      },
    });

    logger.info('Profile soft deleted', { profileId, userId });
  }

  async updateAboutMe(profileId: string, userId: string, dto: AboutMeDTO): Promise<ProfileData> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        photos: true,
        preferences: true,
      },
    });

    if (!profile || profile.deletedAt) {
      throw new Error('Profile not found');
    }

    if (profile.userId !== userId) {
      throw new Error('You do not have permission to update this profile');
    }

    const updateData: any = {};
    if (dto.headline !== undefined) updateData.headline = dto.headline;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.languagesKnown !== undefined) updateData.languagesKnown = dto.languagesKnown;

    const updatedProfile = await prisma.profile.update({
      where: { id: profileId },
      data: updateData,
      include: {
        photos: true,
        preferences: true,
      },
    });

    const completeness = completenessService.calculateCompleteness(updatedProfile as ProfileData);
    
    const finalProfile = await prisma.profile.update({
      where: { id: profileId },
      data: { completeness },
      include: {
        photos: true,
        preferences: true,
      },
    });

    logger.info('Profile about me updated', { profileId, userId });

    return finalProfile as ProfileData;
  }

  async updateDemographics(profileId: string, userId: string, dto: DemographicsDTO): Promise<ProfileData> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        photos: true,
        preferences: true,
      },
    });

    if (!profile || profile.deletedAt) {
      throw new Error('Profile not found');
    }

    if (profile.userId !== userId) {
      throw new Error('You do not have permission to update this profile');
    }

    const updateData: any = {};
    if (dto.height !== undefined) updateData.height = dto.height;
    if (dto.weight !== undefined) updateData.weight = dto.weight;
    if (dto.highestEducation !== undefined) updateData.highestEducation = dto.highestEducation;
    if (dto.fieldOfStudy !== undefined) updateData.fieldOfStudy = dto.fieldOfStudy;
    if (dto.profession !== undefined) updateData.profession = dto.profession;
    if (dto.religion !== undefined) updateData.religion = dto.religion;
    if (dto.ancestralHome !== undefined) updateData.ancestralHome = dto.ancestralHome;
    if (dto.division !== undefined) updateData.division = dto.division;

    const updatedProfile = await prisma.profile.update({
      where: { id: profileId },
      data: updateData,
      include: {
        photos: true,
        preferences: true,
      },
    });

    const completeness = completenessService.calculateCompleteness(updatedProfile as ProfileData);
    
    const finalProfile = await prisma.profile.update({
      where: { id: profileId },
      data: { completeness },
      include: {
        photos: true,
        preferences: true,
      },
    });

    logger.info('Profile demographics updated', { profileId, userId });

    return finalProfile as ProfileData;
  }

  async updateFamilyDetails(profileId: string, userId: string, dto: FamilyDTO): Promise<ProfileData> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        photos: true,
        preferences: true,
      },
    });

    if (!profile || profile.deletedAt) {
      throw new Error('Profile not found');
    }

    if (profile.userId !== userId) {
      throw new Error('You do not have permission to update this profile');
    }

    const updateData: any = {};
    if (dto.maritalStatus !== undefined) updateData.maritalStatus = dto.maritalStatus;
    if (dto.fatherOccupation !== undefined) updateData.fatherOccupation = dto.fatherOccupation;
    if (dto.motherOccupation !== undefined) updateData.motherOccupation = dto.motherOccupation;
    if (dto.siblingsCount !== undefined) updateData.siblingsCount = dto.siblingsCount;
    if (dto.childrenCount !== undefined) updateData.childrenCount = dto.childrenCount;
    if (dto.childrenStatus !== undefined) updateData.childrenStatus = dto.childrenStatus;

    const updatedProfile = await prisma.profile.update({
      where: { id: profileId },
      data: updateData,
      include: {
        photos: true,
        preferences: true,
      },
    });

    const completeness = completenessService.calculateCompleteness(updatedProfile as ProfileData);
    
    const finalProfile = await prisma.profile.update({
      where: { id: profileId },
      data: { completeness },
      include: {
        photos: true,
        preferences: true,
      },
    });

    logger.info('Profile family details updated', { profileId, userId });

    return finalProfile as ProfileData;
  }

  async updateLifestyle(profileId: string, userId: string, dto: LifestyleDTO): Promise<ProfileData> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        photos: true,
        preferences: true,
      },
    });

    if (!profile || profile.deletedAt) {
      throw new Error('Profile not found');
    }

    if (profile.userId !== userId) {
      throw new Error('You do not have permission to update this profile');
    }

    const updateData: any = {};
    if (dto.hobbies !== undefined) updateData.hobbies = dto.hobbies;
    if (dto.dietPreference !== undefined) updateData.dietPreference = dto.dietPreference;
    if (dto.smokingHabit !== undefined) updateData.smokingHabit = dto.smokingHabit;
    if (dto.drinkingHabit !== undefined) updateData.drinkingHabit = dto.drinkingHabit;
    if (dto.exerciseRoutine !== undefined) updateData.exerciseRoutine = dto.exerciseRoutine;
    if (dto.petPreference !== undefined) updateData.petPreference = dto.petPreference;
    if (dto.livingSituation !== undefined) updateData.livingSituation = dto.livingSituation;

    const updatedProfile = await prisma.profile.update({
      where: { id: profileId },
      data: updateData,
      include: {
        photos: true,
        preferences: true,
      },
    });

    const completeness = completenessService.calculateCompleteness(updatedProfile as ProfileData);
    
    const finalProfile = await prisma.profile.update({
      where: { id: profileId },
      data: { completeness },
      include: {
        photos: true,
        preferences: true,
      },
    });

    logger.info('Profile lifestyle updated', { profileId, userId });

    return finalProfile as ProfileData;
  }

  async updatePartnerPreferences(profileId: string, userId: string, dto: PartnerPreferenceDTO): Promise<ProfileData> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        photos: true,
        preferences: true,
      },
    });

    if (!profile || profile.deletedAt) {
      throw new Error('Profile not found');
    }

    if (profile.userId !== userId) {
      throw new Error('You do not have permission to update this profile');
    }

    const updateData: any = {};
    if (dto.prefAgeRangeFrom !== undefined) updateData.prefAgeRangeFrom = dto.prefAgeRangeFrom;
    if (dto.prefAgeRangeTo !== undefined) updateData.prefAgeRangeTo = dto.prefAgeRangeTo;
    if (dto.prefHeightFrom !== undefined) updateData.prefHeightFrom = dto.prefHeightFrom;
    if (dto.prefHeightTo !== undefined) updateData.prefHeightTo = dto.prefHeightTo;
    if (dto.prefLocation !== undefined) updateData.prefLocation = dto.prefLocation;
    if (dto.prefEducation !== undefined) updateData.prefEducation = dto.prefEducation;
    if (dto.prefProfession !== undefined) updateData.prefProfession = dto.prefProfession;
    if (dto.prefReligion !== undefined) updateData.prefReligion = dto.prefReligion;
    if (dto.prefMaritalStatus !== undefined) updateData.prefMaritalStatus = dto.prefMaritalStatus;
    if (dto.prefChildrenCount !== undefined) updateData.prefChildrenCount = dto.prefChildrenCount;
    if (dto.prefChildrenStatus !== undefined) updateData.prefChildrenStatus = dto.prefChildrenStatus;
    if (dto.prefDietPreference !== undefined) updateData.prefDietPreference = dto.prefDietPreference;
    if (dto.prefSmokingHabit !== undefined) updateData.prefSmokingHabit = dto.prefSmokingHabit;
    if (dto.prefDrinkingHabit !== undefined) updateData.prefDrinkingHabit = dto.prefDrinkingHabit;

    const updatedProfile = await prisma.profile.update({
      where: { id: profileId },
      data: updateData,
      include: {
        photos: true,
        preferences: true,
      },
    });

    const completeness = completenessService.calculateCompleteness(updatedProfile as ProfileData);
    
    const finalProfile = await prisma.profile.update({
      where: { id: profileId },
      data: { completeness },
      include: {
        photos: true,
        preferences: true,
      },
    });

    logger.info('Profile partner preferences updated', { profileId, userId });

    return finalProfile as ProfileData;
  }
}

export const profileService = new ProfileService();
