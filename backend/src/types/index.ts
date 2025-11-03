import { Request } from 'express';

/**
 * Authenticated user attached to requests
 */
export interface AuthenticatedUser {
  id: string;
  username: string;
  accountTier: 'anonymous' | 'email' | 'authenticated';
  trustScore: number;
  isBanned: boolean;
  wannasToday: number;
  lastActiveAt: Date;
}

/**
 * Extended Express Request with user
 */
export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  userId?: string;
}

/**
 * Device information for authentication
 */
export interface DeviceInfo {
  platform: 'ios' | 'android';
  osVersion: string;
  appVersion: string;
  deviceModel?: string | undefined;
}

/**
 * User account tiers
 */
export type AccountTier = 'anonymous' | 'email' | 'authenticated';

/**
 * AI-parsed intent from wanna
 */
export interface Intent {
  activity: string;
  category: 'food_social' | 'outdoors' | 'creative' | 'sports' | 'conversation' | 'entertainment' | 'nightlife';
  energyLevel: 'low' | 'medium' | 'high';
  socialPreference: 'intimate' | 'small_group' | 'open';
  timeSensitivity: 'now' | 'today' | 'flexible';
  durationEstimate: number; // minutes
  locationFlexibility: 'specific' | 'neighborhood' | 'city_wide';
  venueType?: string | undefined;
  keywords: string[];
  emotionalTone: string;
  confidence: number; // 0-1
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
 * Location context from reverse geocoding
 */
export interface LocationContext {
  city: string;
  neighborhood: string;
  country: string;
  formatted: string;
}

/**
 * Wanna (user desire)
 */
export interface Wanna {
  id: string;
  userId: string;
  rawInput: string;
  moodEmoji?: string;
  intent: Intent;
  embedding: number[];
  location: Location;
  locationName: string;
  status: 'active' | 'matching' | 'matched' | 'expired' | 'cancelled';
  createdAt: Date;
  expiresAt: Date;
  matchedAt?: Date;
}

/**
 * Pod (matched group)
 */
export interface Pod {
  id: string;
  status: 'forming' | 'active' | 'completed' | 'expired';
  vibeSummary?: string;
  collectiveIntent?: Record<string, unknown>;
  centroidLocation?: Location;
  suggestedVenues?: unknown[];
  createdAt: Date;
  expiresAt: Date;
  completedAt?: Date;
}

/**
 * Database query result
 */
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/**
 * API response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Error with status code
 */
export class AppError extends Error {
  public override message: string;
  public statusCode: number;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
