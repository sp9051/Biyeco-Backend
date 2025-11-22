import { z } from 'zod';

export const CreateProfileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  headline: z.string().optional(),
  about: z.string().optional(),
});

export const UpdateAboutStepSchema = z.object({
  about: z.string().min(50, 'About section must be at least 50 characters'),
  headline: z.string().min(10, 'Headline must be at least 10 characters').optional(),
});

export const UpdateDemographicsStepSchema = z.object({
  gender: z.enum(['male', 'female', 'other']),
  dob: z.string().refine((date) => {
    const birthDate = new Date(date);
    const age = new Date().getFullYear() - birthDate.getFullYear();
    return age >= 18 && age <= 100;
  }, 'Age must be between 18 and 100'),
});

export const UpdateFamilyStepSchema = z.object({
  familyDetails: z.object({
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
    siblings: z.number().int().min(0).optional(),
    familyType: z.enum(['nuclear', 'joint']).optional(),
    familyValues: z.enum(['traditional', 'moderate', 'liberal']).optional(),
  }),
});

export const UpdateLifestyleStepSchema = z.object({
  lifestyle: z.object({
    diet: z.enum(['vegetarian', 'non-vegetarian', 'vegan', 'other']).optional(),
    drinking: z.enum(['never', 'occasionally', 'socially', 'regularly']).optional(),
    smoking: z.enum(['never', 'occasionally', 'regularly']).optional(),
    maritalStatus: z.enum(['never_married', 'divorced', 'widowed', 'separated']).optional(),
  }),
});

export const UpdateLocationStepSchema = z.object({
  location: z.object({
    city: z.string().min(2),
    state: z.string().min(2),
    country: z.string().min(2),
    coordinates: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
  }),
});

export const UpdatePhotosMetadataStepSchema = z.object({
  photos: z.array(
    z.object({
      objectKey: z.string(),
      url: z.string().url(),
      fileSize: z.number().int().positive(),
      privacyLevel: z.enum(['public', 'private', 'on_request']).default('public'),
    })
  ),
});

export const UpdatePreferencesStepSchema = z.object({
  preferences: z.object({
    basic: z
      .object({
        ageRange: z.object({
          min: z.number().int().min(18),
          max: z.number().int().max(100),
        }),
        heightRange: z
          .object({
            min: z.number(),
            max: z.number(),
          })
          .optional(),
        maritalStatus: z.array(z.string()).optional(),
      })
      .optional(),
    lifestyle: z
      .object({
        diet: z.array(z.string()).optional(),
        drinking: z.array(z.string()).optional(),
        smoking: z.array(z.string()).optional(),
      })
      .optional(),
    education: z
      .object({
        minEducation: z.string().optional(),
        fieldOfStudy: z.array(z.string()).optional(),
      })
      .optional(),
    community: z
      .object({
        religion: z.array(z.string()).optional(),
        caste: z.array(z.string()).optional(),
        motherTongue: z.array(z.string()).optional(),
      })
      .optional(),
    location: z
      .object({
        cities: z.array(z.string()).optional(),
        countries: z.array(z.string()).optional(),
        willingToRelocate: z.boolean().optional(),
      })
      .optional(),
  }),
});

export const StepUpdateSchema = z.discriminatedUnion('step', [
  z.object({ step: z.literal('about'), data: UpdateAboutStepSchema }),
  z.object({ step: z.literal('demographics'), data: UpdateDemographicsStepSchema }),
  z.object({ step: z.literal('family'), data: UpdateFamilyStepSchema }),
  z.object({ step: z.literal('lifestyle'), data: UpdateLifestyleStepSchema }),
  z.object({ step: z.literal('location'), data: UpdateLocationStepSchema }),
  z.object({ step: z.literal('photos-metadata'), data: UpdatePhotosMetadataStepSchema }),
  z.object({ step: z.literal('preferences'), data: UpdatePreferencesStepSchema }),
]);

export type CreateProfileDTO = z.infer<typeof CreateProfileSchema>;
export type UpdateAboutStepDTO = z.infer<typeof UpdateAboutStepSchema>;
export type UpdateDemographicsStepDTO = z.infer<typeof UpdateDemographicsStepSchema>;
export type UpdateFamilyStepDTO = z.infer<typeof UpdateFamilyStepSchema>;
export type UpdateLifestyleStepDTO = z.infer<typeof UpdateLifestyleStepSchema>;
export type UpdateLocationStepDTO = z.infer<typeof UpdateLocationStepSchema>;
export type UpdatePhotosMetadataStepDTO = z.infer<typeof UpdatePhotosMetadataStepSchema>;
export type UpdatePreferencesStepDTO = z.infer<typeof UpdatePreferencesStepSchema>;
export type StepUpdateDTO = z.infer<typeof StepUpdateSchema>;
