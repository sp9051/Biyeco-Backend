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

## MODULE 8 - NOTIFICATION SYSTEM

### Completed Tasks:
[x] 1. Created Prisma schema additions for Notification and NotificationPreference models
[x] 2. Created event bus system at src/events/eventBus.ts
[x] 3. Created notification types and priorities (notification.types.ts, notification.priorities.ts)
[x] 4. Created notification templates (notification.templates.ts)
[x] 5. Created notification DTOs with Zod validation (notification.dto.ts)
[x] 6. Created notification preference service (notificationPreference.service.ts)
[x] 7. Created notification dispatcher with priority queue (notification.dispatcher.ts)
[x] 8. Created notification service with email stub (notification.service.ts)
[x] 9. Created notification controller (notification.controller.ts)
[x] 10. Created notification routes with JWT protection (notification.routes.ts)
[x] 11. Created OpenAPI specification (openapi.notifications.yml)
[x] 12. Created unit test stubs (notification.test.ts)
[x] 13. Registered notification routes in src/index.ts

### New Files Created:
- src/events/eventBus.ts - Simple publish/subscribe event emitter
- src/modules/notifications/notification.types.ts - TypeScript type definitions
- src/modules/notifications/notification.priorities.ts - Priority level constants
- src/modules/notifications/notification.templates.ts - Notification templates per event type
- src/modules/notifications/notification.dto.ts - Zod validation schemas
- src/modules/notifications/notificationPreference.service.ts - Preference management service
- src/modules/notifications/notification.dispatcher.ts - Priority queue dispatcher
- src/modules/notifications/notification.service.ts - Core notification service
- src/modules/notifications/notification.controller.ts - Request handlers
- src/modules/notifications/notification.routes.ts - REST endpoints
- src/modules/notifications/openapi.notifications.yml - OpenAPI specification
- src/modules/notifications/notification.test.ts - Unit test stubs

### New REST Endpoints (JWT Protected):
- GET /api/v1/notifications - List notifications
- GET /api/v1/notifications/unread-count - Get unread count
- PATCH /api/v1/notifications/:id/read - Mark one as read
- PATCH /api/v1/notifications/read-all - Bulk mark as read
- GET /api/v1/notifications/preferences - Get preferences
- PATCH /api/v1/notifications/preferences - Update preferences

### Prisma Schema Changes (run migrations manually):
- Added Notification model with userId, type, title, body, metadata, isRead, deliveredAt, createdAt
- Added NotificationPreference model with emailEnabled, pushEnabled, inAppEnabled
- Added relations to User model: notifications, notificationPreference

### Migration Command (run manually):
```bash
npx prisma migrate dev --name add_notification_system
```

### Notes:
- No packages were installed
- No migrations were executed
- Email sender is a stub (Nodemailer configuration commented out)
- Push notifications use FCM stub (no credentials embedded)
- Priority queue stubs included for future RabbitMQ/Redis integration