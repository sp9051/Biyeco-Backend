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

---

## MODULE 10 — PAYMENT & SUBSCRIPTION SYSTEM (Backend Only)

### Completed Tasks:
[x] 1. Appended Prisma models: Plan, Subscription, Payment to schema.prisma
[x] 2. Created payment module directory structure with types
[x] 3. Implemented plan.seed.ts with all 4 plans (ALAAP, JATRA, AALOK, OBHIJAAT)
[x] 4. Implemented plan.service.ts for plan management
[x] 5. Implemented entitlement.service.ts with capability checks for all actions
[x] 6. Implemented subscription.service.ts with full lifecycle management
[x] 7. Implemented payment.service.ts with checkout flow
[x] 8. Implemented gateway adapters (SSLCommerz, Stripe, bKash, Apple Pay) as stubs
[x] 9. Implemented payment.controller.ts and webhook.controller.ts
[x] 10. Implemented payment.routes.ts with all API endpoints
[x] 11. Updated index.ts to register payment routes
[x] 12. Updated notification types and templates for payment events

### New Files Created:
- prisma/schema.prisma - Added Plan, Subscription, Payment models
- src/modules/payments/payment.types.ts - Type definitions
- src/modules/payments/payment.dto.ts - Validation schemas
- src/modules/payments/plan.seed.ts - Plan seeding script
- src/modules/payments/plan.service.ts - Plan management service
- src/modules/payments/entitlement.service.ts - Capability check service
- src/modules/payments/subscription.service.ts - Subscription lifecycle service
- src/modules/payments/payment.service.ts - Payment processing service
- src/modules/payments/payment.controller.ts - REST API controller
- src/modules/payments/webhook.controller.ts - Webhook handlers
- src/modules/payments/payment.routes.ts - Route definitions
- src/modules/payments/gateways/sslcommerz.gateway.ts - SSLCommerz adapter
- src/modules/payments/gateways/stripe.gateway.ts - Stripe adapter
- src/modules/payments/gateways/bkash.gateway.ts - bKash adapter
- src/modules/payments/gateways/applepay.gateway.ts - Apple Pay adapter

### Files Modified:
- src/index.ts - Added payment routes
- src/modules/notifications/notification.types.ts - Added new notification types
- src/modules/notifications/notification.templates.ts - Added payment notification templates

### API Endpoints:
GET  /api/v1/payments/plans - List all plans
GET  /api/v1/payments/plans/:code - Get plan by code
POST /api/v1/payments/subscriptions/checkout - Initiate checkout
GET  /api/v1/payments/subscriptions/:profileId - Get active subscription
GET  /api/v1/payments/subscriptions/:profileId/history - Get subscription history
POST /api/v1/payments/subscriptions/:profileId/pause - Pause subscription
POST /api/v1/payments/subscriptions/:profileId/resume - Resume subscription
POST /api/v1/payments/subscriptions/:profileId/cancel - Cancel subscription
GET  /api/v1/payments/payments/:profileId/history - Get payment history
GET  /api/v1/payments/entitlements/:profileId/usage - Get usage stats
POST /api/v1/payments/entitlements/:profileId/check - Check entitlement
POST /api/v1/payments/webhooks/sslcommerz - SSLCommerz IPN
POST /api/v1/payments/webhooks/stripe - Stripe webhook
POST /api/v1/payments/webhooks/bkash - bKash webhook
POST /api/v1/payments/webhooks/applepay - Apple Pay webhook

### Implementation Notes:
- Subscription is tied to Profile (not User)
- Parent/guardian inherit permissions from profile's subscription
- All feature checks happen via entitlementService.can(profileId, action, context)
- Gateway adapters are stubs with verification hooks
- Migrations NOT auto-run as requested
