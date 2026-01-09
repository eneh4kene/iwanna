/**
 * Featured Pods Types (Mobile)
 * Sponsored/public pods for same-day events at venues
 */

export interface Venue {
  id: string;
  name: string;
  venueType?: string;
  logoUrl?: string;
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
  startsAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
  status: 'active' | 'cancelled' | 'completed' | 'expired';
  isSponsored: boolean;
  sponsorTier: 'featured' | 'premium' | 'boost';
  createdAt: string;
  updatedAt: string;
}

export interface FeaturedPodWithVenue extends FeaturedPod {
  venue: Venue;
  distanceMiles?: number;
}

export interface FeaturedPodMember {
  userId: string;
  username: string;
  joinedAt: string;
  hasConfirmedArrival: boolean;
}

export interface FeaturedPodWithMembers extends FeaturedPodWithVenue {
  members: FeaturedPodMember[];
  isUserMember: boolean;
}

// API Response types
export interface FeaturedPodsNearbyResponse {
  success: boolean;
  data: FeaturedPodWithVenue[];
  count: number;
}

export interface FeaturedPodResponse {
  success: boolean;
  data: FeaturedPodWithMembers;
}

export interface JoinFeaturedPodResponse {
  success: boolean;
  data: {
    featuredPod: FeaturedPodWithMembers;
    member: {
      id: string;
      featuredPodId: string;
      userId: string;
      status: string;
      joinedAt: string;
    };
  };
}

export interface FeaturedPodsListResponse {
  success: boolean;
  data: FeaturedPodWithVenue[];
  count: number;
}
