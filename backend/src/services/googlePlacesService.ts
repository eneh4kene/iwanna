/**
 * Google Places Service
 *
 * Wrapper around Google Places API for finding nearby venues.
 * Used by PlaceFinderTool to search for coffee shops, restaurants, etc.
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { googlePlacesConfig } from '../config';

export interface PlaceSearchParams {
  latitude: number;
  longitude: number;
  query: string; // e.g., "coffee", "sauna", "basketball court"
  radius?: number; // meters, default 1000
  maxResults?: number; // default 3
}

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  totalRatings?: number;
  priceLevel?: number; // 0-4, where 0 is free and 4 is very expensive
  openNow?: boolean;
  distanceMeters?: number;
  location: {
    latitude: number;
    longitude: number;
  };
  types?: string[]; // e.g., ["cafe", "restaurant"]
  photoUrl?: string;
  googleMapsUrl: string;
}

export interface PlaceDetailsResult extends PlaceResult {
  phoneNumber?: string;
  website?: string;
  openingHours?: {
    weekdayText: string[];
    openNow: boolean;
  };
}

class GooglePlacesService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api/place';

  constructor() {
    this.apiKey = googlePlacesConfig.apiKey;

    if (!this.apiKey) {
      logger.warn('[GooglePlacesService] No API key configured, service will be unavailable');
    }
  }

  /**
   * Check if service is available (has API key)
   */
  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Search for nearby places
   */
  async searchNearby(params: PlaceSearchParams): Promise<PlaceResult[]> {
    if (!this.isAvailable()) {
      throw new Error('Google Places API key not configured');
    }

    const {
      latitude,
      longitude,
      query,
      radius = 1000,
      maxResults = 3,
    } = params;

    try {
      logger.info('[GooglePlacesService] Searching nearby places', {
        query,
        latitude,
        longitude,
        radius,
      });

      // Use Text Search API for more flexible queries
      const response = await axios.get(`${this.baseUrl}/textsearch/json`, {
        params: {
          query,
          location: `${latitude},${longitude}`,
          radius,
          key: this.apiKey,
        },
        timeout: 10000, // 10 second timeout
      });

      if (response.data.status === 'ZERO_RESULTS') {
        logger.info('[GooglePlacesService] No results found', { query });
        return [];
      }

      if (response.data.status !== 'OK') {
        logger.error('[GooglePlacesService] API returned error status', {
          status: response.data.status,
          errorMessage: response.data.error_message,
        });
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      // Parse results
      const places: PlaceResult[] = response.data.results
        .slice(0, maxResults)
        .map((result: any) => this.parsePlace(result, latitude, longitude));

      logger.info('[GooglePlacesService] Search completed', {
        query,
        resultsCount: places.length,
      });

      return places;
    } catch (error) {
      logger.error('[GooglePlacesService] Search failed', {
        error: error instanceof Error ? error.message : String(error),
        query,
      });
      throw error;
    }
  }

  /**
   * Get place details by place ID
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetailsResult | null> {
    if (!this.isAvailable()) {
      throw new Error('Google Places API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/details/json`, {
        params: {
          place_id: placeId,
          fields: 'name,formatted_address,rating,user_ratings_total,price_level,opening_hours,geometry,types,formatted_phone_number,website,photos',
          key: this.apiKey,
        },
        timeout: 10000,
      });

      if (response.data.status !== 'OK') {
        logger.warn('[GooglePlacesService] Place details not found', {
          placeId,
          status: response.data.status,
        });
        return null;
      }

      const result = response.data.result;
      const location = result.geometry?.location;

      return {
        placeId,
        name: result.name || 'Unknown',
        address: result.formatted_address || '',
        rating: result.rating,
        totalRatings: result.user_ratings_total,
        priceLevel: result.price_level,
        openNow: result.opening_hours?.open_now,
        location: {
          latitude: location?.lat || 0,
          longitude: location?.lng || 0,
        },
        types: result.types || [],
        phoneNumber: result.formatted_phone_number,
        website: result.website,
        openingHours: result.opening_hours
          ? {
              weekdayText: result.opening_hours.weekday_text || [],
              openNow: result.opening_hours.open_now || false,
            }
          : undefined,
        photoUrl: this.getPhotoUrl(result.photos?.[0]),
        googleMapsUrl: this.getGoogleMapsUrl(placeId),
      };
    } catch (error) {
      logger.error('[GooglePlacesService] Failed to get place details', {
        error: error instanceof Error ? error.message : String(error),
        placeId,
      });
      throw error;
    }
  }

  /**
   * Parse a place result from Google API
   */
  private parsePlace(result: any, userLat: number, userLng: number): PlaceResult {
    const location = result.geometry?.location;
    const lat = location?.lat || 0;
    const lng = location?.lng || 0;

    // Calculate distance
    const distanceMeters = this.calculateDistance(userLat, userLng, lat, lng);

    return {
      placeId: result.place_id,
      name: result.name || 'Unknown',
      address: result.formatted_address || '',
      rating: result.rating,
      totalRatings: result.user_ratings_total,
      priceLevel: result.price_level,
      openNow: result.opening_hours?.open_now,
      distanceMeters,
      location: {
        latitude: lat,
        longitude: lng,
      },
      types: result.types || [],
      photoUrl: this.getPhotoUrl(result.photos?.[0]),
      googleMapsUrl: this.getGoogleMapsUrl(result.place_id),
    };
  }

  /**
   * Get photo URL from photo reference
   */
  private getPhotoUrl(photo: any): string | undefined {
    if (!photo || !photo.photo_reference) {
      return undefined;
    }

    return `${this.baseUrl}/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${this.apiKey}`;
  }

  /**
   * Get Google Maps URL for a place
   */
  private getGoogleMapsUrl(placeId: string): string {
    return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   * Returns distance in meters
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Format distance for display
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} ft`; // Using feet for short distances
    }

    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
  }

  /**
   * Format price level
   */
  formatPriceLevel(level?: number): string {
    if (level === undefined || level === null) {
      return '';
    }

    return '$'.repeat(level + 1); // 0 = $, 1 = $$, 2 = $$$, etc.
  }
}

// Singleton instance
export const googlePlacesService = new GooglePlacesService();
