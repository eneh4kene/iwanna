import { create } from 'zustand';
import * as Location from 'expo-location';
import { apiClient } from '../services/api';
import { Wanna, CreateWannaInput } from '../types';

/**
 * Wanna store state
 */
interface WannaState {
  // State
  activeWannas: Wanna[];
  isCreating: boolean;
  isLoading: boolean;
  error: string | null;

  // Rate limiting
  remaining: number;
  accountTier: string;

  // Actions
  createWanna: (text: string, moodEmoji?: string) => Promise<void>;
  getActiveWannas: () => Promise<void>;
  cancelWanna: (wannaId: string) => Promise<void>;
  clearError: () => void;
}

/**
 * Get current location
 */
const getCurrentLocation = async (): Promise<CreateWannaInput['location']> => {
  // Request permission
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    throw new Error('Location permission not granted');
  }

  // Get location
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy || 100,
  };
};

/**
 * Wanna store
 */
export const useWannaStore = create<WannaState>((set, get) => ({
  // Initial state
  activeWannas: [],
  isCreating: false,
  isLoading: false,
  error: null,
  remaining: 5,
  accountTier: 'anonymous',

  /**
   * Create a new wanna
   */
  createWanna: async (text: string, moodEmoji?: string) => {
    // Prevent duplicate submissions
    if (get().isCreating) {
      console.log('Wanna creation already in progress, ignoring duplicate request');
      return;
    }

    set({ isCreating: true, error: null });

    try {
      // Get current location
      const location = await getCurrentLocation();

      // Create wanna
      const response = await apiClient.post<{
        success: boolean;
        wanna: {
          id: string;
          intent: any;
          locationName: string;
          expiresAt: string;
          remaining: number;
        };
        message: string;
      }>('/wannas', {
        text,
        moodEmoji,
        location,
      });

      // Update remaining count
      set({ remaining: response.wanna.remaining });

      // Refresh active wannas
      await get().getActiveWannas();

      set({ isCreating: false });
    } catch (error: any) {
      const message =
        error.response?.data?.error || error.message || 'Failed to create wanna';

      set({
        error: message,
        isCreating: false,
      });

      throw new Error(message);
    }
  },

  /**
   * Get user's active wannas
   */
  getActiveWannas: async () => {
    set({ isLoading: true });

    try {
      const response = await apiClient.get<{
        success: boolean;
        wannas: Wanna[];
      }>('/wannas/active');

      set({
        activeWannas: response.wannas,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Failed to fetch wannas:', error);
      set({ isLoading: false });
    }
  },

  /**
   * Cancel a wanna
   */
  cancelWanna: async (wannaId: string) => {
    try {
      await apiClient.delete(`/wannas/${wannaId}`);

      // Remove from local state
      set((state) => ({
        activeWannas: state.activeWannas.filter((w) => w.id !== wannaId),
      }));
    } catch (error: any) {
      const message =
        error.response?.data?.error || error.message || 'Failed to cancel wanna';

      set({ error: message });
      throw new Error(message);
    }
  },

  /**
   * Clear error
   */
  clearError: () => set({ error: null }),
}));
