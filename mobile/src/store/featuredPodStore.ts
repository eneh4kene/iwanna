/**
 * Featured Pod Store
 * Zustand state management for featured/sponsored pods
 */

import { create } from 'zustand';
import { featuredPodsApi } from '../services/featuredPodsApi';
import { FeaturedPodWithVenue, FeaturedPodWithMembers } from '../types/featuredPods';

interface FeaturedPodState {
  // State
  nearbyFeaturedPods: FeaturedPodWithVenue[];
  myFeaturedPods: FeaturedPodWithVenue[];
  currentFeaturedPod: FeaturedPodWithMembers | null;
  isLoading: boolean;
  isJoining: boolean;
  isLeaving: boolean;
  error: string | null;

  // Actions
  fetchNearbyFeaturedPods: (latitude: number, longitude: number) => Promise<void>;
  fetchMyFeaturedPods: () => Promise<void>;
  fetchFeaturedPodById: (featuredPodId: string) => Promise<void>;
  joinFeaturedPod: (featuredPodId: string) => Promise<void>;
  leaveFeaturedPod: (featuredPodId: string) => Promise<void>;
  confirmArrival: (featuredPodId: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useFeaturedPodStore = create<FeaturedPodState>((set, get) => ({
  // Initial state
  nearbyFeaturedPods: [],
  myFeaturedPods: [],
  currentFeaturedPod: null,
  isLoading: false,
  isJoining: false,
  isLeaving: false,
  error: null,

  /**
   * Fetch nearby featured pods
   */
  fetchNearbyFeaturedPods: async (latitude: number, longitude: number) => {
    set({ isLoading: true, error: null });
    try {
      const response = await featuredPodsApi.getFeaturedPodsNearby(latitude, longitude, 10);
      set({
        nearbyFeaturedPods: response.data,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Error fetching nearby featured pods:', error);
      set({
        error: error.message || 'Failed to fetch featured pods',
        isLoading: false,
      });
    }
  },

  /**
   * Fetch user's joined featured pods
   */
  fetchMyFeaturedPods: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await featuredPodsApi.getMyFeaturedPods();
      set({
        myFeaturedPods: response.data,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Error fetching my featured pods:', error);
      set({
        error: error.message || 'Failed to fetch your featured pods',
        isLoading: false,
      });
    }
  },

  /**
   * Fetch featured pod by ID
   */
  fetchFeaturedPodById: async (featuredPodId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await featuredPodsApi.getFeaturedPodById(featuredPodId);
      set({
        currentFeaturedPod: response.data,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Error fetching featured pod:', error);
      set({
        error: error.message || 'Failed to fetch featured pod',
        isLoading: false,
      });
    }
  },

  /**
   * Join a featured pod
   */
  joinFeaturedPod: async (featuredPodId: string) => {
    if (get().isJoining) return;

    set({ isJoining: true, error: null });
    try {
      const response = await featuredPodsApi.joinFeaturedPod(featuredPodId);

      // Update current pod if it's loaded
      if (get().currentFeaturedPod?.id === featuredPodId) {
        set({ currentFeaturedPod: response.data.featuredPod });
      }

      // Add to my featured pods
      const myPods = get().myFeaturedPods;
      const exists = myPods.some((p) => p.id === featuredPodId);
      if (!exists) {
        set({ myFeaturedPods: [...myPods, response.data.featuredPod] });
      }

      set({ isJoining: false });
    } catch (error: any) {
      console.error('Error joining featured pod:', error);
      set({
        error: error.response?.data?.error || error.message || 'Failed to join featured pod',
        isJoining: false,
      });
      throw error;
    }
  },

  /**
   * Leave a featured pod
   */
  leaveFeaturedPod: async (featuredPodId: string) => {
    if (get().isLeaving) return;

    set({ isLeaving: true, error: null });
    try {
      await featuredPodsApi.leaveFeaturedPod(featuredPodId);

      // Remove from my featured pods
      const myPods = get().myFeaturedPods.filter((p) => p.id !== featuredPodId);
      set({ myFeaturedPods: myPods });

      // Update current pod if it's loaded
      if (get().currentFeaturedPod?.id === featuredPodId) {
        // Refetch to get updated data
        await get().fetchFeaturedPodById(featuredPodId);
      }

      set({ isLeaving: false });
    } catch (error: any) {
      console.error('Error leaving featured pod:', error);
      set({
        error: error.response?.data?.error || error.message || 'Failed to leave featured pod',
        isLeaving: false,
      });
      throw error;
    }
  },

  /**
   * Confirm arrival at featured pod
   */
  confirmArrival: async (featuredPodId: string) => {
    set({ error: null });
    try {
      await featuredPodsApi.confirmArrival(featuredPodId);

      // Refetch featured pod to get updated confirmation status
      if (get().currentFeaturedPod?.id === featuredPodId) {
        await get().fetchFeaturedPodById(featuredPodId);
      }
    } catch (error: any) {
      console.error('Error confirming arrival:', error);
      set({
        error: error.response?.data?.error || error.message || 'Failed to confirm arrival',
      });
      throw error;
    }
  },

  /**
   * Clear error
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * Reset store
   */
  reset: () => {
    set({
      nearbyFeaturedPods: [],
      myFeaturedPods: [],
      currentFeaturedPod: null,
      isLoading: false,
      isJoining: false,
      isLeaving: false,
      error: null,
    });
  },
}));
