/**
 * User account tiers
 */
export type AccountTier = 'anonymous' | 'email' | 'authenticated';

/**
 * User object
 */
export interface User {
  id: string;
  username: string;
  accountTier: AccountTier;
  trustScore: number;
}

/**
 * Device information
 */
export interface DeviceInfo {
  platform: 'ios' | 'android';
  osVersion: string;
  appVersion: string;
  deviceModel?: string;
}

/**
 * Authentication result from account creation
 */
export interface CreateAccountResult {
  userId: string;
  username: string;
  token: string;
  refreshToken: string;
  recoveryPhrase: string;
  accountTier: AccountTier;
}

/**
 * Authentication result from recovery
 */
export interface RecoverAccountResult {
  userId: string;
  username: string;
  token: string;
  refreshToken: string;
}

/**
 * AI-parsed intent from wanna
 */
export interface Intent {
  activity: string;
  category: 'food_social' | 'outdoors' | 'creative' | 'sports' | 'conversation' | 'entertainment' | 'nightlife';
  energyLevel: 'low' | 'medium' | 'high';
  socialPreference: 'intimate' | 'small_group' | 'open';
  timeSensitivity: 'now' | 'today' | 'flexible';
  durationEstimate: number;
  locationFlexibility: 'specific' | 'neighborhood' | 'city_wide';
  venueType?: string;
  keywords: string[];
  emotionalTone: string;
  confidence: number;
}

/**
 * Location coordinates
 */
export interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * Wanna object
 */
export interface Wanna {
  id: string;
  text: string;
  moodEmoji?: string;
  intent: Intent;
  locationName: string;
  status: 'active' | 'matching' | 'matched' | 'expired';
  createdAt: string;
  expiresAt: string;
}

/**
 * Input for creating a wanna
 */
export interface CreateWannaInput {
  text: string;
  moodEmoji?: string;
  location: Location;
}

/**
 * API error response
 */
export interface ApiError {
  success: false;
  error: string;
  message?: string;
}

/**
 * API success response
 */
export interface ApiSuccess<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

/**
 * Generic API response
 */
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
