-- Seed Featured Pods Sample Data
-- Creates test venues and featured pods for development

-- Insert test venues
INSERT INTO venues (
  id,
  name,
  description,
  logo_url,
  location,
  location_name,
  city,
  state,
  venue_type,
  is_active,
  is_verified
) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'The Local Sports Bar',
    'Your neighborhood hangout for sports, trivia, and good vibes',
    'https://picsum.photos/seed/venue1/200',
    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,  -- San Francisco
    '789 Valencia St, San Francisco, CA 94110',
    'San Francisco',
    'CA',
    'bar',
    true,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Brew Coffee Collective',
    'Artisan coffee, community vibes, and co-working space',
    'https://picsum.photos/seed/venue2/200',
    ST_SetSRID(ST_MakePoint(-122.4085, 37.7858), 4326)::geography,  -- SF Mission
    '456 Mission St, San Francisco, CA 94103',
    'San Francisco',
    'CA',
    'cafe',
    true,
    true
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Golden State Soccer Fields',
    'Public soccer fields and pickup games',
    'https://picsum.photos/seed/venue3/200',
    ST_SetSRID(ST_MakePoint(-122.4000, 37.7900), 4326)::geography,  -- SF Civic Center
    '101 Civic Center Plaza, San Francisco, CA 94102',
    'San Francisco',
    'CA',
    'park',
    true,
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Insert featured pods (same-day events)
INSERT INTO featured_pods (
  id,
  venue_id,
  title,
  description,
  category,
  location,
  location_name,
  venue_logo_url,
  image_url,
  max_capacity,
  current_count,
  starts_at,
  expires_at,
  status,
  sponsor_tier
) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'Trivia Night at The Local',
    'Test your knowledge! Teams of 2-6. Prizes for top 3 teams. Free first round for new players.',
    'entertainment',
    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,
    '789 Valencia St, San Francisco, CA 94110',
    'https://picsum.photos/seed/venue1/200',
    'https://picsum.photos/seed/trivia/400/300',
    50,
    18,
    NOW() + INTERVAL '3 hours',
    NOW() + INTERVAL '6 hours',
    'active',
    'premium'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'Coffee & Code Meetup',
    'Casual co-working session for developers, designers, and makers. Bring your laptop!',
    'food_social',
    ST_SetSRID(ST_MakePoint(-122.4085, 37.7858), 4326)::geography,
    '456 Mission St, San Francisco, CA 94103',
    'https://picsum.photos/seed/venue2/200',
    'https://picsum.photos/seed/coffee/400/300',
    30,
    12,
    NOW() + INTERVAL '1 hour',
    NOW() + INTERVAL '4 hours',
    'active',
    'featured'
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '33333333-3333-3333-3333-333333333333',
    'Pickup Soccer Game',
    '5v5 casual soccer. All skill levels welcome. Bring water and shin guards.',
    'sports',
    ST_SetSRID(ST_MakePoint(-122.4000, 37.7900), 4326)::geography,
    '101 Civic Center Plaza, San Francisco, CA 94102',
    'https://picsum.photos/seed/venue3/200',
    'https://picsum.photos/seed/soccer/400/300',
    20,
    15,
    NOW() + INTERVAL '2 hours',
    NOW() + INTERVAL '4 hours',
    'active',
    'featured'
  )
ON CONFLICT (id) DO NOTHING;

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'Featured pods seed data inserted successfully';
  RAISE NOTICE 'Created 3 venues and 3 featured pods';
END $$;
