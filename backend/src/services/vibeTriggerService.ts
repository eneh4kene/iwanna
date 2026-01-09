import { query } from './database';
import { aiChatService } from './aiChatService';
import { chatService } from './chatService';
import { logger } from '../utils/logger';
import { appConfig } from '../config';

/**
 * @vibe Trigger Service
 * Manages automated @vibe messages based on pod lifecycle
 *
 * Simple, non-intrusive approach:
 * - Stage 1: Ice breaker (30s after pod formation, only if no messages)
 * - Stage 5: Pre-meetup reminder (15 min before expiry)
 *
 * Rate limiting:
 * - Min 2 minutes between @vibe messages
 * - No max message limit (conversations flow naturally)
 */

interface PodContext {
  podId: string;
  activity: string;
  memberCount: number;
  createdAt: Date;
  expiresAt: Date;
  locationName?: string;
}

interface MessageContext {
  messageCount: number;
  lastMessageAt: Date | null;
  vibeMessageCount: number;
  lastVibeMessageAt: Date | null;
  recentMessages: Array<{ username: string; content: string }>;
}

const VIBE_USER_ID = '00000000-0000-0000-0000-000000000000'; // Special UUID for @vibe
const VIBE_USERNAME = '@vibe';

class VibeTriggerService {
  /**
   * Check if @vibe should send an ice breaker message
   * Triggers 30 seconds after pod formation if no human messages
   */
  async checkIcebreaker(podId: string): Promise<void> {
    try {
      const podContext = await this.getPodContext(podId);
      if (!podContext) return;

      const messageContext = await this.getMessageContext(podId);

      // Stage 1: Ice breaker conditions
      const podAgeMinutes = this.getPodAgeMinutes(podContext);
      const shouldSendIcebreaker =
        podAgeMinutes >= 0.5 && // 30 seconds
        podAgeMinutes < 2 && // Within first 2 minutes
        messageContext.messageCount === 0 && // No human messages yet
        messageContext.vibeMessageCount === 0; // @vibe hasn't spoken yet

      if (!shouldSendIcebreaker) return;

      // Check rate limit
      if (!this.canSendMessage(messageContext, podContext)) {
        logger.info(`@vibe rate limited for pod ${podId}`);
        return;
      }

      // Generate and send icebreaker
      const message = await aiChatService.generateIcebreaker(
        podContext.activity,
        podContext.memberCount,
        podContext.locationName
      );

      await this.sendVibeMessage(podId, message);
      logger.info(`@vibe sent icebreaker to pod ${podId}`);
    } catch (error) {
      logger.error('Error in checkIcebreaker:', error);
    }
  }

  // Momentum builder removed - letting conversations flow naturally

  /**
   * Check if @vibe should send a pre-meetup reminder
   * Triggers 15 minutes before pod expires
   */
  async checkPreMeetupReminder(podId: string): Promise<void> {
    try {
      const podContext = await this.getPodContext(podId);
      if (!podContext) return;

      const messageContext = await this.getMessageContext(podId);

      // Stage 5: Pre-meetup reminder conditions
      const minutesUntilExpiry = this.getMinutesUntilExpiry(podContext);

      const shouldSendReminder =
        minutesUntilExpiry <= 15 &&
        minutesUntilExpiry > 0 &&
        !this.hasRecentVibeMessage(messageContext, 10) && // No @vibe message in last 10 min
        this.canSendMessage(messageContext, podContext);

      if (!shouldSendReminder) return;

      const message = `heading out soon? ${Math.floor(minutesUntilExpiry)} min left`;
      await this.sendVibeMessage(podId, message);
      logger.info(`@vibe sent pre-meetup reminder to pod ${podId}`);
    } catch (error) {
      logger.error('Error in checkPreMeetupReminder:', error);
    }
  }

  /**
   * Process all pending triggers for a pod
   * Called periodically by worker or on new message events
   */
  async processPodTriggers(podId: string): Promise<void> {
    try {
      // Only check icebreaker and pre-meetup reminder
      await this.checkIcebreaker(podId);
      await this.checkPreMeetupReminder(podId);
    } catch (error) {
      logger.error(`Error processing triggers for pod ${podId}:`, error);
    }
  }

  /**
   * Process triggers for all active pods
   * Called by background worker every 30 seconds
   */
  async processAllActivePods(): Promise<void> {
    try {
      const result = await query<{ id: string }>(
        `SELECT id FROM pods
         WHERE status = 'active'
         AND expires_at > NOW()
         ORDER BY created_at DESC`
      );

      for (const row of result.rows) {
        await this.processPodTriggers(row.id);
      }

      logger.debug(`Processed @vibe triggers for ${result.rows.length} active pods`);
    } catch (error) {
      logger.error('Error processing all active pods:', error);
    }
  }

  /**
   * Send a message as @vibe
   */
  private async sendVibeMessage(podId: string, content: string): Promise<void> {
    try {
      // Use chatService to send AI message as @vibe
      await chatService.sendAiMessage(podId, content);
    } catch (error) {
      logger.error('Error sending @vibe message:', error);
      throw error;
    }
  }

  /**
   * Get pod context (activity, members, timing)
   */
  private async getPodContext(podId: string): Promise<PodContext | null> {
    try {
      const result = await query<PodContext>(
        `SELECT
          id as "podId",
          shared_intent->>'activity' as "activity",
          array_length(user_ids, 1) as "memberCount",
          created_at as "createdAt",
          expires_at as "expiresAt",
          meeting_place_name as "locationName"
         FROM pods
         WHERE id = $1 AND status = 'active'`,
        [podId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting pod context:', error);
      return null;
    }
  }

  /**
   * Get message context (counts, timing, recent messages)
   */
  private async getMessageContext(podId: string): Promise<MessageContext> {
    try {
      // Get message counts and timing
      const countResult = await query<{
        totalMessages: string;
        vibeMessages: string;
        lastMessageAt: Date | null;
        lastVibeMessageAt: Date | null;
      }>(
        `SELECT
          COUNT(*) FILTER (WHERE message_type != 'ai') as "totalMessages",
          COUNT(*) FILTER (WHERE message_type = 'ai') as "vibeMessages",
          MAX(created_at) FILTER (WHERE message_type != 'ai') as "lastMessageAt",
          MAX(created_at) FILTER (WHERE message_type = 'ai') as "lastVibeMessageAt"
         FROM chat_messages
         WHERE pod_id = $1`,
        [podId]
      );

      const counts = countResult.rows[0] || {
        totalMessages: '0',
        vibeMessages: '0',
        lastMessageAt: null,
        lastVibeMessageAt: null,
      };

      // Get recent messages for context (exclude AI messages)
      const recentResult = await query<{ username: string; content: string }>(
        `SELECT u.username, cm.content
         FROM chat_messages cm
         LEFT JOIN users u ON cm.user_id = u.id
         WHERE cm.pod_id = $1 AND cm.message_type != 'ai'
         ORDER BY cm.created_at DESC
         LIMIT 5`,
        [podId]
      );

      return {
        messageCount: Number(counts.totalMessages),
        vibeMessageCount: Number(counts.vibeMessages),
        lastMessageAt: counts.lastMessageAt,
        lastVibeMessageAt: counts.lastVibeMessageAt,
        recentMessages: recentResult.rows.reverse(), // Oldest first
      };
    } catch (error) {
      logger.error('Error getting message context:', error);
      return {
        messageCount: 0,
        vibeMessageCount: 0,
        lastMessageAt: null,
        lastVibeMessageAt: null,
        recentMessages: [],
      };
    }
  }

  /**
   * Check if @vibe can send a message (rate limiting)
   */
  private canSendMessage(context: MessageContext, _podContext: PodContext): boolean {
    // Only enforce minimum interval between @vibe messages (default 2 min)
    // No max message limit - @vibe can send as many as needed
    if (context.lastVibeMessageAt) {
      const minutesSinceLastVibe = this.getMinutesSince(context.lastVibeMessageAt);
      if (minutesSinceLastVibe < appConfig.vibeMinIntervalMinutes) {
        logger.debug(`@vibe interval too short: ${minutesSinceLastVibe.toFixed(1)} min < ${appConfig.vibeMinIntervalMinutes} min`);
        return false;
      }
    }

    return true;
  }

  /**
   * Check if @vibe sent a message recently
   */
  private hasRecentVibeMessage(context: MessageContext, withinMinutes: number): boolean {
    if (!context.lastVibeMessageAt) return false;
    const minutesSince = this.getMinutesSince(context.lastVibeMessageAt);
    return minutesSince < withinMinutes;
  }

  /**
   * Get pod age in minutes
   */
  private getPodAgeMinutes(context: PodContext): number {
    const now = new Date();
    const ageMs = now.getTime() - context.createdAt.getTime();
    return ageMs / 60000;
  }

  /**
   * Get minutes until pod expires
   */
  private getMinutesUntilExpiry(context: PodContext): number {
    const now = new Date();
    const diffMs = context.expiresAt.getTime() - now.getTime();
    return diffMs / 60000;
  }

  /**
   * Get minutes since last human message
   * (Currently unused but kept for potential future features)
   */
  // private _getMinutesSinceLastMessage(context: MessageContext): number {
  //   if (!context.lastMessageAt) return Infinity;
  //   return this.getMinutesSince(context.lastMessageAt);
  // }

  /**
   * Get minutes since a timestamp
   */
  private getMinutesSince(timestamp: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    return diffMs / 60000;
  }
}

export const vibeTriggerService = new VibeTriggerService();
export { VIBE_USER_ID, VIBE_USERNAME };
