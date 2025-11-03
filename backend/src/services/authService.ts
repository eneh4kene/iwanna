import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateMnemonic } from 'bip39';
import crypto from 'crypto';
import { query } from './database';
import { cache } from './redis';
import { jwtConfig, securityConfig, rateLimitConfig } from '../config';
import { logger } from '../utils/logger';
import { DeviceInfo, AccountTier, AppError, RateLimitResult } from '../types';

/**
 * Result from creating anonymous account
 */
interface CreateAnonymousAccountResult {
  userId: string;
  username: string;
  token: string;
  refreshToken: string;
  recoveryPhrase: string; // Only returned once!
}

/**
 * Result from account recovery
 */
interface RecoverAccountResult {
  userId: string;
  username: string;
  token: string;
  refreshToken: string;
}

/**
 * Authentication Service
 */
class AuthService {
  /**
   * Generate anonymous username
   * Format: AdjNoun_4digits (e.g., "CuriousVibe_8234")
   */
  private generateUsername(): string {
    const adjectives = [
      'Curious', 'Vibrant', 'Chill', 'Creative', 'Energetic',
      'Mellow', 'Spontaneous', 'Peaceful', 'Bold', 'Gentle',
      'Warm', 'Cool', 'Bright', 'Calm', 'Lively',
      'Mindful', 'Open', 'Quiet', 'Radiant', 'Serene'
    ];

    const nouns = [
      'Vibe', 'Soul', 'Spirit', 'Mind', 'Heart',
      'Wave', 'Flow', 'Pulse', 'Beat', 'Rhythm',
      'Dream', 'Echo', 'Spark', 'Light', 'Moon',
      'Sun', 'Star', 'Cloud', 'Wind', 'Rain'
    ];

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(1000 + Math.random() * 9000);

    return `${adj}${noun}_${num}`;
  }

  /**
   * Generate device fingerprint for fraud detection
   */
  private generateDeviceFingerprint(deviceInfo: DeviceInfo): string {
    const dataString = JSON.stringify({
      platform: deviceInfo.platform,
      osVersion: deviceInfo.osVersion,
      deviceModel: deviceInfo.deviceModel,
    });

    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Generate JWT access and refresh tokens
   */
  private async generateTokens(
    userId: string,
    accountTier: AccountTier,
    deviceInfo?: DeviceInfo,
    ipAddress?: string
  ): Promise<{ token: string; refreshToken: string }> {
    // Access token (short-lived)
    const token = jwt.sign(
      {
        userId,
        accountTier,
        type: 'access',
      },
      jwtConfig.accessSecret,
      { expiresIn: jwtConfig.accessExpiresIn } as jwt.SignOptions
    );

    // Refresh token (long-lived)
    const refreshTokenValue = uuidv4();
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshTokenValue)
      .digest('hex');

    // Store refresh token in database
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '90 days')`,
      [userId, refreshTokenHash, JSON.stringify(deviceInfo || {}), ipAddress || null]
    );

    const refreshToken = jwt.sign(
      {
        userId,
        tokenId: refreshTokenValue,
        type: 'refresh',
      },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn } as jwt.SignOptions
    );

    return { token, refreshToken };
  }

  /**
   * Create Tier 1 anonymous account
   */
  async createAnonymousAccount(
    deviceInfo: DeviceInfo,
    isOver18: boolean
  ): Promise<CreateAnonymousAccountResult> {
    if (!isOver18) {
      throw new AppError('Must be 18 or older to use Iwanna', 400);
    }

    // Generate unique username (retry up to 10 times if collision)
    let username: string;
    let attempts = 0;

    do {
      username = this.generateUsername();
      const existing = await query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );
      if (existing.rows.length === 0) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new AppError('Unable to generate unique username', 500);
    }

    // Generate recovery phrase (12 words)
    const recoveryPhrase = generateMnemonic(128); // 12 words
    const recoveryPhraseHash = await bcrypt.hash(
      recoveryPhrase.toLowerCase().trim(),
      securityConfig.bcryptRounds
    );

    // Create user
    const userId = uuidv4();
    await query(
      `INSERT INTO users (
        id, username, account_tier, recovery_phrase_hash,
        is_18_plus, age_verified_at, trust_score, rate_limit_reset_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), 100, NOW() + INTERVAL '1 day')`,
      [userId, username, 'anonymous', recoveryPhraseHash, isOver18]
    );

    logger.info('Anonymous account created', { userId, username });

    // Generate tokens
    const { token, refreshToken } = await this.generateTokens(
      userId,
      'anonymous',
      deviceInfo
    );

    return {
      userId,
      username,
      token,
      refreshToken,
      recoveryPhrase, // ONLY TIME THIS IS RETURNED
    };
  }

  /**
   * Recover account using recovery phrase
   */
  async recoverAccount(
    recoveryPhrase: string,
    ipAddress: string,
    deviceInfo: DeviceInfo
  ): Promise<RecoverAccountResult> {
    const normalizedPhrase = recoveryPhrase.toLowerCase().trim();

    // Rate limiting check
    const attemptKey = `recovery_attempts:${ipAddress}`;
    const attempts = await cache.incr(attemptKey);

    if (attempts === 1) {
      await cache.expire(attemptKey, securityConfig.recoveryAttemptWindow * 3600);
    }

    if (attempts > securityConfig.maxRecoveryAttempts) {
      // Log suspicious activity
      await query(
        `INSERT INTO recovery_attempts (attempted_phrase, ip_address, device_info, success)
         VALUES ($1, $2, $3, false)`,
        [normalizedPhrase.substring(0, 50), ipAddress, JSON.stringify(deviceInfo)]
      );

      throw new AppError(
        `Too many recovery attempts. Try again in ${securityConfig.recoveryAttemptWindow} hour(s)`,
        429
      );
    }

    // Find user by recovery phrase
    // NOTE: This is slow but necessary for security
    const users = await query<{
      id: string;
      username: string;
      account_tier: AccountTier;
      recovery_phrase_hash: string;
      is_banned: boolean;
    }>(
      `SELECT id, username, account_tier, recovery_phrase_hash, is_banned
       FROM users
       WHERE recovery_phrase_hash IS NOT NULL AND is_banned = false`
    );

    for (const user of users.rows) {
      const isMatch = await bcrypt.compare(normalizedPhrase, user.recovery_phrase_hash);

      if (isMatch) {
        // Success! Log it
        await query(
          `INSERT INTO recovery_attempts (attempted_phrase, ip_address, device_info, success, user_id)
           VALUES ($1, $2, $3, true, $4)`,
          [normalizedPhrase.substring(0, 50), ipAddress, JSON.stringify(deviceInfo), user.id]
        );

        // Clear rate limit
        await cache.del(attemptKey);

        // Generate new tokens
        const { token, refreshToken } = await this.generateTokens(
          user.id,
          user.account_tier,
          deviceInfo,
          ipAddress
        );

        // Update device fingerprint
        const newFingerprint = this.generateDeviceFingerprint(deviceInfo);
        await query(
          'UPDATE users SET device_fingerprint = $1, last_active_at = NOW() WHERE id = $2',
          [newFingerprint, user.id]
        );

        logger.info('Account recovered', { userId: user.id, username: user.username });

        return {
          userId: user.id,
          username: user.username,
          token,
          refreshToken,
        };
      }
    }

    // No match - log failed attempt
    await query(
      `INSERT INTO recovery_attempts (attempted_phrase, ip_address, device_info, success)
       VALUES ($1, $2, $3, false)`,
      [normalizedPhrase.substring(0, 50), ipAddress, JSON.stringify(deviceInfo)]
    );

    throw new AppError('Invalid recovery phrase', 401);
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ token: string }> {
    try {
      const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret) as {
        userId: string;
        tokenId: string;
        type: string;
      };

      if (decoded.type !== 'refresh') {
        throw new AppError('Invalid token type', 403);
      }

      // Hash the token ID to check database
      const tokenHash = crypto.createHash('sha256').update(decoded.tokenId).digest('hex');

      // Check if refresh token exists and is valid
      const result = await query<{
        user_id: string;
        expires_at: Date;
        revoked: boolean;
      }>(
        `SELECT user_id, expires_at, revoked
         FROM refresh_tokens
         WHERE token_hash = $1 AND user_id = $2`,
        [tokenHash, decoded.userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Invalid refresh token', 401);
      }

      const storedToken = result.rows[0];
      if (!storedToken) {
        throw new AppError('Invalid refresh token', 401);
      }

      if (storedToken.revoked) {
        throw new AppError('Refresh token has been revoked', 401);
      }

      if (new Date(storedToken.expires_at) < new Date()) {
        throw new AppError('Refresh token has expired', 401);
      }

      // Update last used
      await query(
        'UPDATE refresh_tokens SET last_used_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      );

      // Get user for account tier
      const userResult = await query<{
        id: string;
        account_tier: AccountTier;
        is_banned: boolean;
      }>(
        'SELECT id, account_tier, is_banned FROM users WHERE id = $1',
        [decoded.userId]
      );

      const user = userResult.rows[0];
      if (!user || user.is_banned) {
        throw new AppError('User not found or banned', 401);
      }

      // Generate new access token
      if (!user) {
        throw new AppError('User not found', 401);
      }

      const token = jwt.sign(
        {
          userId: user.id,
          accountTier: user.account_tier,
          type: 'access',
        },
        jwtConfig.accessSecret,
        { expiresIn: jwtConfig.accessExpiresIn } as jwt.SignOptions
      );

      return { token };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid refresh token', 401);
    }
  }

  /**
   * Logout (revoke refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret) as {
        tokenId: string;
      };

      const tokenHash = crypto.createHash('sha256').update(decoded.tokenId).digest('hex');

      await query(
        'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      );

      logger.info('User logged out');
    } catch (error) {
      // Silent fail - token might already be invalid
      logger.debug('Logout failed (token may already be invalid)', error);
    }
  }

  /**
   * Check rate limits for wanna creation
   */
  async checkRateLimit(userId: string): Promise<RateLimitResult> {
    const result = await query<{
      account_tier: AccountTier;
      wannas_today: number;
      rate_limit_reset_at: Date;
    }>(
      'SELECT account_tier, wannas_today, rate_limit_reset_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get tier limits
    const limits: Record<AccountTier, number> = {
      anonymous: rateLimitConfig.tier1WannasPerDay,
      email: rateLimitConfig.tier2WannasPerDay,
      authenticated: rateLimitConfig.tier3WannasPerDay,
    };

    const limit = limits[user.account_tier];

    // Reset counter if new day
    const now = new Date();
    const resetTime = user.rate_limit_reset_at ? new Date(user.rate_limit_reset_at) : null;

    if (!resetTime || resetTime < now) {
      await query(
        `UPDATE users
         SET wannas_today = 0, rate_limit_reset_at = NOW() + INTERVAL '1 day'
         WHERE id = $1`,
        [userId]
      );

      return { allowed: true, remaining: limit - 1 };
    }

    // Check limit
    if (user.wannas_today >= limit) {
      return { allowed: false, remaining: 0 };
    }

    return {
      allowed: true,
      remaining: limit - user.wannas_today - 1,
    };
  }

  /**
   * Increment wanna counter
   */
  async incrementWannaCount(userId: string): Promise<void> {
    await query(
      `UPDATE users
       SET wannas_today = wannas_today + 1,
           wannas_created_count = wannas_created_count + 1,
           last_wanna_at = NOW()
       WHERE id = $1`,
      [userId]
    );
  }
}

export const authService = new AuthService();
