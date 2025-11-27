# Notification System Module - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Event Flow](#event-flow)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Event Bus Usage](#event-bus-usage)
7. [Priority System](#priority-system)
8. [Notification Types](#notification-types)
9. [Preferences Management](#preferences-management)
10. [Integration Examples](#integration-examples)

---

## Overview

The Notification System is a scalable, event-driven notification architecture that handles:

- **In-app notifications** - Persistent notifications stored in database
- **Email notifications** - Delivered via Nodemailer (stub for production setup)
- **Push notifications** - Queued for FCM integration (stub)
- **User preferences** - Granular control over notification delivery channels
- **Priority-based delivery** - IMMEDIATE, HIGH, or LOW priority with retry logic

The system follows a publish/subscribe pattern where other modules emit notification events, and a centralized dispatcher handles delivery based on user preferences and priority levels.

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Notification System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Other Modules                                                  │
│  (Auth, Chat, Connections, etc.)                                │
│         │                                                       │
│         │ eventBus.emitNotification({...})                      │
│         ▼                                                       │
│    ┌─────────────┐                                             │
│    │  Event Bus  │ (src/events/eventBus.ts)                    │
│    └─────────────┘                                             │
│         │                                                       │
│         │ on("notify")                                         │
│         ▼                                                       │
│    ┌──────────────────────┐                                    │
│    │ NotificationDispatcher│ (notification.dispatcher.ts)      │
│    │  - Priority Queue    │                                    │
│    │  - Retry Logic       │                                    │
│    └──────────────────────┘                                    │
│         │                                                       │
│         ├─────────────────────────┐                            │
│         │                         │                            │
│         ▼                         ▼                            │
│    ┌─────────────────┐    ┌───────────────────┐               │
│    │ Check User      │    │ Get Notification  │               │
│    │ Preferences     │    │ Template          │               │
│    └─────────────────┘    └───────────────────┘               │
│         │                         │                            │
│         └─────────────────────────┘                            │
│                 │                                              │
│                 ▼                                              │
│    ┌──────────────────────────────────────┐                   │
│    │   Determine Delivery Channels        │                   │
│    │   Based on:                          │                   │
│    │   - User Preferences                 │                   │
│    │   - Priority Level (IMMEDIATE/HIGH) │                   │
│    │   - Notification Type                │                   │
│    └──────────────────────────────────────┘                   │
│         │         │         │                                 │
│         ▼         ▼         ▼                                 │
│    ┌─────────┐ ┌────────┐ ┌──────────────┐                   │
│    │ In-App  │ │ Email  │ │ Push (FCM)   │                   │
│    │Database │ │Nodemailer│ │ Queue/Stub   │                   │
│    └─────────┘ └────────┘ └──────────────┘                   │
│         │         │         │                                 │
│         └─────────┼─────────┘                                 │
│                   ▼                                           │
│          ┌─────────────────┐                                 │
│          │ Notification    │                                 │
│          │ Delivered       │                                 │
│          └─────────────────┘                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

**1. Event Bus (`src/events/eventBus.ts`)**
- Simple EventEmitter wrapper
- Allows any module to emit notifications
- Subscribers listen for "notify" events

**2. Dispatcher (`notification.dispatcher.ts`)**
- Maintains priority queue of notifications
- Processes queue at regular intervals
- Handles retry logic with exponential backoff
- Checks user preferences before delivery

**3. Preference Service (`notificationPreference.service.ts`)**
- Manages per-user notification settings
- Creates default preferences (all enabled)
- Updates user preferences atomically

**4. Templates (`notification.templates.ts`)**
- Pre-built templates for each notification type
- Generates title, body, email subject, email HTML
- Supports dynamic data interpolation

**5. Service (`notification.service.ts`)**
- Creates in-app notifications in database
- Retrieves notifications with pagination
- Marks notifications as read
- Sends email stubs
- Sends push stubs

**6. Controller (`notification.controller.ts`)**
- Handles HTTP request routing
- Validates user authorization
- Formats API responses

---

## Event Flow

### Complete Request Lifecycle

```
1. EVENT EMISSION (From another module)
   ├─ Chat Module: New message → eventBus.emitNotification({...})
   ├─ Connections Module: Interest accepted → eventBus.emitNotification({...})
   └─ Auth Module: OTP required → eventBus.emitNotification({...})

2. EVENT RECEIVED
   └─ Dispatcher listens on "notify" event
      └─ Determines priority (IMMEDIATE/HIGH/LOW)
      └─ Adds to queue if not IMMEDIATE (IMMEDIATE processes immediately)

3. QUEUE PROCESSING (Every 1000ms)
   ├─ Check if notifications ready for processing
   ├─ Filter by ready notifications (past nextAttemptAt time)
   └─ For each notification:

4. PREFERENCE CHECKING
   ├─ Get user's notification preferences
   ├─ Check: emailEnabled, pushEnabled, inAppEnabled
   └─ Get notification template

5. DELIVERY
   ├─ IMMEDIATE Priority: email + in-app
   │  ├─ Create in-app notification (Prisma)
   │  └─ Send email (Nodemailer stub)
   │
   ├─ HIGH Priority: push + in-app
   │  ├─ Create in-app notification (Prisma)
   │  └─ Queue push (FCM stub)
   │
   └─ LOW Priority: in-app only
      └─ Create in-app notification (Prisma)

6. RETRY ON FAILURE
   ├─ If delivery fails:
   │  ├─ Increment attempts counter
   │  ├─ Check if < maxAttempts for priority level
   │  └─ Re-queue with delay (1s for IMMEDIATE, 5s for HIGH, 10s for LOW)
   │
   └─ If maxAttempts exceeded:
      └─ Log error and discard

7. COMPLETION
   ├─ Remove from queue
   └─ User can retrieve via API endpoints
```

### Priority Levels & Retry Strategy

| Priority | Delivery Methods | Max Attempts | Retry Delay |
|----------|------------------|--------------|-------------|
| IMMEDIATE | Email + In-App | 3 | 1 second |
| HIGH | Push + In-App | 2 | 5 seconds |
| LOW | In-App Only | 1 | 10 seconds |

---

## Database Schema

### Notification Model

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,           -- notification type
  title VARCHAR(255) NOT NULL,         -- short title
  body TEXT NOT NULL,                  -- notification body text
  metadata JSONB,                      -- custom data
  is_read BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX (user_id),
  INDEX (is_read),
  INDEX (created_at)
);
```

### NotificationPreference Model

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Relationships

```typescript
User.notifications → Notification[] (1-to-many)
User.notificationPreference → NotificationPreference (1-to-1)
Notification.user → User (many-to-1)
NotificationPreference.user → User (1-to-1)
```

---

## API Endpoints

### 1. List Notifications

**Endpoint:** `GET /api/v1/notifications`

**Authentication:** Required (Bearer JWT token)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number (1-indexed) |
| limit | number | 20 | Items per page (max 100) |
| unreadOnly | boolean | false | Show only unread notifications |
| type | string | - | Filter by notification type |

**Request Example:**

```bash
GET /api/v1/notifications?page=1&limit=10&unreadOnly=true
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "userId": "550e8400-e29b-41d4-a716-446655440001",
        "type": "interest_received",
        "title": "You have a new interest!",
        "body": "Sarah has shown interest in your profile",
        "isRead": false,
        "deliveredAt": "2024-01-15T10:30:00Z",
        "createdAt": "2024-01-15T10:30:00Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "userId": "550e8400-e29b-41d4-a716-446655440001",
        "type": "new_message",
        "title": "New message received",
        "body": "Sarah sent you a message",
        "isRead": false,
        "deliveredAt": "2024-01-15T10:25:00Z",
        "createdAt": "2024-01-15T10:25:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  },
  "message": "Notifications retrieved successfully"
}
```

**Error Response (401 Unauthorized):**

```json
{
  "success": false,
  "error": {
    "message": "No token provided",
    "code": "UNAUTHORIZED"
  }
}
```

---

### 2. Get Unread Count

**Endpoint:** `GET /api/v1/notifications/unread-count`

**Authentication:** Required (Bearer JWT token)

**Request Example:**

```bash
GET /api/v1/notifications/unread-count
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  },
  "message": "Unread count retrieved"
}
```

---

### 3. Mark Notification as Read

**Endpoint:** `PATCH /api/v1/notifications/:id/read`

**Authentication:** Required (Bearer JWT token)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Notification ID |

**Request Example:**

```bash
PATCH /api/v1/notifications/550e8400-e29b-41d4-a716-446655440000/read
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "type": "interest_received",
    "title": "You have a new interest!",
    "body": "Sarah has shown interest in your profile",
    "isRead": true,
    "deliveredAt": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "message": "Notification marked as read"
}
```

**Error Response (404 Not Found):**

```json
{
  "success": false,
  "error": {
    "message": "Notification not found",
    "code": "NOTIFICATION_NOT_FOUND"
  }
}
```

---

### 4. Mark All Notifications as Read

**Endpoint:** `PATCH /api/v1/notifications/read-all`

**Authentication:** Required (Bearer JWT token)

**Request Example:**

```bash
PATCH /api/v1/notifications/read-all
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "markedCount": 10
  },
  "message": "10 notifications marked as read"
}
```

---

### 5. Get Notification Preferences

**Endpoint:** `GET /api/v1/notifications/preferences`

**Authentication:** Required (Bearer JWT token)

**Request Example:**

```bash
GET /api/v1/notifications/preferences
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "emailEnabled": true,
    "pushEnabled": true,
    "inAppEnabled": true
  },
  "message": "Notification preferences retrieved"
}
```

---

### 6. Update Notification Preferences

**Endpoint:** `PATCH /api/v1/notifications/preferences`

**Authentication:** Required (Bearer JWT token)

**Request Body:**

```typescript
{
  emailEnabled?: boolean,     // optional
  pushEnabled?: boolean,      // optional
  inAppEnabled?: boolean      // optional
}
```

**Request Example:**

```bash
PATCH /api/v1/notifications/preferences
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "emailEnabled": true,
  "pushEnabled": false,
  "inAppEnabled": true
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "emailEnabled": true,
    "pushEnabled": false,
    "inAppEnabled": true
  },
  "message": "Notification preferences updated"
}
```

**Error Response (400 Bad Request):**

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "emailEnabled": "Expected boolean"
    }
  }
}
```

---

## Event Bus Usage

### How to Emit Notifications from Other Modules

Import the event bus and emit notification events:

```typescript
import { eventBus } from '../../events/eventBus.js';

// Example 1: Interest received notification
eventBus.emitNotification({
  userId: "user-uuid-123",
  type: "interest_received",
  metadata: {
    fromName: "Sarah",
    fromUserId: "user-uuid-456"
  },
  priority: "HIGH"  // optional, defaults based on type
});

// Example 2: New message notification
eventBus.emitNotification({
  userId: "user-uuid-123",
  type: "new_message",
  metadata: {
    fromName: "John",
    threadId: "thread-uuid-789"
  }
  // priority: omitted → will use default for "new_message" (HIGH)
});

// Example 3: OTP notification (IMMEDIATE)
eventBus.emitNotification({
  userId: "user-uuid-123",
  type: "otp",
  metadata: {
    otp: "123456",
    expiryMinutes: 5
  },
  priority: "IMMEDIATE"
});

// Example 4: Moderation notification
eventBus.emitNotification({
  userId: "user-uuid-123",
  type: "moderation",
  metadata: {
    contentType: "photo",
    action: "rejected",
    reason: "Photo quality too low"
  },
  priority: "HIGH"
});
```

### Integration Points in Existing Modules

**Auth Module** (sending OTP):
```typescript
// In auth.service.ts when OTP is sent
eventBus.emitNotification({
  userId: user.id,
  type: "otp",
  metadata: { otp, expiryMinutes: 10 },
  priority: "IMMEDIATE"
});
```

**Connections Module** (when interest is sent/received):
```typescript
// In connections.service.ts
eventBus.emitNotification({
  userId: recipientUserId,
  type: "interest_received",
  metadata: { fromName: senderProfile.displayName },
  priority: "HIGH"
});
```

**Chat Module** (new message received):
```typescript
// In chat.service.ts
eventBus.emitNotification({
  userId: recipientUserId,
  type: "new_message",
  metadata: { fromName: senderProfile.displayName },
  priority: "HIGH"
});
```

---

## Priority System

### Understanding Priority Levels

**IMMEDIATE Priority**
- Used for: OTP, Guardian Added, Subscription, Critical updates
- Delivery: Email + In-App
- Max Attempts: 3 with 1-second retry delay
- Use Case: Time-sensitive notifications that need immediate action

**HIGH Priority**
- Used for: Interest Received, Interest Accepted, New Message, Moderation
- Delivery: Push + In-App
- Max Attempts: 2 with 5-second retry delay
- Use Case: Important user engagement (matches, messages)

**LOW Priority**
- Used for: Profile View
- Delivery: In-App Only
- Max Attempts: 1 with 10-second retry delay
- Use Case: Informational notifications

### Default Priority Mapping

```typescript
const DEFAULT_PRIORITY_BY_TYPE = {
  "otp": "IMMEDIATE",
  "interest_received": "HIGH",
  "interest_accepted": "HIGH",
  "new_message": "HIGH",
  "profile_view": "LOW",
  "guardian_added": "IMMEDIATE",
  "subscription": "IMMEDIATE",
  "moderation": "HIGH"
};
```

### Retry Strategy

```
Notification Event Emitted
    ↓
Added to Queue with attempts = 0
    ↓
Process at nextAttemptAt time
    ↓
Try Delivery
    ├─ SUCCESS → Remove from queue, complete
    └─ FAILURE → 
        ├─ attempts++
        ├─ if (attempts < maxAttempts)
        │  └─ Reschedule with delay → back to queue
        └─ else
           └─ Log error, discard
```

---

## Notification Types

### 1. OTP

**Priority:** IMMEDIATE
**Delivery:** Email + In-App
**Use:** Email verification

**Template:**
```
Title: "Verify your email"
Body: "Your OTP is 123456. It will expire in 10 minutes."
```

**Metadata:**
```json
{
  "otp": "123456",
  "expiryMinutes": 10
}
```

---

### 2. Interest Received

**Priority:** HIGH
**Delivery:** Push + In-App
**Use:** Someone shows interest in user's profile

**Template:**
```
Title: "You have a new interest!"
Body: "Sarah has shown interest in your profile"
```

**Metadata:**
```json
{
  "fromName": "Sarah",
  "fromUserId": "user-uuid"
}
```

---

### 3. Interest Accepted

**Priority:** HIGH
**Delivery:** Push + In-App
**Use:** User's interest was accepted

**Template:**
```
Title: "Your interest was accepted!"
Body: "Sarah has accepted your interest. You can now start a conversation!"
```

**Metadata:**
```json
{
  "acceptedByName": "Sarah",
  "acceptedByUserId": "user-uuid"
}
```

---

### 4. New Message

**Priority:** HIGH
**Delivery:** Push + In-App
**Use:** New chat message received

**Template:**
```
Title: "New message received"
Body: "Sarah sent you a message"
```

**Metadata:**
```json
{
  "fromName": "Sarah",
  "threadId": "thread-uuid"
}
```

---

### 5. Profile View

**Priority:** LOW
**Delivery:** In-App Only
**Use:** Someone viewed user's profile

**Template:**
```
Title: "Someone viewed your profile"
Body: "Sarah viewed your profile"
```

**Metadata:**
```json
{
  "viewerName": "Sarah",
  "viewerUserId": "user-uuid"
}
```

---

### 6. Guardian Added

**Priority:** IMMEDIATE
**Delivery:** Email + In-App
**Use:** User added as guardian to a profile

**Template:**
```
Title: "You have been added as a guardian"
Body: "You have been added as a mother for Raj's profile"
```

**Metadata:**
```json
{
  "relationship": "mother",
  "candidateName": "Raj"
}
```

---

### 7. Subscription

**Priority:** IMMEDIATE
**Delivery:** Email + In-App
**Use:** Subscription purchase/expiry

**Template (Purchase):**
```
Title: "Subscription update"
Body: "Your Premium subscription is now active!"
```

**Template (Expiry):**
```
Title: "Subscription update"
Body: "Your Premium subscription will expire on 2024-02-15"
```

**Metadata:**
```json
{
  "action": "purchased" | "expiring",
  "planName": "Premium",
  "expiryDate": "2024-02-15"
}
```

---

### 8. Moderation

**Priority:** HIGH
**Delivery:** Push + In-App
**Use:** Profile/photo moderation updates

**Template (Approved):**
```
Title: "Profile moderation update"
Body: "Your photo has been approved"
```

**Template (Rejected):**
```
Title: "Profile moderation update"
Body: "Your photo requires attention: Image quality too low"
```

**Metadata:**
```json
{
  "action": "approved" | "rejected",
  "contentType": "photo" | "profile",
  "reason": "Image quality too low"
}
```

---

## Preferences Management

### Default Behavior

When a user is created, their notification preferences are automatically initialized to:

```json
{
  "emailEnabled": true,
  "pushEnabled": true,
  "inAppEnabled": true
}
```

### How Preferences Affect Delivery

The dispatcher checks preferences before each delivery attempt:

```typescript
const preferences = await notificationPreferenceService.getPreferences(userId);

if (config.deliveryMethods.includes('email') && preferences.emailEnabled) {
  // Send email
}

if (config.deliveryMethods.includes('push') && preferences.pushEnabled) {
  // Queue push notification
}

if (config.deliveryMethods.includes('in_app') && preferences.inAppEnabled) {
  // Create in-app notification
}
```

### Scenarios

**Scenario 1: User disables emails**

```json
{
  "emailEnabled": false,
  "pushEnabled": true,
  "inAppEnabled": true
}
```

When an IMMEDIATE priority notification is sent:
- Email → SKIPPED
- In-App → SENT

**Scenario 2: User disables all push**

```json
{
  "emailEnabled": true,
  "pushEnabled": false,
  "inAppEnabled": true
}
```

When a HIGH priority notification is sent:
- Push → SKIPPED
- In-App → SENT

**Scenario 3: User only wants in-app**

```json
{
  "emailEnabled": false,
  "pushEnabled": false,
  "inAppEnabled": true
}
```

All notifications → In-app only

---

## Integration Examples

### Example 1: Chat Module Integration

```typescript
// File: src/modules/chat/chat.service.ts

import { eventBus } from '../../events/eventBus.js';

async sendMessage(fromUserId: string, toUserId: string, content: string) {
  // ... create message in database ...
  
  const sender = await prisma.user.findUnique({
    where: { id: fromUserId },
    select: { firstName: true }
  });
  
  // Emit notification
  eventBus.emitNotification({
    userId: toUserId,
    type: "new_message",
    metadata: {
      fromName: sender.firstName,
      threadId: threadId
    },
    priority: "HIGH"
  });
  
  return message;
}
```

### Example 2: Connections Module Integration

```typescript
// File: src/modules/connections/connections.service.ts

import { eventBus } from '../../events/eventBus.js';

async sendInterest(fromUserId: string, toUserId: string) {
  // ... create interest record ...
  
  const sender = await prisma.profile.findUnique({
    where: { userId: fromUserId },
    select: { displayName: true }
  });
  
  // Emit notification
  eventBus.emitNotification({
    userId: toUserId,
    type: "interest_received",
    metadata: {
      fromName: sender.displayName,
      fromUserId: fromUserId
    },
    priority: "HIGH"
  });
  
  return interest;
}
```

### Example 3: Auth Module Integration

```typescript
// File: src/modules/auth/auth.service.ts

import { eventBus } from '../../events/eventBus.js';

async generateAndSendOTP(email: string) {
  const otp = generateOTP();
  
  // ... save OTP hash to database ...
  
  // Emit notification
  eventBus.emitNotification({
    userId: user.id,
    type: "otp",
    metadata: {
      otp: otp,
      expiryMinutes: 5
    },
    priority: "IMMEDIATE"
  });
  
  return { success: true };
}
```

---

## Security Considerations

### User Privacy

1. **Per-User Isolation**
   - Users can only fetch their own notifications
   - Controller validates `req.userId` against notification owner

2. **Preference Enforcement**
   - Preferences are always checked before delivery
   - User cannot receive emails if emailEnabled = false

3. **Metadata Filtering**
   - Email templates remove sensitive metadata
   - In-app notifications can expose more data

### Rate Limiting

- List notifications: Subject to global rate limiter (100 req/15min)
- Mark as read: Subject to global rate limiter
- Update preferences: Subject to global rate limiter

### Authentication

- All endpoints require valid JWT token
- Invalid/expired tokens return 401 Unauthorized
- Revoked sessions block notification access

---

## Monitoring & Debugging

### Logging

All operations are logged with structured JSON:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "uuid",
  "level": "info",
  "message": "Notification delivered successfully",
  "userId": "user-uuid",
  "type": "interest_received",
  "priority": "HIGH",
  "deliveryMethods": ["push", "in_app"]
}
```

### Queue Status

Check notification dispatcher queue length:

```typescript
import { notificationDispatcher } from './notification.dispatcher';

const queueLength = notificationDispatcher.getQueueLength();
console.log(`Notifications in queue: ${queueLength}`);
```

### Manual Testing

```bash
# Test 1: Emit notification
curl -X POST http://localhost:3000/api/v1/some-endpoint \
  -H "Authorization: Bearer $TOKEN"

# Check if notification was created
curl -X GET "http://localhost:3000/api/v1/notifications?unreadOnly=true" \
  -H "Authorization: Bearer $TOKEN"

# Test 2: Check preferences
curl -X GET http://localhost:3000/api/v1/notifications/preferences \
  -H "Authorization: Bearer $TOKEN"

# Test 3: Update preferences
curl -X PATCH http://localhost:3000/api/v1/notifications/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"emailEnabled": false}'
```

---

## Migration Instructions

After deploying this module, run the database migration:

```bash
# Create migration
npx prisma migrate dev --name add_notification_system

# In production
npx prisma migrate deploy
```

This creates:
- `notifications` table
- `notification_preferences` table
- Indexes on frequently queried columns
- Foreign key relationships to users table

---

## Future Enhancements

1. **Email Configuration**
   - Connect real Nodemailer SMTP
   - Add email templates
   - Track email delivery/open status

2. **Push Notifications (FCM)**
   - Integrate Firebase Cloud Messaging
   - Device token management
   - Rich push with images/actions

3. **Notification Scheduling**
   - Schedule notifications for later delivery
   - Quiet hours (don't disturb times)
   - Time-zone aware scheduling

4. **Analytics**
   - Track notification delivery rates
   - User engagement metrics
   - A/B testing for templates

5. **Notification Grouping**
   - Combine similar notifications
   - Digest mode (daily/weekly summary)
   - Smart consolidation

---

## Support & Contact

For issues, questions, or contributions:
- Review test stubs in `notification.test.ts`
- Check OpenAPI spec in `openapi.notifications.yml`
- Reference existing modules for patterns
