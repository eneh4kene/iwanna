/**
 * Featured Pods API Service
 * API calls for featured/sponsored pods
 */

import { apiClient } from './api';
import {
  FeaturedPodsNearbyResponse,
  FeaturedPodResponse,
  JoinFeaturedPodResponse,
  FeaturedPodsListResponse,
} from '../types/featuredPods';

export const featuredPodsApi = {
  /**
   * Get featured pods near a location
   */
  async getFeaturedPodsNearby(
    latitude: number,
    longitude: number,
    maxDistanceMiles: number = 10
  ): Promise<FeaturedPodsNearbyResponse> {
    return apiClient.get<FeaturedPodsNearbyResponse>(
      `/featured-pods/nearby?latitude=${latitude}&longitude=${longitude}&maxDistanceMiles=${maxDistanceMiles}`
    );
  },

  /**
   * Get featured pod by ID
   */
  async getFeaturedPodById(featuredPodId: string): Promise<FeaturedPodResponse> {
    return apiClient.get<FeaturedPodResponse>(`/featured-pods/${featuredPodId}`);
  },

  /**
   * Get user's joined featured pods
   */
  async getMyFeaturedPods(): Promise<FeaturedPodsListResponse> {
    return apiClient.get<FeaturedPodsListResponse>('/featured-pods/my-pods');
  },

  /**
   * Join a featured pod
   */
  async joinFeaturedPod(featuredPodId: string): Promise<JoinFeaturedPodResponse> {
    return apiClient.post<JoinFeaturedPodResponse>(`/featured-pods/${featuredPodId}/join`);
  },

  /**
   * Leave a featured pod
   */
  async leaveFeaturedPod(featuredPodId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(
      `/featured-pods/${featuredPodId}/leave`
    );
  },

  /**
   * Confirm arrival at featured pod
   */
  async confirmArrival(featuredPodId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(
      `/featured-pods/${featuredPodId}/confirm`
    );
  },
};
