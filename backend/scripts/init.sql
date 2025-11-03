-- Iwanna Database Initialization Script
-- This script sets up the database schema and initial data

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create users table (Phase 1B: Anonymous-first authentication)
CREATE TABLE IF NOT EXISTS users (
    -- Core identity (backend only - never show other users)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    
    -- Account tier
    account_tier VARCHAR(20) DEFAULT 'anonymous' CHECK (account_tier IN ('anonymous', 'email', 'authenticated')),
    
    -- Tier 1: Anonymous fields
    recovery_phrase_hash VARCHAR(255) UNIQUE,     -- bcrypt hash of recovery phrase
    device_fingerprint VARCHAR(255),              -- Optional for fraud detection
    
    -- Tier 2: Email fields (nullable)
    email VARCHAR(255) UNIQUE,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    
    -- Tier 3: Social auth fields (nullable)
    auth_provider VARCHAR(20),                    -- 'google', 'apple', null
    social_id VARCHAR(255),                       -- Provider's user ID
    social_email VARCHAR(255),                    -- From social provider
    
    -- Age verification (18+ required)
    is_18_plus BOOLEAN DEFAULT false NOT NULL,
    birth_year INTEGER,                           -- Optional, for analytics only
    age_verified_at TIMESTAMP,
    
    -- Trust & Safety
    trust_score INTEGER DEFAULT 100 CHECK (trust_score >= 0 AND trust_score <= 200),
    is_banned BOOLEAN DEFAULT false,
    ban_reason TEXT,
    banned_until TIMESTAMP,
    
    -- Activity tracking
    wannas_created_count INTEGER DEFAULT 0,
    pods_joined_count INTEGER DEFAULT 0,
    connections_made_count INTEGER DEFAULT 0,
    reports_received_count INTEGER DEFAULT 0,
    reports_made_count INTEGER DEFAULT 0,
    
    -- Rate limiting
    last_wanna_at TIMESTAMP,
    wannas_today INTEGER DEFAULT 0,
    rate_limit_reset_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    upgraded_to_email_at TIMESTAMP,
    upgraded_to_authenticated_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_email_tier CHECK (
        account_tier != 'email' OR email IS NOT NULL
    ),
    CONSTRAINT valid_authenticated_tier CHECK (
        account_tier != 'authenticated' OR (auth_provider IS NOT NULL AND social_id IS NOT NULL)
    ),
    CONSTRAINT age_verified CHECK (is_18_plus = true)
);

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create recovery_attempts table (Security Logging)
CREATE TABLE IF NOT EXISTS recovery_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempted_phrase VARCHAR(500),               -- First 50 chars only, for pattern detection
    ip_address VARCHAR(45),
    device_info JSONB,
    success BOOLEAN DEFAULT false,
    user_id UUID REFERENCES users(id),          -- Only set if success = true
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wannas table (Phase 1C: Wanna Creation & AI Intent Parsing)
CREATE TABLE IF NOT EXISTS wannas (
    -- Core identity
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- User input
    raw_input TEXT NOT NULL CHECK (length(raw_input) >= 3 AND length(raw_input) <= 200),
    mood_emoji VARCHAR(10),  -- Optional mood selector
    
    -- AI-parsed intent
    intent JSONB NOT NULL,   -- Structured data from AI parsing
    embedding TEXT,          -- JSON array of numbers (will upgrade to VECTOR later)
    
    -- Location data
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    location_accuracy FLOAT,
    location_name VARCHAR(255),  -- Reverse geocoded place name
    
    -- Metadata
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'matching', 'matched', 'expired', 'cancelled')),
    priority INTEGER DEFAULT 0,  -- For future ranking
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '6 hours'),
    matched_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Create pods table
CREATE TABLE IF NOT EXISTS pods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status VARCHAR(20) DEFAULT 'forming' CHECK (status IN ('forming', 'active', 'completed', 'expired')),
    vibe_summary TEXT,
    collective_intent JSONB,
    centroid_location GEOGRAPHY(POINT, 4326),
    suggested_venues JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create pod_members table
CREATE TABLE IF NOT EXISTS pod_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wanna_id UUID NOT NULL REFERENCES wannas(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'left', 'removed')),
    marked_complete BOOLEAN DEFAULT FALSE,
    UNIQUE(pod_id, user_id)
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'user' CHECK (message_type IN ('user', 'system', 'ai')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vibe_summaries table
CREATE TABLE IF NOT EXISTS vibe_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    connections_made INTEGER DEFAULT 0,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_social ON users(auth_provider, social_id) WHERE auth_provider IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_fingerprint) WHERE device_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_trust ON users(trust_score);
CREATE INDEX IF NOT EXISTS idx_users_banned ON users(is_banned) WHERE is_banned = true;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(last_active_at DESC);

-- Recovery phrase lookup optimization
CREATE INDEX IF NOT EXISTS idx_users_recovery_phrase ON users USING hash(recovery_phrase_hash);

-- Refresh tokens indexes
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash) WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked = false;

-- Recovery attempts indexes
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_ip ON recovery_attempts(ip_address, attempted_at);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_success ON recovery_attempts(success, attempted_at);

-- Wannas indexes for performance (Phase 1C)
CREATE INDEX IF NOT EXISTS idx_wannas_user ON wannas(user_id);
CREATE INDEX IF NOT EXISTS idx_wannas_status ON wannas(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_wannas_location ON wannas USING GIST(location) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_wannas_created ON wannas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wannas_expires ON wannas(expires_at) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_pods_status ON pods(status);
CREATE INDEX IF NOT EXISTS idx_pods_created_at ON pods(created_at);
CREATE INDEX IF NOT EXISTS idx_pods_expires_at ON pods(expires_at);
CREATE INDEX IF NOT EXISTS idx_pods_centroid_location ON pods USING GIST(centroid_location);

CREATE INDEX IF NOT EXISTS idx_pod_members_pod_id ON pod_members(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_members_user_id ON pod_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pod_members_status ON pod_members(status);

CREATE INDEX IF NOT EXISTS idx_chat_messages_pod_id ON chat_messages(pod_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_vibe_summaries_user_id ON vibe_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_vibe_summaries_pod_id ON vibe_summaries(pod_id);
CREATE INDEX IF NOT EXISTS idx_vibe_summaries_generated_at ON vibe_summaries(generated_at);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wannas_updated_at BEFORE UPDATE ON wannas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pods_updated_at BEFORE UPDATE ON pods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pod_members_updated_at BEFORE UPDATE ON pod_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vibe_summaries_updated_at BEFORE UPDATE ON vibe_summaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for development (Phase 1B: Anonymous accounts)
INSERT INTO users (username, account_tier, is_18_plus, age_verified_at, trust_score) VALUES
    ('CuriousVibe_8234', 'anonymous', true, NOW(), 100),
    ('ChillSoul_5678', 'anonymous', true, NOW(), 100),
    ('CreativeMind_9012', 'anonymous', true, NOW(), 100)
ON CONFLICT (username) DO NOTHING;

-- Create a function to clean up expired wannas and pods
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- Mark expired wannas as expired
    UPDATE wannas 
    SET status = 'expired' 
    WHERE status = 'active' AND expires_at < NOW();
    
    -- Mark expired pods as expired
    UPDATE pods 
    SET status = 'expired' 
    WHERE status IN ('forming', 'active') AND expires_at < NOW();
    
    -- Log cleanup activity
    RAISE NOTICE 'Cleaned up expired wannas and pods at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a function to get nearby wannas for matching
CREATE OR REPLACE FUNCTION get_nearby_wannas(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    max_distance_miles DOUBLE PRECISION DEFAULT 5.0,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    raw_input TEXT,
    intent JSONB,
    location GEOGRAPHY,
    mood_tag VARCHAR(20),
    distance_miles DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id,
        w.user_id,
        w.raw_input,
        w.intent,
        w.location,
        w.mood_tag,
        ST_Distance(
            w.location,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
        ) / 1609.34 as distance_miles
    FROM wannas w
    WHERE w.status = 'active'
        AND w.expires_at > NOW()
        AND ST_DWithin(
            w.location,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
            max_distance_miles * 1609.34
        )
    ORDER BY distance_miles
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO iwanna;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO iwanna;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO iwanna;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Iwanna database initialized successfully at %', NOW();
END $$;
