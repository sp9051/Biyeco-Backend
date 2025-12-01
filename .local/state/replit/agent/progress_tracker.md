[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. Verify the project is working using the feedback tool
[x] 4. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool

## registeredUserId Column Implementation

### Completed Tasks:
[x] 1. Added `registeredUserId` column to Profile model in Prisma schema
[x] 2. Created utility function to generate registeredUserId (format: TBCo_XXXXXXXXX)
[x] 3. Updated auth.service.ts registerSelf to generate registeredUserId when creating profile
[x] 4. Updated auth.service.ts registerParent to generate registeredUserId when creating profile
[x] 5. Updated profile.service.ts createProfile to generate registeredUserId when creating profile
[x] 6. Created database migration file (20251201_add_registered_user_id)
[x] 7. Added imports to auth.service.ts and profile.service.ts

### Files Modified:
- prisma/schema.prisma - Added `registeredUserId String @unique` to Profile model
- src/utils/profileId.generator.ts - New file with generateRegisteredUserId() function
- src/modules/auth/auth.service.ts - Updated registerSelf and registerParent to use generator
- src/modules/profile/profile.service.ts - Updated createProfile to use generator
- prisma/migrations/20251201_add_registered_user_id/migration.sql - New migration

### Implementation Details:
- registeredUserId format: TBCo_XXXXXXXXX (9 random digits)
- Auto-generated when new profiles are created
- Made unique constraint on database level
- All profile creation paths now include registeredUserId