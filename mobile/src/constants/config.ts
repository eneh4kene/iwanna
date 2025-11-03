import Constants from 'expo-constants';

/**
 * App configuration
 * Loaded from environment variables (.env file)
 */

// Get API URL from environment variable or use default
export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:3001';

// Get WebSocket URL from environment variable or use default
export const WS_URL =
  Constants.expoConfig?.extra?.wsUrl ||
  process.env.EXPO_PUBLIC_WS_URL ||
  'http://localhost:3001';

// Environment
export const ENV =
  Constants.expoConfig?.extra?.env ||
  process.env.EXPO_PUBLIC_ENV ||
  'development';

// Is production
export const IS_PRODUCTION = ENV === 'production';

// Debug logging
export const DEBUG = ENV === 'development';
