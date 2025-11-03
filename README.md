# Iwanna - Real-Time Social Connection Platform

> **Connect through moments of impulse, curiosity, and shared energy — not rigid plans.**

Iwanna is a revolutionary mobile-first social connection platform that matches people in real-time based on spontaneous desires. Users post what they feel like doing RIGHT NOW ("I wanna grab coffee", "I wanna brainstorm ideas"), and AI instantly matches them with 2-4 compatible people nearby to form temporary "pods" with a 3-hour lifespan.

## 🌟 What Makes Iwanna Different

- **Spontaneous Connection**: No profiles, no swiping, no permanent connections unless both choose
- **Real-Time Matching**: AI instantly finds compatible people within 0.5-5 miles
- **Living Interface**: Every UI element breathes, pulses, and responds with organic motion
- **Warm AI**: Conversational AI that sounds like a friend, never robotic
- **Temporary Pods**: 3-hour group experiences that naturally expire
- **Vibe Summaries**: AI-generated reflections on connections made

## 🏗️ Architecture

### Tech Stack

**Mobile App (Primary)**
- Expo SDK 50+ with TypeScript
- React Native with React Navigation
- Zustand for state management
- React Query for API calls
- Socket.io for real-time features
- React Native Reanimated for spring physics animations

**Backend API**
- Node.js + Express with TypeScript
- PostgreSQL with PostGIS for geospatial queries
- Redis for real-time features and caching
- Socket.io for WebSocket connections
- JWT for authentication
- Zod for input validation

**Infrastructure**
- Docker Compose for local development
- PostgreSQL + Redis containers
- Health checks and graceful shutdowns

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- Docker and Docker Compose
- iOS Simulator (for iOS development) or Android Studio (for Android development)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd iwanna
```

### 2. Environment Configuration

Copy environment files and configure:

```bash
# Backend environment
cp backend/env.example backend/.env

# Mobile environment  
cp mobile/env.example mobile/.env
```

Edit the `.env` files with your configuration (see [Environment Variables](#environment-variables) section).

### 3. Start Services

```bash
# Start database and Redis
docker-compose up postgres redis -d

# Wait for services to be healthy
docker-compose ps
```

### 4. Setup Database

```bash
# The database schema is automatically created via init.sql
# You can verify by connecting to the database:
docker-compose exec postgres psql -U iwanna -d iwanna_db -c "\dt"
```

### 5. Start Backend API

```bash
cd backend
npm install
npm run dev
```

The API will be available at `http://localhost:3001`

### 6. Start Mobile App

```bash
cd mobile
npm install
npm start
```

Follow the Expo CLI instructions to open the app on your device or simulator.

## 📱 Mobile App Development

### Project Structure

```
mobile/
├── src/
│   ├── screens/          # Screen components
│   ├── components/       # Reusable UI components
│   ├── navigation/       # Navigation configuration
│   ├── hooks/            # Custom hooks
│   ├── services/         # API calls, Socket.io
│   ├── store/            # Zustand state management
│   ├── utils/            # Helper functions
│   ├── types/            # TypeScript types
│   ├── constants/        # App constants (theme, etc.)
│   └── assets/           # Images, fonts
├── App.tsx               # Main app component
└── package.json
```

### Key Features

- **Living Interface**: Breathing animations, spring physics, organic motion
- **Warm AI Text**: Conversational, human-like responses
- **Real-Time Chat**: WebSocket-powered instant messaging
- **Location Services**: GPS-based matching within 0.5-5 miles
- **Push Notifications**: Match found, new messages, pod updates

### Development Commands

```bash
# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web

# Lint code
npm run lint

# Format code
npm run format
```

## 🔧 Backend API Development

### Project Structure

```
backend/
├── src/
│   ├── routes/           # Express routes
│   ├── controllers/      # Request handlers
│   ├── services/         # Business logic
│   ├── models/           # Database models
│   ├── middleware/       # Express middleware
│   ├── utils/            # Helper functions
│   ├── config/           # Configuration
│   ├── types/            # TypeScript types
│   └── jobs/             # Background jobs
├── scripts/              # Database scripts
└── package.json
```

### API Endpoints

#### Authentication
- `POST /api/v1/auth/send-code` - Send SMS verification code
- `POST /api/v1/auth/verify-code` - Verify code and login
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/refresh` - Refresh tokens
- `POST /api/v1/auth/logout` - Logout

#### Wannas
- `POST /api/v1/wannas` - Create new wanna
- `GET /api/v1/wannas/active` - Get user's active wannas
- `DELETE /api/v1/wannas/:id` - Cancel wanna

#### Pods
- `GET /api/v1/pods/active` - Get user's active pods
- `GET /api/v1/pods/:id` - Get pod details
- `POST /api/v1/pods/:id/leave` - Leave pod
- `POST /api/v1/pods/:id/complete` - Mark pod as complete

#### Chat
- `GET /api/v1/chat/pods/:podId/messages` - Get chat history
- `POST /api/v1/chat/pods/:podId/messages` - Send message

#### Summaries
- `GET /api/v1/summaries` - Get user's vibe summaries
- `GET /api/v1/summaries/:id` - Get specific summary

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Format code
npm run format

# Run tests
npm test
```

## 🗄️ Database Schema

### Core Tables

#### users
- `id` (UUID, Primary Key)
- `phone_number` (VARCHAR, Unique)
- `name` (VARCHAR)
- `created_at` (TIMESTAMP)
- `last_active` (TIMESTAMP)
- `preferences` (JSONB)
- `status` (ENUM: active, suspended, deleted)

#### wannas
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `raw_input` (TEXT)
- `intent` (JSONB)
- `embedding` (VECTOR(1536))
- `location` (GEOGRAPHY(POINT))
- `mood_tag` (VARCHAR)
- `status` (ENUM: active, matched, expired)
- `created_at` (TIMESTAMP)
- `expires_at` (TIMESTAMP)

#### pods
- `id` (UUID, Primary Key)
- `status` (ENUM: forming, active, completed, expired)
- `vibe_summary` (TEXT)
- `collective_intent` (JSONB)
- `centroid_location` (GEOGRAPHY(POINT))
- `suggested_venues` (JSONB)
- `created_at` (TIMESTAMP)
- `expires_at` (TIMESTAMP)
- `completed_at` (TIMESTAMP)

#### pod_members
- `id` (UUID, Primary Key)
- `pod_id` (UUID, Foreign Key)
- `user_id` (UUID, Foreign Key)
- `wanna_id` (UUID, Foreign Key)
- `joined_at` (TIMESTAMP)
- `status` (ENUM: active, left, removed)
- `marked_complete` (BOOLEAN)

#### chat_messages
- `id` (UUID, Primary Key)
- `pod_id` (UUID, Foreign Key)
- `user_id` (UUID, Foreign Key)
- `content` (TEXT)
- `message_type` (ENUM: user, system, ai)
- `metadata` (JSONB)
- `created_at` (TIMESTAMP)

#### vibe_summaries
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `pod_id` (UUID, Foreign Key)
- `summary_text` (TEXT)
- `connections_made` (INTEGER)
- `generated_at` (TIMESTAMP)

### Geospatial Features

- PostGIS extension for location-based queries
- Spatial indexes for performance
- Functions for finding nearby wannas
- Distance calculations in miles

## 🔧 Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://iwanna:iwanna_password@localhost:5432/iwanna_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iwanna_db
DB_USER=iwanna
DB_PASSWORD=iwanna_password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development
API_VERSION=v1

# CORS
CORS_ORIGIN=http://localhost:8081,http://localhost:19006

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# AI Services
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=your-session-secret-change-this
```

### Mobile (.env)

```bash
# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1
EXPO_PUBLIC_WS_URL=http://localhost:3001

# Environment
EXPO_PUBLIC_ENV=development

# App Configuration
EXPO_PUBLIC_APP_NAME=Iwanna
EXPO_PUBLIC_APP_VERSION=1.0.0

# Feature Flags
EXPO_PUBLIC_ENABLE_ANALYTICS=false
EXPO_PUBLIC_ENABLE_CRASH_REPORTING=false
```

## 🧪 Testing

### Backend Testing

```bash
cd backend
npm test
npm run test:watch
```

### Mobile Testing

```bash
cd mobile
npm test
```

## 🚀 Deployment

### Production Build

```bash
# Backend
cd backend
npm run build
npm start

# Mobile
cd mobile
npm run build
```

### Docker Production

```bash
# Build and run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Monitoring and Logging

- **Health Checks**: `/health` endpoint for service monitoring
- **Request Logging**: Morgan middleware with structured logging
- **Error Tracking**: Comprehensive error handling and logging
- **Performance**: Response time tracking and optimization

## 🔒 Security

- **Authentication**: JWT tokens with refresh mechanism
- **Rate Limiting**: Configurable rate limits per endpoint
- **Input Validation**: Zod schema validation
- **CORS**: Configurable cross-origin resource sharing
- **Helmet**: Security headers and protection
- **Data Encryption**: Sensitive data encrypted at rest

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- **TypeScript**: Strict mode enabled, no `any` types
- **ESLint**: Configured with TypeScript rules
- **Prettier**: Code formatting
- **Conventional Commits**: Standardized commit messages
- **Living Interface**: All UI must feel alive with subtle motion

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions

## 🎯 Roadmap

### Phase 1 (MVP) - Current
- ✅ Project setup and foundation
- 🔄 Authentication system (SMS OTP)
- 🔄 Wanna creation + intent parsing
- 🔄 Matching algorithm
- 🔄 Pod formation logic
- 🔄 Real-time chat
- 🔄 Push notifications
- 🔄 Vibe summaries

### Phase 2 (Post-MVP)
- AR moments
- Energy score gamification
- Social concierge AI
- Micro-social maps
- Local business API integration

---

**Built with ❤️ for spontaneous human connection**

*"Iwanna connects people through moments of impulse, curiosity, and shared energy — not rigid plans."*
