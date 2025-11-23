# Biye Matrimonial Platform - Backend API

## Overview

A secure, production-ready backend API for a matrimonial platform built with Node.js, Express, and TypeScript. The system implements password + email OTP 2-step authentication with JWT access tokens and rotating refresh tokens stored in Redis. It includes a comprehensive profile management system with draft/publish workflow, step-by-step profile wizard, completeness tracking, and privacy controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Technology Stack

**Runtime & Framework**
- Node.js 18+ with Express.js framework
- TypeScript with strict mode enabled for type safety
- ES Modules (ESNext) for modern JavaScript features

**Database & Caching**
- PostgreSQL as the primary database via Prisma ORM
- Redis for session management and refresh token storage
- Prisma schema defines User and Session models with relationships

### Authentication Architecture

**OTP-Based Email Authentication**
- Email-only authentication (no phone OTP)
- 6-digit numeric OTP with 5-minute expiry
- OTP hashed with bcrypt before storage in database
- Rate limiting: 3 OTP requests per 15 minutes per email, 5 per IP
- Separate flows for registration and login with OTP verification

**Token Management**
- JWT access tokens with 15-minute expiry
- Rotating refresh tokens stored in Redis with 7-day expiry
- Access tokens contain userId, email, and sessionId claims
- Refresh token rotation on every refresh request
- Token reuse detection for security

**Session Tracking**
- Device ID, IP address, and User Agent tracking
- Session revocation support (individual and bulk)
- Last activity timestamp updates
- Session validation on every authenticated request

### Security Architecture

**Request Security**
- Helmet middleware for security headers (CSP, HSTS, X-Frame-Options)
- CORS middleware with origin whitelist validation
- Rate limiting: 100 requests per 15 minutes globally, stricter limits on auth endpoints
- Request ID tracking (UUID) for distributed tracing
- Cookie security: HttpOnly, Secure (production), SameSite=strict

**Validation & Error Handling**
- Zod schemas for all request validation (body, query, params)
- Centralized error handler with request context logging
- Standardized JSON response format (success/error structure)
- Environment variable validation on startup

### API Architecture

**Route Organization**
- `/api/health` - Health check endpoint
- `/api/v1/auth/*` - Authentication endpoints (register, verify, login, refresh, logout, me)
- `/api/v1/profiles/*` - Profile management endpoints (CRUD, step updates, publish/unpublish)
- `/api/v1/chats/*` - Chat & messaging endpoints (threads, messages, read receipts)
- Modular route structure with separate controller, service, and DTO layers

**Response Format**
```typescript
Success: { success: true, data: T, message?: string }
Error: { success: false, error: { message, code?, details? } }
```

**Middleware Pipeline**
1. Request ID assignment
2. Request logging with duration tracking
3. Helmet security headers
4. CORS validation
5. Rate limiting
6. Body parsing (JSON/URL-encoded, 10MB limit)
7. Cookie parsing
8. Route handlers
9. 404 handler
10. Centralized error handler

### Service Layer Architecture

**Authentication Service** (`auth.service.ts`)
- User registration with OTP generation
- OTP verification with session creation
- Login flow with existing user validation
- Token refresh with rotation
- Logout with session revocation
- User profile retrieval

**Token Service** (`token.service.ts`)
- JWT access token generation and verification
- Refresh token generation with Redis storage
- Token rotation logic
- Expiry parsing utilities

**Session Service** (`session.service.ts`)
- Session CRUD operations via Prisma
- Session activity tracking
- Bulk and individual session revocation
- Active session retrieval

**Email Service** (`email.service.ts`)
- Real Nodemailer SMTP integration
- OTP email delivery with HTML templates
- Welcome email delivery
- Development mode OTP logging

**Profile Service** (`profile.service.ts`)
- Profile creation (draft state)
- Step-by-step profile updates (7 distinct steps)
- Profile publishing with validation
- Profile unpublishing
- Profile retrieval with masking
- Soft delete support

**Completeness Service** (`completeness.service.ts`)
- Dynamic completeness calculation (0-100%)
- Weighted scoring for each profile section
- Publish readiness validation
- Missing fields detection

**Profile Permissions** (`profile.permissions.ts`)
- Field-level masking based on viewer permissions
- Owner/Guardian/Premium/Visitor access levels
- Photo privacy filtering
- Location coordinate protection
- About section truncation for non-premium users

**Chat Service** (`chat.service.ts`)
- Thread management with mutual match validation
- Real-time message persistence
- Cursor-based message pagination
- Read receipt tracking
- Profanity filtering with metadata
- Participant authorization checks

### Logging & Monitoring

**Winston Logger**
- Structured JSON logging in production
- Colorized console output in development
- Log levels: error, warn, info, http, verbose, debug, silly
- Request correlation via request ID
- Service-level default metadata

**Request Logging**
- HTTP method, path, status code
- Request duration in milliseconds
- Request ID for tracing

### Testing Strategy

**Jest Configuration**
- ts-jest with ESM support
- Unit tests in `__tests__` directories
- Coverage collection from `src/**/*.ts`
- Test environment: Node.js
- Mock support for environment variables and external services

## External Dependencies

### Required Services

**PostgreSQL Database**
- Managed via Prisma ORM
- Connection string in `DATABASE_URL` environment variable
- Models:
  - User (email, fullName, phoneNumber, passwordHash, isVerified, otpHash, otpExpiry)
  - Session (userId, deviceId, ip, userAgent, revoked, lastSeenAt)
  - Profile (userId, displayName, headline, about, gender, dob, location, published, completeness)
  - Photo (profileId, objectKey, url, fileSize, privacyLevel, moderationStatus)
  - Preference (profileId, basic, lifestyle, education, community, location)
  - Thread (participantIds, createdAt, updatedAt)
  - Message (threadId, senderId, content, metadata, deliveredAt, readAt)

**Redis Cache**
- ioredis client with connection retry logic
- Connection string in `REDIS_URL` environment variable
- Used for: refresh token storage, OTP rate limiting, token reuse detection
- Automatic reconnection on errors

### Third-Party NPM Packages

**Production Dependencies**
- `express` - Web framework
- `@prisma/client` - Database ORM
- `ioredis` - Redis client
- `jsonwebtoken` - JWT token generation/verification
- `bcryptjs` - Password/OTP hashing
- `zod` - Schema validation
- `helmet` - Security headers
- `cors` - CORS handling
- `express-rate-limit` - Rate limiting
- `cookie-parser` - Cookie parsing
- `winston` - Logging
- `dotenv` - Environment variable loading
- `socket.io` - Real-time WebSocket server
- `socket.io-client` - Socket.IO client (for testing)

**Development Dependencies**
- `typescript` - Type system
- `tsx` - TypeScript execution
- `@typescript-eslint/*` - TypeScript linting
- `jest` & `ts-jest` - Testing framework
- `supertest` - HTTP assertion library
- `prettier` - Code formatting
- `eslint` - Code linting

### Environment Variables

Required configuration:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Access token signing key (min 32 chars)
- `JWT_REFRESH_SECRET` - Refresh token signing key (min 32 chars)
- `JWT_ACCESS_EXPIRY` - Access token expiry (default: 15m)
- `JWT_REFRESH_EXPIRY` - Refresh token expiry (default: 7d)
- `EMAIL_HOST` - SMTP server host (e.g., smtp.gmail.com)
- `EMAIL_PORT` - SMTP server port (default: 587)
- `EMAIL_USER` - SMTP authentication username
- `EMAIL_PASS` - SMTP authentication password
- `EMAIL_FROM` - Email sender address
- `NODE_ENV` - Environment (development/production/test)
- `PORT` - Server port (default: 3000)
- `LOG_LEVEL` - Winston log level (default: info)
- `ALLOWED_ORIGINS` - Comma-separated CORS origins

### Future Integration Points

**Email Service Provider**
- Real Nodemailer implementation with SMTP support
- Configurable via environment variables (EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS)
- HTML email templates for OTP and welcome emails
- Methods: `sendOTP()`, `sendWelcomeEmail()`

**Real-time Messaging (Socket.IO)**
- Socket.IO v4 integration for real-time chat
- JWT authentication handshake
- Per-user rooms for message delivery
- Token bucket rate limiting (10 messages per 10 seconds)
- Events: `join_thread`, `send_message`, `typing`, `read_receipt`
- XSS prevention through HTML escaping
- Profanity filtering with metadata flagging

**OpenAPI Documentation**
- Authentication API: `openapi-auth.yaml`
- Profile API: `openapi-profile.yaml`
- Chat API: `openapi.chat.yml`
- Comprehensive documentation for all endpoints with examples

**Testing Documentation**
- Chat Module: `CHAT_MODULE_README.md` - Complete testing guide for REST and Socket.IO features
- Discovery/Search Module: `DISCOVERY_SEARCH_MODULE_README.md` - Testing guide for discovery features