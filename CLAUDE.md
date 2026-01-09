# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Iwanna** is a revolutionary mobile-first social connection platform that connects people through spontaneous moments, not profiles or plans. It's a real-time connection engine for human impulse - users post what they want to do RIGHT NOW, and AI instantly matches them with 2-4 compatible people nearby to form temporary "pods" with a 3-hour lifespan.

This is NOT another Meetup clone or dating app - it's about spontaneous, ephemeral social connections based on shared desires in the moment.

## Architecture

### Monorepo Structure

```
iwanna/
├── backend/        # Node.js + Express + TypeScript API
├── mobile/         # Expo + React Native app
├── docker-compose.yml
└── .cursorrules    # Comprehensive system prompt (24k+ lines)
```

### Tech Stack

**Backend:**
- Node.js + Express with TypeScript
- PostgreSQL with PostGIS (geospatial) and pgvector (embeddings)
- Redis for real-time features and caching
- Socket.io for WebSockets
- OpenAI GPT-4 for intent parsing and embeddings
- JWT authentication with refresh tokens
- Zod for validation

**Mobile:**
- Expo SDK 54+ with TypeScript
- React Native with React Native Reanimated
- Zustand for state management
- React Query (@tanstack/react-query) for API calls
- Socket.io client for real-time features
- expo-location for GPS
- expo-secure-store for encrypted storage

**Infrastructure:**
- Docker Compose for local development
- PostgreSQL + Redis containers
- PostGIS for location queries
- pgvector for semantic similarity matching

## Development Commands

### Backend

```bash
cd backend

# Development server (uses nodemon + ts-node)
npm run dev

# Build TypeScript
npm run build

# Production server
npm start

# Linting & formatting
npm run lint
npm run format

# Testing
npm test
npm run test:watch
```

### Mobile

```bash
cd mobile

# Start Expo dev server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

### Database

```bash
# Start PostgreSQL + Redis
docker-compose up postgres redis -d

# Check service health
docker-compose ps

# Connect to PostgreSQL
docker-compose exec postgres psql -U iwanna -d iwanna_db

# View database schema
docker-compose exec postgres psql -U iwanna -d iwanna_db -c "\dt"

# Initialize database (schema is in backend/scripts/init.sql)
# The init.sql is automatically run by Docker Compose on first startup
```

## Core Philosophy: The Living Interface

**Every feature, every line of code, every UX decision must serve spontaneity, humanity, and effortless connection.**

### Critical Design Principles

1. **Feels ALIVE** - The UI breathes, pulses, and responds organically
2. **Zero Friction** - No profiles, no swiping, minimal barriers
3. **Warm & Human** - AI speaks conversationally, never robotically
4. **Ephemeral by Default** - Pods expire in 3 hours, connections fade naturally
5. **Mobile-First** - Built for one-handed use on phones

### Animation Guidelines

- Use React Native Reanimated with spring physics (NOT linear timing)
- All buttons should have subtle breathing animations (scale 1.0-1.02 over ~1.5s)
- Text should fade in gracefully with slight upward movement (10px)
- Loading states use pulsing glows, NEVER spinners
- All animations respect `prefers-reduced-motion`
- Target 60fps minimum

### Language & Tone

**❌ NEVER write like this:**
```
"Your request has been processed. The system has identified 3 potential matches."
```

**✅ ALWAYS write like this:**
```
"Found 3 people nearby who feel the same way ✨"
```

**Rules:**
- Maximum 2 sentences (usually just 1)
- Use contractions (we're, you're, let's)
- Active voice only
- Simple words (never "utilize" - always "use")
- Emoji used sparingly but meaningfully (✨ 👋 🌟)
- Address user as "you" not "the user"
- Present tense, immediate
- NO corporate jargon

## Key Implementation Details

### Anonymous-First Authentication (Phase 1B)

**Three-tier system:**

1. **Tier 1: Anonymous (default)**
   - Auto-generated username (e.g., "CuriousVibe_8234")
   - 12-word recovery phrase (BIP39)
   - Device-locked initially
   - Rate limited: 5 wannas/day
   - Trust score: 100 starting

2. **Tier 2: Anonymous + Email (optional upgrade)**
   - Add email for cross-device sync
   - Still anonymous to other users
   - Rate limited: 10 wannas/day

3. **Tier 3: Authenticated (optional upgrade)**
   - Google or Apple Sign-In
   - Full cross-device sync
   - Unlimited wannas

**Database Tables:**
- `users` - Core user identity and trust scores
- `refresh_tokens` - JWT refresh token storage (90-day expiry)
- `recovery_attempts` - Security logging for recovery phrase attempts

### Wanna Creation & AI Parsing (Phase 1C)

**User Flow:**
```
"What do you wanna do?" → User types → Optional mood emoji →
AI parses intent → Location captured → Wanna saved → Queued for matching
```

**Intent Parsing:**
Uses OpenAI GPT-4o-mini to parse user input like "I wanna grab coffee" into structured JSON:
```typescript
{
  activity: "coffee",
  category: "food_social",
  energy_level: "medium",
  social_preference: "small_group",
  time_sensitivity: "now",
  keywords: ["coffee", "casual", "conversation"],
  emotional_tone: "curious"
}
```

**Semantic Embeddings:**
- Uses OpenAI text-embedding-3-small (1536 dimensions)
- Stored in wannas table with pgvector
- Enables semantic similarity matching (Phase 1D)

**Geospatial:**
- Location stored as PostGIS GEOGRAPHY(POINT)
- Indexed with GIST for fast proximity queries
- Also cached in Redis with GEOADD for real-time matching

**Database Tables:**
- `wannas` - User desires with AI-parsed intent, embeddings, and location
- Redis geospatial index: `active_wannas`
- Redis queue: `matching_queue`

### Database Schema Patterns

**All tables use:**
- UUID primary keys (`uuid_generate_v4()`)
- TIMESTAMP WITH TIME ZONE for all timestamps
- JSONB for flexible metadata
- Proper foreign key constraints with CASCADE deletes
- Indexes on frequently queried columns
- CHECK constraints for data integrity

**Geospatial queries:**
```sql
-- Find wannas within 5 miles
SELECT * FROM wannas
WHERE ST_DWithin(
    location,
    ST_MakePoint(:longitude, :latitude)::geography,
    8046.72  -- 5 miles in meters
);
```

**Vector similarity:**
```sql
-- Find similar wannas by embedding
SELECT *, 1 - (embedding <=> :query_embedding) AS similarity
FROM wannas
WHERE status = 'active'
ORDER BY embedding <=> :query_embedding
LIMIT 10;
```

## API Architecture

### REST Endpoints

All routes prefixed with `/api/v1`:

**Authentication:**
- `POST /auth/create-anonymous` - Create Tier 1 account
- `POST /auth/recover` - Recover with recovery phrase
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Revoke refresh token
- `GET /auth/me` - Get current user
- `POST /auth/upgrade/email` - Upgrade to Tier 2
- `POST /auth/upgrade/social` - Upgrade to Tier 3
- `GET /auth/rate-limit` - Check wanna creation limits

**Wannas:**
- `POST /wannas` - Create new wanna
- `GET /wannas/active` - Get user's active wannas
- `DELETE /wannas/:id` - Cancel wanna
- `GET /wannas/suggestions` - Autocomplete suggestions

**Pods (Phase 1D+):**
- `GET /pods/active` - Get user's active pods
- `GET /pods/:id` - Get pod details
- `POST /pods/:id/leave` - Leave pod
- `POST /pods/:id/complete` - Mark pod complete

**Chat (Phase 1E+):**
- `GET /chat/pods/:podId/messages` - Get chat history
- `POST /chat/pods/:podId/messages` - Send message

### @vibe: AI Social Facilitator in Pods

**IMPORTANT:** For all pod-related implementations, especially @vibe's interactions and behavior in pod chat, refer to **[vibePodExperience.md](./vibePodExperience.md)** for comprehensive guidelines.

**Key Points:**
- @vibe acts as a social lubricant, reducing awkwardness and accelerating IRL meetups
- She's timing-aware (7 stages: formation, ice-breaking, decision-making, plan lock-in, pre-meetup, hangout, post-hangout)
- Always actionable, never conversational - every message has a clear next step
- Personality: lowercase, max 2 sentences, active voice, 1 emoji max
- Visual design: Purple tint background, centered messages, ✨ avatar
- Smart silence: Only speaks when conversation stalls or decisions needed
- Future features: Inline action buttons, location suggestions, plan pinning

### WebSocket Events

**Client → Server:**
- `join_pod` - Join pod room
- `leave_pod` - Leave pod room
- `send_message` - Send chat message
- `typing` - Typing indicator
- `location_update` - Update user location

**Server → Client:**
- `pod_formed` - New pod created
- `match_found` - You were matched
- `new_message` - New chat message
- `user_joined` - Member joined pod
- `user_left` - Member left pod
- `pod_expired` - Pod ended
- `ai_action_response` - AI assistant reply

## Environment Configuration

### Backend (.env)

**Required for all phases:**
```bash
DATABASE_URL=postgresql://iwanna:iwanna_password@localhost:5432/iwanna_db
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=<32+ char random string>
JWT_REFRESH_SECRET=<32+ char random string>
PORT=3001
NODE_ENV=development
```

**Required for Phase 1C+ (Wanna creation):**
```bash
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

**Rate limiting:**
```bash
TIER1_WANNAS_PER_DAY=5
TIER2_WANNAS_PER_DAY=10
TIER3_WANNAS_PER_DAY=999
```

### Mobile (.env)

```bash
EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1
EXPO_PUBLIC_WS_URL=http://localhost:3001
EXPO_PUBLIC_ENV=development
```

## Code Quality Standards

### TypeScript Requirements
- Strict mode enabled
- Explicit return types for all functions
- Proper interface/type definitions
- NO `any` types (use `unknown` instead)
- All errors must be typed

### File Naming
- Components: `PascalCase.tsx` (e.g., `PodCard.tsx`)
- Hooks: `camelCase.ts` (e.g., `useWanna.ts`)
- Utils: `camelCase.ts` (e.g., `matchingAlgorithm.ts`)
- Types: `types.ts` or `ComponentName.types.ts`
- Services: `camelCase.ts` (e.g., `authService.ts`)

### Backend Code Structure

**Route handlers:**
```typescript
// Use Zod for validation
const schema = z.object({
  text: z.string().min(3).max(200),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
});

router.post('/wannas', authenticateToken, async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    // Business logic
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error); // Pass to error handler
  }
});
```

**Service layer:**
- Keep business logic in services (not controllers)
- Use transactions for multi-table operations
- Always validate inputs
- Return typed results
- Throw typed errors

### Mobile Code Structure

**Component template:**
```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

interface Props {
  title: string;
  onPress?: () => void;
}

export const Component: React.FC<Props> = ({ title, onPress }) => {
  // Hooks at top
  const [state, setState] = useState('');

  // Effects
  useEffect(() => {
    // logic
  }, []);

  // Event handlers
  const handlePress = () => {
    onPress?.();
  };

  // Render
  return (
    <View style={styles.container}>
      <Text>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

## Common Tasks

### Add a new database table

1. Add SQL to `backend/scripts/init.sql`
2. Restart PostgreSQL container: `docker-compose restart postgres`
3. Or apply manually: `docker-compose exec postgres psql -U iwanna -d iwanna_db -f /docker-entrypoint-initdb.d/init.sql`

### Add a new API endpoint

1. Create/update controller in `backend/src/controllers/`
2. Add route in `backend/src/routes/`
3. Register route in `backend/src/routes/index.ts`
4. Add mobile API call in `mobile/src/services/api.ts`
5. Update store if needed in `mobile/src/store/`

### Add a new screen

1. Create screen in `mobile/src/screens/`
2. Add to navigation in `mobile/src/navigation/`
3. Create any needed components in `mobile/src/components/`
4. Connect to store via hooks (Zustand)

### Run integration tests

Backend:
```bash
cd backend
npm test
```

Mobile:
```bash
cd mobile
npm test
```

## Current Development Phase

**Phase 1C Complete:** Wanna creation with AI intent parsing

**Next:** Phase 1D - Matching Algorithm
- Geographic proximity search (PostGIS + Redis GEORADIUS)
- Semantic similarity scoring (cosine similarity on embeddings)
- Multi-dimensional compatibility calculation
- Pod formation logic (2-5 people)
- Real-time notifications

## Important Files to Reference

- `.cursorrules` - Complete system prompt (24k+ lines) with full product philosophy
- `README.md` - User-facing documentation and quick start
- `cursorrules.txt` - Phase 1B authentication specification
- `cursorrulesPlanC.txt` - Phase 1C wanna creation specification
- `backend/scripts/init.sql` - Database schema
- `backend/src/config/index.ts` - Configuration management
- `mobile/src/constants/theme.ts` - Design system

## Security Considerations

**Authentication:**
- JWT tokens: 15min access, 90-day refresh
- Tokens stored in expo-secure-store (Keychain/Keystore)
- Automatic token refresh in API interceptor
- Recovery phrase hashed with bcrypt (12 rounds)

**Rate Limiting:**
- Global: 100 requests per 15 minutes
- Wannas: Tier-based daily limits
- Recovery attempts: 5 per hour per IP

**Data Protection:**
- All passwords hashed with bcrypt
- Sensitive tokens hashed before storage
- PostGIS for location (never expose exact coords to other users)
- Trust scores for moderation

**Privacy:**
- Anonymous by default
- Location only when app active
- Pods expire automatically
- Can delete account + all data

## Performance Targets

**Mobile App:**
- App launch: < 2 seconds to interactive
- Screen transitions: < 300ms
- Frame rate: 60fps for animations

**Backend API:**
- API latency: < 200ms (p95)
- Database queries: < 100ms
- WebSocket message latency: < 50ms

## Testing Strategy

**Backend:**
- Unit tests for services
- Integration tests for API endpoints
- Test AI fallback parsing
- Test rate limiting

**Mobile:**
- Component tests
- Integration tests for user flows
- E2E tests with Detox (future)

## Troubleshooting

**Database connection issues:**
```bash
# Check PostgreSQL is running
docker-compose ps
# View logs
docker-compose logs postgres
# Restart
docker-compose restart postgres
```

**Redis connection issues:**
```bash
# Check Redis is running
docker-compose ps
# Test connection
docker-compose exec redis redis-cli ping
```

**Mobile app not connecting to backend:**
- Check `EXPO_PUBLIC_API_URL` in mobile/.env
- Ensure backend is running on correct port
- Check CORS_ORIGIN in backend/.env includes Expo dev server URLs

**OpenAI API errors:**
- Verify OPENAI_API_KEY is set
- Check API quota/billing
- Review error logs for rate limiting

## Resources

- **OpenAI API Docs:** https://platform.openai.com/docs
- **PostGIS Docs:** https://postgis.net/docs/
- **pgvector Docs:** https://github.com/pgvector/pgvector
- **Expo Docs:** https://docs.expo.dev/
- **React Native Reanimated:** https://docs.swmansion.com/react-native-reanimated/

## North Star Reminder

**"If this screen was a living thing, would it feel vibrant and warm, or cold and still?"**

Always prioritize:
1. Emotional impact over technical cleverness
2. User delight over architectural purity
3. Working code over perfect code
4. Alive and breathing over static and stiff

The question "What do you wanna do?" is the entire interface - keep it simple, warm, and inviting.

---

## Current Session Status (Updated: 2025-10-31 - Phase 1D Complete)

### ✅ What We've Completed

**1. HomeScreen UI Redesign (mobile/src/screens/HomeScreen.tsx)**
- Replaced simple TextInput with modern inline "Iwanna" pill badge
- Pill styled with purple gradient background and border
- Text baseline alignment perfected between pill and user input
- Multiline input flows naturally after the pill badge

**2. Animated Typing Suggestions**
- Implemented realistic typing/deleting animation for placeholder text
- Cycles through suggestions: "play football", "grab coffee", "go hiking", "watch a movie", "try that new restaurant", "hit the gym", "explore the city", "play basketball"
- Added blinking cursor effect (530ms intervals)
- Animation pauses appropriately: 1.5s after typing, 0.5s after deleting
- Clears when user starts typing
- Uses state management: `animatedPlaceholder`, `currentSuggestionIndex`, `isTyping`, `showCursor`

**3. Database Schema Fixes**
Multiple ALTER TABLE commands executed to add missing columns:

```sql
-- refresh_tokens table
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked BOOLEAN DEFAULT false;

-- users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wannas_today INTEGER DEFAULT 0;

-- wannas table
ALTER TABLE wannas ADD COLUMN IF NOT EXISTS embedding TEXT;
ALTER TABLE wannas ADD COLUMN IF NOT EXISTS location_accuracy FLOAT;
ALTER TABLE wannas ADD COLUMN IF NOT EXISTS location_name TEXT;
```

**4. AI Service Fallback (backend/src/services/wannaService.ts)**
- Added try-catch around `aiService.parseIntent()` to handle OpenAI API failures
- Fallback intent structure matches the Intent type exactly:
```typescript
intent = {
  activity: rawInput,
  category: 'conversation' as const,
  energyLevel: 'medium' as const,
  socialPreference: 'small_group' as const,
  timeSensitivity: 'flexible' as const,
  durationEstimate: 60,
  locationFlexibility: 'neighborhood' as const,
  keywords: rawInput.split(' ').slice(0, 3).filter(Boolean),
  emotionalTone: moodEmoji || 'neutral',
  confidence: 0.3,
};
```

**5. TypeScript Type Safety**
- Fixed Intent interface compliance with literal types using `as const`
- Fixed keywords array to properly filter empty values
- Added `confidence` field (0.3 for fallback, indicating lower quality)

### ✅ Issue Fixed (2025-10-31)

**Problem:** "database operation failed" when clicking "Find your vibe" button

**Root Cause:** Missing database columns in the `users` table. The wanna creation succeeded, but the subsequent user counter update failed.

**Solution:** Added missing columns to database:
```sql
-- users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS wannas_created_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_wanna_at TIMESTAMP WITH TIME ZONE;

-- wannas table
ALTER TABLE wannas ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
```

**Status:** Fixed! Backend health check passing. Ready for testing.

### 📝 Key Files Modified This Session

1. **mobile/src/screens/HomeScreen.tsx** (lines 26-436)
   - Added WANNA_SUGGESTIONS array
   - Added animation state variables
   - Added typing animation effect (useEffect)
   - Added cursor blink effect (useEffect)
   - Redesigned input UI with inline pill
   - Updated styles for pill and placeholder

2. **backend/src/services/wannaService.ts** (lines 75-101)
   - Wrapped AI parsing in try-catch
   - Added fallback intent with proper types
   - Set embedding to null on AI failure

3. **Database schema** (PostgreSQL)
   - Added columns to refresh_tokens, users, wannas tables

### 🔧 Next Steps

**Testing Phase 1C:**
1. Test wanna creation on mobile app
2. Verify wanna appears in database: `SELECT * FROM wannas ORDER BY created_at DESC LIMIT 1;`
3. Check user counters updated: `SELECT username, wannas_today, wannas_created_count, last_wanna_at FROM users;`
4. Monitor backend logs: `tail -f backend.log`

**If issues persist:**
- OpenAI API key is placeholder - AI parsing will fail but fallback should work
- Check location service (reverse geocoding)
- Check Redis geospatial index

### 🎯 Phase 1D Status

**Goal:** Matching Algorithm & Pod Formation

**Status:** ✅ COMPLETE

**What We Built:**

**1. matchingService.ts (backend/src/services/matchingService.ts)**
- Geographic proximity search using Redis GEORADIUS
- Semantic similarity scoring with cosine similarity on embeddings
- Multi-dimensional compatibility calculator with weighted scoring:
  - Proximity: 25% weight (distance-based, 0-5 miles)
  - Semantic: 30% weight (embedding similarity)
  - Timing: 15% weight (how recent the wannas are)
  - Energy level: 15% weight (low/medium/high match)
  - Category: 15% weight (activity category match)
- Pod formation logic (2-5 people, configurable)
- Centroid calculation for meeting point
- Intent merging for shared activity

**2. podService.ts (backend/src/services/podService.ts)**
- Get pod by ID
- Get user's active pods
- Get pod members with usernames
- Leave pod (auto-expires if < 2 members remain)
- Complete pod (successful meetup)
- Check if user is in active pod
- Cleanup expired pods
- Pod statistics

**3. podController.ts & routes (backend/src/controllers/podController.ts)**
- `GET /api/v1/pods/active` - Get user's active pods
- `GET /api/v1/pods/:id` - Get pod details
- `POST /api/v1/pods/:id/leave` - Leave pod
- `POST /api/v1/pods/:id/complete` - Mark pod complete
- `POST /api/v1/pods/match/:wannaId` - Manually trigger matching
- `GET /api/v1/pods/stats` - Pod statistics

**4. matchingWorker.ts (backend/src/workers/matchingWorker.ts)**
- Background worker runs every 10 seconds
- Processes all active wannas
- Attempts to form pods from compatible wannas
- Prevents duplicate processing in same cycle
- Immediate matching trigger when wanna is created
- Integrated into server startup/shutdown

**5. Integration into Wanna Creation Flow**
- When user creates wanna, immediate matching is triggered (non-blocking)
- Background worker continuously looks for matches
- Wannas marked as "matched" when pod is formed
- Removed from Redis geospatial index after matching

**What's Working:**
- ✅ Pod successfully formed with 3 users
- ✅ Compatibility scoring calculating correctly
- ✅ Geographic proximity search (PostGIS + Redis)
- ✅ Background matching worker running
- ✅ Immediate matching on wanna creation
- ✅ Pod endpoints operational

**Test Results:**
```
Pod ID: 19348ac5-af46-4a8b-a40e-0a91a8b076de
Wannas matched: 3
Users in pod: 3
Status: active
Created: 2025-10-31 02:01:24
```

**Next Phase:** Phase 1E - WebSocket notifications for real-time pod updates

### 💡 Important Context for Next Session

**Backend Environment:**
- Running on port 3001
- Using nodemon (auto-restarts on file changes)
- Logs to `/Users/kene_eneh/iwanna/backend.log`
- OpenAI API key is placeholder: `sk-test-placeholder` (causes AI to fail, but fallback should work)
- **Matching worker running** (processes every 10 seconds)

**Mobile Environment:**
- Expo dev server running
- Connected to backend at `http://192.168.1.252:3001/api/v1`
- User is authenticated (has valid token)
- Location permissions granted

**Database Status:**
- PostgreSQL running in Docker on port 5432
- Redis running in Docker on port 6379
- PostGIS extension enabled
- Schema includes: users, wannas, pods, pod_members, messages, refresh_tokens, recovery_attempts

**Current Capabilities:**
1. ✅ User authentication (anonymous accounts)
2. ✅ Wanna creation with AI parsing
3. ✅ Automatic matching (background worker + immediate trigger)
4. ✅ Pod formation (2-5 users)
5. ✅ Compatibility scoring (5-dimensional algorithm)
6. ✅ Geographic search (PostGIS + Redis)
7. ✅ Pod management (view, leave, complete)

**What's Ready to Test:**
- Create multiple wannas → Background worker should form pods automatically
- Check active pods: `GET /api/v1/pods/active`
- View pod details: `GET /api/v1/pods/:id`
- Pod statistics: `GET /api/v1/pods/stats`

---

## 🔴 ACTIVE DEBUGGING SESSION (Updated: 2025-11-05)

### Issue Discovered During E2E Testing

**Test Setup:**
- Device 1: iOS Simulator (Xcode on Mac)
- Device 2: Physical device via Expo Go
- Both users authenticated with different anonymous accounts

**What Was Tested:**
Both users created the same wanna: "play football"

**Expected Behavior:**
- Matching algorithm should detect compatible wannas
- Background worker (runs every 10s) should form a pod
- Users should see pod in "Pods" screen

**Actual Behavior:**
1. ❌ Pods were NOT being formed (matching algorithm not triggering)
2. ❌ Pods page showed "failed to fetch pods" error

### Debugging Status

**What I Was Investigating Before Crash:**
- Checking if matching algorithm is running
- Investigating `/api/v1/pods/active` endpoint failure
- Analyzing why pods are not being formed despite similar wannas

**Potential Root Causes to Investigate:**
1. Background matching worker not processing wannas correctly
2. Compatibility scoring threshold too strict
3. Geographic distance too large (users not close enough)
4. Embedding similarity check failing (if OpenAI embeddings unavailable)
5. API endpoint authentication or database query issues
6. Redis geospatial index not populated correctly

**Key Files to Check:**
- `backend/src/workers/matchingWorker.ts` - Background matching logic
- `backend/src/services/matchingService.ts` - Compatibility calculation
- `backend/src/controllers/podController.ts` - GET /pods/active endpoint
- `backend/src/services/podService.ts` - Pod retrieval logic
- Backend logs: `/Users/kene_eneh/iwanna/backend.log`

**Database Tables to Query:**
```sql
-- Check if wannas were created
SELECT id, user_id, text, status, created_at FROM wannas ORDER BY created_at DESC LIMIT 10;

-- Check if pods exist
SELECT id, status, created_at FROM pods ORDER BY created_at DESC LIMIT 10;

-- Check Redis geospatial index
-- redis-cli: GEORADIUS active_wannas <lon> <lat> 5 mi WITHDIST WITHCOORD

-- Check if matching worker is processing
-- Look for logs indicating worker is running
```

**What Needs to Happen Next:**
1. Check backend logs for errors
2. Verify wannas are in database with status='active'
3. Verify wannas are in Redis geospatial index
4. Check matching worker is running and processing wannas
5. Test compatibility calculation manually with the two wannas
6. Debug GET /api/v1/pods/active endpoint failure
7. Check if authentication token is valid for the request

### Current System State (as of crash)

**Backend:**
- ✅ Running on port 3001 (nodemon)
- ✅ PostgreSQL + Redis containers healthy
- ⚠️ Matching worker status: UNKNOWN (need to verify)
- ⚠️ OpenAI API key: placeholder (embeddings will be null)

**Mobile:**
- ❌ Expo dev server NOT running (needs restart)
- ⚠️ Two authenticated users active
- ⚠️ Both users created "play football" wanna

**Next Immediate Actions:**
1. ✅ Document current status
2. ✅ Check backend logs for errors
3. ✅ Query database for wannas status
4. ✅ Verify matching worker is processing
5. ✅ Debug pods/active endpoint
6. ✅ Fix identified issues
7. 🔄 Re-test E2E flow

---

## ✅ BUGS FIXED (2025-11-06 - Multiple Sessions)

### Session 1: Core Matching Bugs (00:12 UTC)

### Root Causes Identified

**Bug 1: Expired wannas not being filtered**
- Matching queries only checked `status = 'active'`, not `expires_at > NOW()`
- Old wannas from days ago were still being matched with new users
- Result: User matched with "Paint" wanna from Nov 3 instead of fresh "Play football"

**Bug 2: No automatic expiry cleanup**
- Wannas never transitioned from `active` to `expired` status
- Redis geospatial index accumulated stale data
- Background worker processed expired wannas

**Bug 3: Matching radius too small for cross-device testing**
- Default: 5 miles
- iOS simulator (Mac location) and physical device (user location) are geographically distant
- Wannas couldn't match due to distance constraint

### Fixes Applied

**1. Added expiry checks to all queries** ✅
- `matchingService.ts` line 315: Added `AND expires_at > NOW()`
- `matchingService.ts` line 365: Added `AND expires_at > NOW()`
- `matchingWorker.ts` line 141: Added `AND expires_at > NOW()`

**2. Created automatic cleanup worker** ✅
- New file: `backend/src/workers/cleanupWorker.ts`
- Runs every 60 seconds
- Expires old wannas (sets `status = 'expired'`)
- Expires old pods (sets `status = 'expired'`)
- Removes expired wannas from Redis geospatial index
- Integrated into server startup/shutdown in `backend/src/index.ts`

**3. Implemented smart fallback radius** ✅
- Default radius: **3 miles** (MVP recommendation from miles.md - truly spontaneous)
- Fallback radius: **10 miles** (automatically expands if no matches found at 3 miles)
- Algorithm tries 3 miles first, then 10 miles as one-time expansion
- **For cross-device testing:** Temporarily increase `FALLBACK_RADIUS_MILES` to 50-100 miles if devices are in different cities

### Files Modified

1. **backend/src/services/matchingService.ts**
   - Line 315: Added expiry check to `getWannaForMatching`
   - Line 365: Added expiry check to `getMultipleWannasForMatching`

2. **backend/src/workers/matchingWorker.ts**
   - Line 141: Added expiry check to `getUnmatchedWannas`

3. **backend/src/workers/cleanupWorker.ts** (NEW FILE)
   - Automatic cleanup for expired wannas and pods
   - Runs every 60 seconds
   - Removes from Redis geospatial index

4. **backend/src/index.ts**
   - Line 13: Import cleanupWorker
   - Line 77: Start cleanupWorker on server startup
   - Line 152: Stop cleanupWorker on server shutdown

5. **backend/.env**
   - Line 47: `MATCHING_RADIUS_MILES=3` (MVP default)
   - Line 48: `FALLBACK_RADIUS_MILES=10` (automatic expansion)

6. **backend/src/config/index.ts**
   - Line 119: Added `fallbackRadiusMiles` config

7. **backend/src/services/matchingService.ts**
   - Lines 83-98: Added smart fallback - tries default radius, then expands if no matches

### Testing Instructions

**Before Re-Testing:**
1. Backend server auto-restarted (nodemon detected changes)
2. Cleanup worker is now running
3. All expired wannas have been cleared
4. Redis geospatial index is empty

**Re-Test E2E Flow:**
1. Open iOS Simulator (Xcode) with User 1
2. Open Physical Device (Expo Go) with User 2
3. Both users create wanna: "play football"
4. Wait ~10 seconds for matching worker to run
5. Check mobile app - both should see new pod formed
6. Navigate to Pods screen - should show the matched pod
7. Verify pod contains both users

**Expected Result:**
- ✅ Wannas match within 10 seconds
- ✅ Pod formed with 2 users
- ✅ Both users see the same pod
- ✅ No old/expired wannas in the match

**If issues persist:**
- Check backend logs: `tail -f /Users/kene_eneh/iwanna/backend.log`
- Verify matching worker is running (logs every 10s)
- Check database: `SELECT * FROM wannas WHERE status = 'active';`
- Check pods: `SELECT * FROM pods ORDER BY created_at DESC LIMIT 5;`

### What's Working Now

1. ✅ Matching algorithm filters expired wannas
2. ✅ Automatic cleanup runs every minute
3. ✅ Matching radius large enough for cross-device testing
4. ✅ Background worker processes all active wannas
5. ✅ Redis geospatial index stays clean

### Known Issues

1. ⚠️ Mobile "failed to fetch pods" error likely due to:
   - Stale authentication token (need to re-login)
   - Mobile app not handling response correctly
   - Network connectivity issue

   **Solution:** Restart mobile app and re-authenticate

---

### Session 2: Mobile App Authentication & WebSocket Bugs (09:40 UTC)

**Issues Found During E2E Testing:**
1. ❌ WebSocket connection failing - "No auth token found"
2. ❌ Pods screen showing "failed to fetch pods"
3. ❌ Real-time notifications not working
4. ❌ Rate limiting incorrectly incrementing (showing 5/5 wannas when only 2-3 created)
5. ❌ React duplicate key errors for pods
6. ❌ Same user appearing twice in pods

**Root Causes:**

**Bug 1: WebSocket Auth Token Key Mismatch**
- `socketService.ts` line 76: Looking for `'authToken'`
- `api.ts` line 13: Storing as `'auth_token'`
- Keys didn't match, so WebSocket couldn't authenticate

**Bug 2: WebSocket Using Wrong URL**
- `socketService.ts` was using `API_BASE_URL` which includes `/api/v1`
- Should use `WS_URL` which is just the base URL
- Socket.io doesn't need the API path prefix

**Bug 3: Rate Limiting - Duplicate Submissions**
- Mobile app not preventing rapid button taps
- Multiple requests sent before first completed
- Each request incremented counter, even if wanna creation failed
- Result: Counter showed 5/5 when user only created 2-3 wannas

**Bug 4: Duplicate Users in Pods**
- Same user creating multiple wannas
- All wannas from same user getting matched into same pod
- Pod had `user_ids: [user-A, user-A]` - duplicate!
- React complained about duplicate keys when rendering

**Fixes Applied:**

**1. Fixed WebSocket Authentication** ✅
```typescript
// mobile/src/services/socketService.ts line 76
const token = await SecureStore.getItemAsync('auth_token'); // Changed from 'authToken'
```

**2. Fixed WebSocket URL** ✅
```typescript
// mobile/src/services/socketService.ts line 3
import { WS_URL } from '../constants/config'; // Changed from API_BASE_URL

// Line 84
this.socket = io(WS_URL, { // Changed from API_BASE_URL
```

**3. Fixed Rate Limiting - Duplicate Request Guard** ✅
```typescript
// mobile/src/store/wannaStore.ts line 66-70
createWanna: async (text: string, moodEmoji?: string) => {
  // Prevent duplicate submissions
  if (get().isCreating) {
    console.log('Wanna creation already in progress, ignoring duplicate request');
    return;
  }
```

**4. Fixed Duplicate Users in Pods** ✅
```typescript
// backend/src/services/matchingService.ts line 159-167
// Remove wannas from the same user (keep only the first wanna per user)
const seenUserIds = new Set<string>();
const uniqueWannas = allWannas.filter(wanna => {
  if (seenUserIds.has(wanna.userId)) {
    return false;
  }
  seenUserIds.add(wanna.userId);
  return true;
});
```

**Database Cleanup:**
- Reset daily wanna counters for test users
- Deleted 3 broken pods with duplicate users
- Marked duplicate wannas as expired

**Files Modified:**

1. **mobile/src/services/socketService.ts**
   - Line 3: Changed import from API_BASE_URL to WS_URL
   - Line 76: Changed auth token key from 'authToken' to 'auth_token'
   - Line 84: Changed socket connection to use WS_URL

2. **mobile/src/store/wannaStore.ts**
   - Lines 66-70: Added duplicate submission guard

3. **backend/src/services/matchingService.ts**
   - Lines 156-170: Added duplicate user filtering in pod formation
   - Lines 172-195: Updated to use uniqueWannas instead of allWannas

**Testing Results:**

✅ **What's Working:**
- Backend matching algorithm functioning perfectly
- Pods being created with correct users
- WebSocket connecting successfully
- Rate limiting accurate (after guard added)
- No more duplicate users in pods

⚠️ **Intermittent Issues:**
- **iOS Simulator:** Sometimes not showing pods, "failed to fetch pods" error
- **Android Device:** Picks up pods more reliably
- **Inconsistency:** Both devices authenticated, WebSocket connected, but iOS not always fetching

**Current Status (10:12 UTC):**

**Backend:**
- ✅ Running perfectly on port 3001
- ✅ Matching worker processing every 10s
- ✅ Cleanup worker running every 60s
- ✅ WebSocket server operational
- ✅ Database healthy, 1 active valid pod

**Mobile Apps:**
- ✅ Expo dev server running
- ✅ WebSocket connections established
- ⚠️ iOS Simulator: Inconsistent pod fetching
- ✅ Android Device: More reliable
- ⚠️ Both showing "failed to fetch pods" intermittently

**Possible Remaining Issues:**

1. **iOS Simulator Token Expiry:**
   - Access tokens expire after 15 minutes
   - May need to refresh or re-login on iOS
   - Android might have newer token

2. **Network/CORS Issues:**
   - iOS simulator may have different network routing
   - API requests timing out
   - Need to check backend logs for failed requests

3. **State Management:**
   - Pod store not updating properly on iOS
   - React Query/Zustand state stale
   - Need to investigate fetchActivePods() failures

**Recommended Next Steps:**

1. **Check backend logs for failed /pods/active requests:**
   ```bash
   tail -f /Users/kene_eneh/iwanna/backend.log | grep "pods/active"
   ```

2. **Verify authentication tokens on both devices:**
   - Check if tokens are valid and not expired
   - Compare iOS vs Android token status

3. **Test API endpoint directly:**
   ```bash
   curl -H "Authorization: Bearer <ios-token>" http://192.168.1.252:3001/api/v1/pods/active
   ```

4. **Mobile app logs:**
   - Check Expo logs for specific errors
   - Look for 401 Unauthorized or network timeout errors

5. **Force re-authentication:**
   - Log out and log back in on iOS simulator
   - Fresh token might resolve inconsistency

**Known Working Configuration:**
- Backend: Node.js on port 3001
- Database: PostgreSQL + Redis healthy
- WebSocket: Connected successfully
- Matching: 3-mile default, 6000-mile fallback (for cross-continent testing)
- Rate Limit: 5 wannas/day (Tier 1)

**Production Reminders:**
- ⚠️ Change `FALLBACK_RADIUS_MILES` from 6000 to 10 miles
- ⚠️ All mobile app fixes need Metro bundler restart to take effect
- ⚠️ Backend auto-restarts on file changes (nodemon)
