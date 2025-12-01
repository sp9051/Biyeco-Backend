-- Add registeredUserId column to profiles table
ALTER TABLE "profiles" ADD COLUMN "registeredUserId" TEXT NOT NULL DEFAULT '';

-- Create unique index for registeredUserId
CREATE UNIQUE INDEX "profiles_registeredUserId_key" ON "profiles"("registeredUserId");

-- Update existing profiles with a default value (this is temporary, they should be regenerated)
-- In production, you may want to handle this differently
UPDATE "profiles" SET "registeredUserId" = 'TBCo_' || LPAD(ROW_NUMBER() OVER (ORDER BY "createdAt"), 9, '0') WHERE "registeredUserId" = '';
