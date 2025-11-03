import axios from 'axios';
import { logger } from '../utils/logger';
import { LocationContext } from '../types';

/**
 * Location Service for reverse geocoding
 */
class LocationService {
  /**
   * Reverse geocode coordinates to human-readable location
   * Using OpenStreetMap Nominatim (free, no API key needed)
   */
  async reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<LocationContext | null> {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'json',
          addressdetails: 1,
        },
        headers: {
          'User-Agent': 'Iwanna/1.0 (Social Connection App)', // Required by Nominatim
        },
        timeout: 5000,
      });

      const data = response.data;
      const address = data.address || {};

      const locationContext: LocationContext = {
        city: address.city || address.town || address.village || address.county || 'Unknown',
        neighborhood:
          address.neighbourhood || address.suburb || address.city_district || address.quarter || '',
        country: address.country || '',
        formatted: data.display_name || `${latitude}, ${longitude}`,
      };

      logger.debug('Location reverse geocoded', locationContext);

      return locationContext;
    } catch (error) {
      logger.error('Reverse geocoding failed', {
        error,
        latitude,
        longitude,
      });
      return null;
    }
  }

  /**
   * Validate location coordinates
   */
  isValidLocation(latitude: number, longitude: number): boolean {
    // Check if coordinates are within valid ranges
    if (latitude < -90 || latitude > 90) {
      return false;
    }

    if (longitude < -180 || longitude > 180) {
      return false;
    }

    // Check if not null island (0, 0)
    if (latitude === 0 && longitude === 0) {
      return false;
    }

    return true;
  }

  /**
   * Calculate distance between two points in miles (Haversine formula)
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 3959; // Earth's radius in miles

    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate centroid (center point) of multiple locations
   */
  calculateCentroid(locations: Array<{ latitude: number; longitude: number }>): {
    latitude: number;
    longitude: number;
  } | undefined {
    if (locations.length === 0) {
      return undefined;
    }

    if (locations.length === 1) {
      return locations[0];
    }

    let x = 0;
    let y = 0;
    let z = 0;

    for (const location of locations) {
      const lat = this.toRadians(location.latitude);
      const lon = this.toRadians(location.longitude);

      x += Math.cos(lat) * Math.cos(lon);
      y += Math.cos(lat) * Math.sin(lon);
      z += Math.sin(lat);
    }

    x /= locations.length;
    y /= locations.length;
    z /= locations.length;

    const lon = Math.atan2(y, x);
    const hyp = Math.sqrt(x * x + y * y);
    const lat = Math.atan2(z, hyp);

    return {
      latitude: lat * (180 / Math.PI),
      longitude: lon * (180 / Math.PI),
    };
  }
}

export const locationService = new LocationService();
