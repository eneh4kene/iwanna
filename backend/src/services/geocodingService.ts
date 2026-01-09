import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * Geocoding Service
 * Provides reverse geocoding using Nominatim (OpenStreetMap)
 */
class GeocodingService {
  private readonly baseUrl = 'https://nominatim.openstreetmap.org';
  private readonly userAgent = 'Iwanna/1.0';

  /**
   * Reverse geocode coordinates to a place name
   */
  async reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<string | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/reverse`, {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'json',
        },
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: 5000, // 5 second timeout
      });

      if (response.data && response.data.display_name) {
        // Extract a simpler name from the full address
        const address = response.data.address;

        // Try to build a concise place name
        const parts: string[] = [];

        // Priority: venue name, road, suburb, city
        if (address?.amenity) parts.push(address.amenity);
        else if (address?.building) parts.push(address.building);
        else if (address?.shop) parts.push(address.shop);
        else if (address?.road) parts.push(address.road);

        if (address?.suburb) parts.push(address.suburb);
        else if (address?.neighbourhood) parts.push(address.neighbourhood);
        else if (address?.city) parts.push(address.city);
        else if (address?.town) parts.push(address.town);
        else if (address?.village) parts.push(address.village);

        if (parts.length > 0) {
          return parts.join(', ');
        }

        // Fallback to display_name (truncated)
        const displayName: string = response.data.display_name;
        const firstParts = displayName.split(',').slice(0, 3).join(',');
        return firstParts;
      }

      return null;
    } catch (error) {
      logger.error('Reverse geocoding failed', {
        latitude,
        longitude,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Batch reverse geocode multiple coordinates
   */
  async reverseGeocodeMultiple(
    coordinates: Array<{ latitude: number; longitude: number }>
  ): Promise<Array<string | null>> {
    const results: Array<string | null> = [];

    for (const coord of coordinates) {
      const placeName = await this.reverseGeocode(coord.latitude, coord.longitude);
      results.push(placeName);

      // Respect Nominatim rate limit (1 request per second)
      await this.sleep(1000);
    }

    return results;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const geocodingService = new GeocodingService();
