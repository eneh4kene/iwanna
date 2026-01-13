/**
 * Place Finder Tool
 *
 * Searches for nearby venues based on user queries like:
 * - "@vibe find coffee nearby"
 * - "@vibe where can we get sushi?"
 * - "@vibe find a sauna"
 *
 * Uses Google Places API to return top 3 relevant venues.
 */

import { BaseTool } from './BaseTool';
import {
  ToolParams,
  ToolResult,
  OpenAIFunctionDefinition,
  ToolError,
  ToolErrorType,
  ActionButton,
} from '../types';
import { googlePlacesService } from '../../googlePlacesService';
import { getRedis } from '../../redis';

export class PlaceFinderTool extends BaseTool {
  readonly name = 'find_nearby_places';
  readonly description = 'Search for places near the pod\'s location (cafes, restaurants, saunas, parks, etc.). Use when users ask "where" or "find" something nearby.';
  readonly version = '1.0.0';

  // Cache TTL: 15 minutes
  private readonly CACHE_TTL = 15 * 60;

  getFunctionDefinition(): OpenAIFunctionDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to search for (e.g., "coffee", "sauna", "basketball court", "sushi restaurant")',
          },
          radius_meters: {
            type: 'number',
            description: 'Search radius in meters (default: 1000, max: 5000)',
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return (default: 3, max: 5)',
          },
        },
        required: ['query'],
      },
    };
  }

  override validateParameters(parameters: Record<string, any>): void {
    if (!parameters['query'] || typeof parameters['query'] !== 'string') {
      throw new Error('query is required and must be a string');
    }

    if (parameters['query'].trim().length === 0) {
      throw new Error('query cannot be empty');
    }

    if (parameters['radius_meters']) {
      const radius = Number(parameters['radius_meters']);
      if (isNaN(radius) || radius < 100 || radius > 5000) {
        throw new Error('radius_meters must be between 100 and 5000');
      }
    }

    if (parameters['max_results']) {
      const max = Number(parameters['max_results']);
      if (isNaN(max) || max < 1 || max > 5) {
        throw new Error('max_results must be between 1 and 5');
      }
    }
  }

  override async isAvailable(): Promise<boolean> {
    return googlePlacesService.isAvailable();
  }

  override getRateLimit(): { maxCalls: number; windowMs: number } {
    return {
      maxCalls: 5,
      windowMs: 10 * 60 * 1000, // 5 searches per 10 minutes
    };
  }

  protected async executeInternal(params: ToolParams): Promise<ToolResult> {
    const { query, radius_meters = 1000, max_results = 3 } = params.parameters;
    const { latitude, longitude } = params.context.location;

    // Check cache first
    const cacheKey = this.getCacheKey(query, latitude, longitude, radius_meters);
    const cached = await this.getCachedResult(cacheKey);

    if (cached) {
      this.log('Returning cached result', { query, cacheKey });

      return {
        ...cached,
        metadata: {
          executionTimeMs: cached.metadata?.executionTimeMs || 0,
          apiCallsMade: cached.metadata?.apiCallsMade || 0,
          cacheHit: true,
          podId: params.context.podId,
          userId: params.context.userId,
          parameters: params.parameters,
          rawQuery: params.rawQuery,
        },
      };
    }

    // Search Google Places
    const startTime = Date.now();

    try {
      const places = await googlePlacesService.searchNearby({
        latitude,
        longitude,
        query,
        radius: radius_meters,
        maxResults: max_results,
      });

      const apiCallTime = Date.now() - startTime;

      // No results found
      if (places.length === 0) {
        const result = this.createSuccessResult(
          `couldn't find any ${query} spots nearby. wanna try a different search?`,
          { places: [] }
        );

        result.metadata = {
          ...result.metadata,
          apiCallsMade: 1,
          executionTimeMs: apiCallTime,
          cacheHit: false,
          podId: params.context.podId,
          userId: params.context.userId,
          parameters: params.parameters,
          rawQuery: params.rawQuery,
        };

        return result;
      }

      // Format results
      const message = this.formatPlacesMessage(places, query);
      const actionButtons = this.createActionButtons(places);

      const result = this.createSuccessResult(message, { places }, actionButtons);

      result.metadata = {
        ...result.metadata,
        apiCallsMade: 1,
        executionTimeMs: apiCallTime,
        cacheHit: false,
        podId: params.context.podId,
        userId: params.context.userId,
        parameters: params.parameters,
        rawQuery: params.rawQuery,
      };

      // Cache result
      await this.cacheResult(cacheKey, result);

      return result;
    } catch (error) {
      this.error('Google Places API call failed', {
        error: error instanceof Error ? error.message : String(error),
        query,
      });

      throw new ToolError(
        ToolErrorType.API_ERROR,
        'Failed to search for places',
        this.name,
        { query, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Format places into a human-readable message
   */
  private formatPlacesMessage(places: any[], query: string): string {
    const count = places.length;
    const header = count === 1
      ? `found a ${query} spot:`
      : `found ${count} ${query} spots:`;

    const placeLines = places.map((place, index) => {
      const parts: string[] = [
        `\n${index + 1}. **${place.name}**`,
      ];

      // Distance
      if (place.distanceMeters !== undefined) {
        const distance = googlePlacesService.formatDistance(place.distanceMeters);
        parts.push(`${distance}`);
      }

      // Rating
      if (place.rating) {
        parts.push(`${place.rating}⭐`);
      }

      // Open now
      if (place.openNow !== undefined) {
        parts.push(place.openNow ? 'open now' : 'closed');
      }

      // Price level
      if (place.priceLevel !== undefined) {
        const price = googlePlacesService.formatPriceLevel(place.priceLevel);
        if (price) {
          parts.push(price);
        }
      }

      return parts.join(' • ');
    });

    return header + placeLines.join('');
  }

  /**
   * Create action buttons for map viewing
   */
  private createActionButtons(places: any[]): ActionButton[] {
    const buttons: ActionButton[] = [];

    // Add "Show on Map" button for first place
    if (places.length > 0) {
      buttons.push({
        id: 'show_map_0',
        label: 'Show on Map',
        icon: 'map-outline',
        action: 'open_map',
        payload: {
          url: places[0].googleMapsUrl,
          location: places[0].location,
        },
      });
    }

    // Add "View All" button if multiple results
    if (places.length > 1) {
      buttons.push({
        id: 'view_all',
        label: `View All ${places.length}`,
        icon: 'list-outline',
        action: 'custom',
        payload: {
          action: 'show_all_places',
          places,
        },
      });
    }

    return buttons;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(query: string, lat: number, lng: number, radius: number): string {
    // Round coordinates to 3 decimal places for cache key
    // This groups nearby searches together
    const roundedLat = Math.round(lat * 1000) / 1000;
    const roundedLng = Math.round(lng * 1000) / 1000;

    return `place_finder:${query.toLowerCase()}:${roundedLat}:${roundedLng}:${radius}`;
  }

  /**
   * Get cached result
   */
  private async getCachedResult(key: string): Promise<ToolResult | null> {
    try {
      const redis = getRedis();
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      this.warn('Failed to get cached result', { error, key });
      return null;
    }
  }

  /**
   * Cache result
   */
  private async cacheResult(key: string, result: ToolResult): Promise<void> {
    try {
      const redis = getRedis();
      await redis.setex(key, this.CACHE_TTL, JSON.stringify(result));
      this.log('Cached result', { key, ttl: this.CACHE_TTL });
    } catch (error) {
      this.warn('Failed to cache result', { error, key });
      // Don't throw - caching failure shouldn't break the flow
    }
  }
}
