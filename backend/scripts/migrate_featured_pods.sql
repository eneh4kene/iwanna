-- Migration: Featured Pods & Venues
-- Purpose: Add sponsored/featured pods for same-day events at venues
-- Date: 2026-01-09

-- Create venues table (businesses that sponsor featured pods)
CREATE TABLE IF NOT EXISTS venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Venue identity
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    cover_image_url TEXT,

    -- Location
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    location_name VARCHAR(255) NOT NULL,  -- "123 Main St, San Francisco, CA"
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),

    -- Contact
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),

    -- Business info
    venue_type VARCHAR(50),  -- "bar", "cafe", "gym", "park", "restaurant", etc.
    website_url TEXT,
    instagram_handle VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verification_date TIMESTAMP WITH TIME ZONE,

    -- Subscription/billing
    subscription_tier VARCHAR(50) DEFAULT 'basic',  -- "basic", "premium", "enterprise"
    subscription_status VARCHAR(50) DEFAULT 'active',  -- "active", "paused", "cancelled"

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create featured_pods table (sponsored/public pods)
CREATE TABLE IF NOT EXISTS featured_pods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Venue reference
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,

    -- Pod details
    title VARCHAR(255) NOT NULL,  -- "Trivia Night at The Local"
    description TEXT,
    category VARCHAR(50) NOT NULL,  -- "food_social", "sports", "entertainment", etc.

    -- Location (inherit from venue but stored for query performance)
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    location_name VARCHAR(255) NOT NULL,

    -- Visual assets
    image_url TEXT,
    venue_logo_url TEXT,

    -- Capacity
    max_capacity INTEGER DEFAULT 50 CHECK (max_capacity >= 1 AND max_capacity <= 500),
    current_count INTEGER DEFAULT 0,

    -- Timing (same-day only)
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed', 'expired')),

    -- Sponsorship
    is_sponsored BOOLEAN DEFAULT true,
    sponsor_tier VARCHAR(50) DEFAULT 'featured',  -- "featured", "premium", "boost"

    -- Activity metadata
    shared_intent JSONB,  -- Merged intent from all members

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create featured_pod_members table (users who joined featured pods)
CREATE TABLE IF NOT EXISTS featured_pod_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- References
    featured_pod_id UUID NOT NULL REFERENCES featured_pods(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Join status
    status VARCHAR(50) DEFAULT 'joined' CHECK (status IN ('joined', 'left', 'removed')),

    -- Confirmation (for event check-in)
    has_confirmed_arrival BOOLEAN DEFAULT false,
    confirmed_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,

    -- Unique constraint: user can only join a featured pod once
    UNIQUE(featured_pod_id, user_id)
);

-- Create chat_messages updates for featured pods
-- Add featured_pod_id as nullable FK to existing chat_messages table
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS featured_pod_id UUID REFERENCES featured_pods(id) ON DELETE CASCADE;

-- Add check constraint: message must belong to either pod_id OR featured_pod_id (not both)
ALTER TABLE chat_messages
ADD CONSTRAINT chat_message_pod_type CHECK (
    (pod_id IS NOT NULL AND featured_pod_id IS NULL) OR
    (pod_id IS NULL AND featured_pod_id IS NOT NULL)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_venues_location ON venues USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_venues_active ON venues(is_active, is_verified);
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(city);

CREATE INDEX IF NOT EXISTS idx_featured_pods_location ON featured_pods USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_featured_pods_status ON featured_pods(status);
CREATE INDEX IF NOT EXISTS idx_featured_pods_starts_at ON featured_pods(starts_at);
CREATE INDEX IF NOT EXISTS idx_featured_pods_venue ON featured_pods(venue_id);
CREATE INDEX IF NOT EXISTS idx_featured_pods_active ON featured_pods(status, starts_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_featured_pod_members_pod ON featured_pod_members(featured_pod_id);
CREATE INDEX IF NOT EXISTS idx_featured_pod_members_user ON featured_pod_members(user_id);
CREATE INDEX IF NOT EXISTS idx_featured_pod_members_status ON featured_pod_members(status);

CREATE INDEX IF NOT EXISTS idx_chat_messages_featured_pod ON chat_messages(featured_pod_id) WHERE featured_pod_id IS NOT NULL;

-- Function: Get featured pods near location
CREATE OR REPLACE FUNCTION get_featured_pods_nearby(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    max_distance_miles INTEGER DEFAULT 10,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    venue_id UUID,
    title VARCHAR(255),
    description TEXT,
    category VARCHAR(50),
    location_name VARCHAR(255),
    venue_logo_url TEXT,
    image_url TEXT,
    max_capacity INTEGER,
    current_count INTEGER,
    starts_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    sponsor_tier VARCHAR(50),
    distance_miles DOUBLE PRECISION,
    venue_name VARCHAR(255),
    venue_type VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        fp.id,
        fp.venue_id,
        fp.title,
        fp.description,
        fp.category,
        fp.location_name,
        fp.venue_logo_url,
        fp.image_url,
        fp.max_capacity,
        fp.current_count,
        fp.starts_at,
        fp.expires_at,
        fp.sponsor_tier,
        ST_Distance(
            fp.location,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
        ) / 1609.34 AS distance_miles,
        v.name AS venue_name,
        v.venue_type
    FROM featured_pods fp
    INNER JOIN venues v ON fp.venue_id = v.id
    WHERE
        fp.status = 'active'
        AND fp.starts_at > NOW()  -- Event hasn't started yet
        AND fp.expires_at > NOW()  -- Event hasn't expired
        AND v.is_active = true
        AND ST_DWithin(
            fp.location,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
            max_distance_miles * 1609.34
        )
    ORDER BY
        -- Premium pods first, then by distance
        CASE
            WHEN fp.sponsor_tier = 'premium' THEN 1
            WHEN fp.sponsor_tier = 'boost' THEN 2
            ELSE 3
        END,
        distance_miles
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Update featured pod member count
CREATE OR REPLACE FUNCTION update_featured_pod_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'joined' THEN
        UPDATE featured_pods
        SET current_count = current_count + 1
        WHERE id = NEW.featured_pod_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'joined' AND NEW.status != 'joined' THEN
        UPDATE featured_pods
        SET current_count = GREATEST(0, current_count - 1)
        WHERE id = NEW.featured_pod_id;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'joined' THEN
        UPDATE featured_pods
        SET current_count = GREATEST(0, current_count - 1)
        WHERE id = OLD.featured_pod_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update featured pod member count
CREATE TRIGGER trigger_update_featured_pod_count
AFTER INSERT OR UPDATE OR DELETE ON featured_pod_members
FOR EACH ROW
EXECUTE FUNCTION update_featured_pod_count();

-- Grant permissions
GRANT ALL PRIVILEGES ON venues TO iwanna;
GRANT ALL PRIVILEGES ON featured_pods TO iwanna;
GRANT ALL PRIVILEGES ON featured_pod_members TO iwanna;
GRANT EXECUTE ON FUNCTION get_featured_pods_nearby TO iwanna;

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Featured Pods migration completed successfully at %', NOW();
END $$;
