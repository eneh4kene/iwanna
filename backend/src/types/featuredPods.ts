/**
 * Featured Pods Types
 * Sponsored/public pods for same-day events at venues
 */

export interface Venue {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  locationName: string;
  city?: string;
  state?: string;
  zipCode?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  venueType?: string;
  websiteUrl?: string;
  instagramHandle?: string;
  isActive: boolean;
  isVerified: boolean;
  verificationDate?: Date;
  subscriptionTier: 'basic' | 'premium' | 'enterprise';
  subscriptionStatus: 'active' | 'paused' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface FeaturedPod {
  id: string;
  venueId: string;
  title: string;
  description?: string;
  category: string;
  location: {
    latitude: number;
    longitude: number;
  };
  locationName: string;
  imageUrl?: string;
  venueLogoUrl?: string;
  maxCapacity: number;
  currentCount: number;
  startsAt: Date;
  expiresAt: Date;
  status: 'active' | 'cancelled' | 'completed' | 'expired';
  isSponsored: boolean;
  sponsorTier: 'featured' | 'premium' | 'boost';
  sharedIntent?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  completedAt?: Date;
}

export interface FeaturedPodWithVenue extends FeaturedPod {
  venue: {
    name: string;
    venueType?: string;
    logoUrl?: string;
  };
  distanceMiles?: number;
}

export interface FeaturedPodMember {
  id: string;
  featuredPodId: string;
  userId: string;
  status: 'joined' | 'left' | 'removed';
  hasConfirmedArrival: boolean;
  confirmedAt?: Date;
  joinedAt: Date;
  leftAt?: Date;
}

export interface FeaturedPodWithMembers extends FeaturedPodWithVenue {
  members: Array<{
    userId: string;
    username: string;
    joinedAt: Date;
    hasConfirmedArrival: boolean;
  }>;
  isUserMember: boolean;
}

// API Request types
export interface CreateFeaturedPodRequest {
  venueId: string;
  title: string;
  description?: string;
  category: string;
  imageUrl?: string;
  maxCapacity?: number;
  startsAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
  sponsorTier?: 'featured' | 'premium' | 'boost';
}

export interface UpdateFeaturedPodRequest {
  title?: string;
  description?: string;
  imageUrl?: string;
  maxCapacity?: number;
  startsAt?: string;
  expiresAt?: string;
}

export interface JoinFeaturedPodRequest {
  featuredPodId: string;
}

export interface GetFeaturedPodsNearbyRequest {
  latitude: number;
  longitude: number;
  maxDistanceMiles?: number;
  limit?: number;
}

// API Response types
export interface FeaturedPodResponse {
  success: boolean;
  data: FeaturedPodWithMembers;
}

export interface FeaturedPodsListResponse {
  success: boolean;
  data: FeaturedPodWithVenue[];
  count: number;
}

export interface JoinFeaturedPodResponse {
  success: boolean;
  data: {
    featuredPod: FeaturedPodWithMembers;
    member: FeaturedPodMember;
  };
}

// Database query result types
export interface FeaturedPodRow {
  id: string;
  venue_id: string;
  title: string;
  description: string | null;
  category: string;
  location: string; // PostGIS geography in text format
  location_name: string;
  image_url: string | null;
  venue_logo_url: string | null;
  max_capacity: number;
  current_count: number;
  starts_at: Date;
  expires_at: Date;
  status: string;
  is_sponsored: boolean;
  sponsor_tier: string;
  shared_intent: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
  cancelled_at: Date | null;
  completed_at: Date | null;
}

export interface FeaturedPodNearbyRow extends FeaturedPodRow {
  distance_miles: number;
  venue_name: string;
  venue_type: string | null;
}

export interface VenueRow {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  location: string; // PostGIS geography
  location_name: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  venue_type: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  is_active: boolean;
  is_verified: boolean;
  verification_date: Date | null;
  subscription_tier: string;
  subscription_status: string;
  created_at: Date;
  updated_at: Date;
}

export interface FeaturedPodMemberRow {
  id: string;
  featured_pod_id: string;
  user_id: string;
  status: string;
  has_confirmed_arrival: boolean;
  confirmed_at: Date | null;
  joined_at: Date;
  left_at: Date | null;
}

// Helper: Convert PostGIS geography to lat/lng
export interface PostGISPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export function parsePostGISPoint(geographyText: string): { latitude: number; longitude: number } {
  // Parse "POINT(lng lat)" format from PostGIS
  const match = geographyText.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid PostGIS point format: ${geographyText}`);
  }
  return {
    longitude: parseFloat(match[1]),
    latitude: parseFloat(match[2]),
  };
}
