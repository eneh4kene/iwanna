/**
 * Meeting Point Calculator Tool
 *
 * Calculates the fairest meeting point for all pod members based on their locations.
 * Optionally finds venues at the midpoint if a category is specified.
 *
 * Examples:
 * - "@vibe where should we meet?"
 * - "@vibe best place to meet?"
 * - "@vibe find a coffee shop in the middle?"
 */

import { BaseTool } from './BaseTool';
import {
  ToolParams,
  ToolResult,
  OpenAIFunctionDefinition,
  ActionButton,
} from '../types';
import { googlePlacesService } from '../../googlePlacesService';

export class MeetingPointTool extends BaseTool {
  readonly name = 'calculate_meeting_point';
  readonly description = 'Calculate the fairest meeting point for all pod members based on their locations. Optionally find venues at the midpoint if a venue type is specified.';
  readonly version = '1.0.0';

  getFunctionDefinition(): OpenAIFunctionDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          venue_type: {
            type: 'string',
            description: 'Optional: type of venue to find at the midpoint (e.g., "cafe", "park", "restaurant"). If not specified, just returns the geographic midpoint.',
          },
        },
        required: [],
      },
    };
  }

  override validateParameters(parameters: Record<string, any>): void {
    // venue_type is optional, no validation needed
    if (parameters['venue_type'] && typeof parameters['venue_type'] !== 'string') {
      throw new Error('venue_type must be a string');
    }
  }

  override async isAvailable(): Promise<boolean> {
    // Always available (doesn't require external APIs for basic centroid calculation)
    return true;
  }

  override getRateLimit(): { maxCalls: number; windowMs: number } {
    return {
      maxCalls: 10, // More lenient since this is a common query
      windowMs: 10 * 60 * 1000, // 10 searches per 10 minutes
    };
  }

  protected async executeInternal(params: ToolParams): Promise<ToolResult> {
    const { venue_type } = params.parameters;
    const { members } = params.context;

    // Filter members with location data
    const membersWithLocation = members.filter((m) => m.location);

    if (membersWithLocation.length === 0) {
      return this.createSuccessResult(
        "hmm, i don't have everyone's location yet. once everyone's location is available, i can find the best spot!",
        { membersWithLocation: 0 }
      );
    }

    if (membersWithLocation.length === 1) {
      return this.createSuccessResult(
        "looks like only one person's location is available right now. we need at least 2 people to find a midpoint!",
        { membersWithLocation: 1 }
      );
    }

    // Calculate centroid
    const centroid = this.calculateCentroid(membersWithLocation);

    // Calculate distances from centroid to each member
    const memberDistances = membersWithLocation.map((member) => {
      const distance = this.calculateDistance(
        centroid.latitude,
        centroid.longitude,
        member.location!.latitude,
        member.location!.longitude
      );

      return {
        username: member.username,
        distanceMeters: distance,
        distanceFormatted: googlePlacesService.formatDistance(distance),
      };
    });

    // Sort by distance
    memberDistances.sort((a, b) => a.distanceMeters - b.distanceMeters);

    // If venue_type is specified, search for venues at the centroid
    let venues: any[] = [];
    let apiCallsMade = 0;

    if (venue_type && googlePlacesService.isAvailable()) {
      try {
        apiCallsMade++;
        venues = await googlePlacesService.searchNearby({
          latitude: centroid.latitude,
          longitude: centroid.longitude,
          query: venue_type,
          radius: 500, // 500m radius around centroid
          maxResults: 3,
        });
      } catch (error) {
        this.warn('Failed to find venues at midpoint', { error, venue_type });
        // Continue without venues - user still gets the midpoint
      }
    }

    // Format message
    const message = this.formatMessage(centroid, memberDistances, venues, venue_type);

    // Create action buttons
    const actionButtons = this.createActionButtons(centroid, venues);

    const result = this.createSuccessResult(message, {
      centroid,
      memberDistances,
      venues,
    }, actionButtons);

    result.metadata = {
      executionTimeMs: result.metadata?.executionTimeMs || 0,
      apiCallsMade,
      cacheHit: false,
      ...result.metadata,
      podId: params.context.podId,
      userId: params.context.userId,
      parameters: params.parameters,
      rawQuery: params.rawQuery,
    };

    return result;
  }

  /**
   * Calculate geographic centroid from member locations
   */
  private calculateCentroid(members: any[]): { latitude: number; longitude: number } {
    let x = 0;
    let y = 0;
    let z = 0;

    for (const member of members) {
      const { latitude, longitude } = member.location!;

      // Convert to radians
      const latRad = (latitude * Math.PI) / 180;
      const lngRad = (longitude * Math.PI) / 180;

      // Convert to Cartesian coordinates
      x += Math.cos(latRad) * Math.cos(lngRad);
      y += Math.cos(latRad) * Math.sin(lngRad);
      z += Math.sin(latRad);
    }

    // Average
    x /= members.length;
    y /= members.length;
    z /= members.length;

    // Convert back to latitude/longitude
    const lngRad = Math.atan2(y, x);
    const hyp = Math.sqrt(x * x + y * y);
    const latRad = Math.atan2(z, hyp);

    const latitude = (latRad * 180) / Math.PI;
    const longitude = (lngRad * 180) / Math.PI;

    return { latitude, longitude };
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

    return R * c;
  }

  /**
   * Format message for user
   */
  private formatMessage(
    centroid: { latitude: number; longitude: number },
    memberDistances: any[],
    venues: any[],
    venueType?: string
  ): string {
    const parts: string[] = [];

    // If venues found, lead with that
    if (venues.length > 0 && venueType) {
      parts.push(`found ${venues.length} ${venueType} spot${venues.length > 1 ? 's' : ''} in the middle:`);

      venues.forEach((venue, index) => {
        const venueParts = [
          `\n${index + 1}. **${venue.name}**`,
        ];

        if (venue.rating) {
          venueParts.push(`${venue.rating}⭐`);
        }

        if (venue.openNow !== undefined) {
          venueParts.push(venue.openNow ? 'open now' : 'closed');
        }

        parts.push(venueParts.join(' • '));
      });

      parts.push('\n\ndistances from the spot:');
    } else {
      parts.push("here's a fair midpoint for everyone:");
      parts.push(`\n📍 ${centroid.latitude.toFixed(5)}, ${centroid.longitude.toFixed(5)}`);
      parts.push('\n\ndistances:');
    }

    // Add member distances
    memberDistances.forEach((md) => {
      parts.push(`\n• ${md.username}: ${md.distanceFormatted}`);
    });

    return parts.join('');
  }

  /**
   * Create action buttons
   */
  private createActionButtons(
    centroid: { latitude: number; longitude: number },
    venues: any[]
  ): ActionButton[] {
    const buttons: ActionButton[] = [];

    // If venues found, add button to show first venue on map
    if (venues.length > 0) {
      buttons.push({
        id: 'show_venue_map',
        label: 'Show on Map',
        icon: 'map-outline',
        action: 'open_map',
        payload: {
          url: venues[0].googleMapsUrl,
          location: venues[0].location,
        },
      });
    } else {
      // No venues, just show centroid on map
      buttons.push({
        id: 'show_midpoint_map',
        label: 'Show Midpoint on Map',
        icon: 'navigate-outline',
        action: 'open_map',
        payload: {
          url: `https://www.google.com/maps/search/?api=1&query=${centroid.latitude},${centroid.longitude}`,
          location: centroid,
        },
      });
    }

    // Add "Send Pin" button to share location in chat
    buttons.push({
      id: 'send_pin',
      label: 'Send Pin to Everyone',
      icon: 'location-outline',
      action: 'send_pin',
      payload: {
        location: centroid,
        label: venues.length > 0 ? venues[0].name : 'Meeting Point',
      },
    });

    // If no venues found but venue type was specified, offer to search
    if (venues.length === 0 && googlePlacesService.isAvailable()) {
      buttons.push({
        id: 'find_venues',
        label: 'Find Venues Here',
        icon: 'search-outline',
        action: 'find_venue',
        payload: {
          location: centroid,
        },
      });
    }

    return buttons;
  }
}
