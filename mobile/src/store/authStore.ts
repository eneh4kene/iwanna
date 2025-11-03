import { create } from 'zustand';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiClient } from '../services/api';
import {
  User,
  DeviceInfo,
  CreateAccountResult,
  RecoverAccountResult,
} from '../types';

/**
 * Auth store state
 */
interface AuthState {
  // State
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Recovery phrase (only shown once after creation)
  recoveryPhrase: string | null;

  // Actions
  createAccount: (isOver18: boolean) => Promise<void>;
  recoverAccount: (recoveryPhrase: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
  clearRecoveryPhrase: () => void;
}

/**
 * Get device info
 */
const getDeviceInfo = (): DeviceInfo => {
  return {
    platform: Device.osName?.toLowerCase() === 'ios' ? 'ios' : 'android',
    osVersion: Device.osVersion || 'unknown',
    appVersion: Constants.expoConfig?.version || '1.0.0',
    deviceModel: Device.modelName || undefined,
  };
};

/**
 * Auth store
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
  recoveryPhrase: null,

  /**
   * Create Tier 1 anonymous account
   */
  createAccount: async (isOver18: boolean) => {
    set({ isLoading: true, error: null });

    try {
      const deviceInfo = getDeviceInfo();

      const response = await apiClient.post<CreateAccountResult>(
        '/auth/create-anonymous',
        {
          isOver18,
          deviceInfo,
        }
      );

      // Store tokens
      await apiClient.setTokens(response.token, response.refreshToken);

      // Set user and recovery phrase
      set({
        user: {
          id: response.userId,
          username: response.username,
          accountTier: response.accountTier,
          trustScore: 100,
        },
        isAuthenticated: true,
        recoveryPhrase: response.recoveryPhrase, // SHOW ONCE!
        isLoading: false,
      });
    } catch (error: any) {
      const message =
        error.response?.data?.error || error.message || 'Failed to create account';

      set({
        error: message,
        isLoading: false,
      });

      throw new Error(message);
    }
  },

  /**
   * Recover account using recovery phrase
   */
  recoverAccount: async (recoveryPhrase: string) => {
    set({ isLoading: true, error: null });

    try {
      const deviceInfo = getDeviceInfo();

      const response = await apiClient.post<RecoverAccountResult>('/auth/recover', {
        recoveryPhrase,
        deviceInfo,
      });

      // Store tokens
      await apiClient.setTokens(response.token, response.refreshToken);

      // Load full user data
      await get().loadUser();

      set({ isLoading: false });
    } catch (error: any) {
      const message =
        error.response?.data?.error || error.message || 'Failed to recover account';

      set({
        error: message,
        isLoading: false,
      });

      throw new Error(message);
    }
  },

  /**
   * Load current user data
   */
  loadUser: async () => {
    try {
      const isAuth = await apiClient.isAuthenticated();
      if (!isAuth) {
        set({ isAuthenticated: false, user: null });
        return;
      }

      const response = await apiClient.get<{ success: boolean; user: User }>(
        '/auth/me'
      );

      set({
        user: response.user,
        isAuthenticated: true,
      });
    } catch (error: any) {
      console.error('Failed to load user:', error);
      set({ isAuthenticated: false, user: null });
    }
  },

  /**
   * Logout
   */
  logout: async () => {
    try {
      const refreshToken = await apiClient.getRefreshToken();
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await apiClient.clearTokens();
      set({
        user: null,
        isAuthenticated: false,
        recoveryPhrase: null,
      });
    }
  },

  /**
   * Clear error
   */
  clearError: () => set({ error: null }),

  /**
   * Clear recovery phrase (after user has saved it)
   */
  clearRecoveryPhrase: () => set({ recoveryPhrase: null }),
}));
