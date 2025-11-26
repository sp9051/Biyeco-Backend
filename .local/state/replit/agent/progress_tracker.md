[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. Verify the project is working using the feedback tool
[x] 4. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool

## Patch Update Summary - Registration Architecture

### Completed Tasks:
[x] 1. Updated Prisma schema with new CandidateLink model structure
[x] 2. Added ParentLinks/ChildLinks relations to User model
[x] 3. Added candidateLinks relation to Profile model
[x] 4. Updated auth.dto.ts with new schemas (ParentRegistrationSchema, CandidateStartSchema, InviteChildSchema)
[x] 5. Patched registerSelf to treat User as login-only (no biodata on User)
[x] 6. Patched registerParent to create candidate user + profile + CandidateLink
[x] 7. Added candidateStart method for candidate onboarding
[x] 8. Added inviteChild method for inviting additional guardians
[x] 9. Added guardianStart method for guardian onboarding
[x] 10. Updated verify method to activate CandidateLink status
[x] 11. Added sendCandidateInvite and sendGuardianInvite email methods
[x] 12. Updated auth.routes.ts with new endpoints

### New Endpoints Added:
- POST /auth/candidate/start - Candidate sets password and receives OTP
- POST /auth/guardian/start - Guardian sets password and receives OTP
- POST /auth/invite-child - Invite additional users to manage a profile (authenticated)

### Schema Changes (run migrations manually):
- CandidateLink: Added profileId, childUserId, relationship, role fields
- CandidateLink: Changed parentUserId from @unique to indexed
- CandidateLink: Removed candidateEmail, otpCode, otpExpiry fields
- User: Added parentLinks and childLinks relations
- Profile: Added candidateLinks relation