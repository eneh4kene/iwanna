import { query } from './database';
import { notificationService } from './notificationService';
import { aiChatService } from './aiChatService';
import { vibeOrchestrator } from './vibe/vibeOrchestrator';
import { logger } from '../utils/logger';
import { AppError } from '../types';

/**
 * Attachment interface
 */
export interface Attachment {
  type: 'image' | 'gif' | 'emoji';
  url?: string;
  emoji?: string;
  gifId?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

/**
 * Chat message interface
 */
export interface ChatMessage {
  id: string;
  podId: string;
  userId: string;
  username?: string; // Populated when fetching with user data
  content: string;
  messageType: 'user' | 'system' | 'ai';
  attachments?: Attachment[];
  replyTo?: {
    messageId: string;
    username: string;
    content: string;
  };
  createdAt: Date;
}

/**
 * Chat Service
 * Manages pod chat messages
 */
class ChatService {
  /**
   * Send a message to a pod
   */
  async sendMessage(
    podId: string,
    userId: string,
    content: string,
    attachments?: Array<{
      type: 'image' | 'gif' | 'emoji';
      url?: string;
      emoji?: string;
      gifId?: string;
      thumbnailUrl?: string;
      width?: number;
      height?: number;
    }>,
    replyToMessageId?: string
  ): Promise<ChatMessage> {
    // Validate that message has either content or attachments
    const hasContent = content && content.trim().length > 0;
    const hasAttachments = attachments && attachments.length > 0;
    
    if (!hasContent && !hasAttachments) {
      throw new AppError('Message must have content or attachments', 400);
    }

    if (content && content.length > 500) {
      throw new AppError('Message too long (max 500 characters)', 400);
    }

    // Check if user is member of pod and get user_ids for notifications
    let podCheck;
    try {
      podCheck = await query<{ user_ids: string[] }>(
        'SELECT user_ids FROM pods WHERE id = $1',
        [podId]
      );
    } catch (error) {
      logger.error('Database query failed when checking pod existence in sendMessage', {
        podId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AppError('Failed to validate pod', 500);
    }

    if (podCheck.rows.length === 0) {
      throw new AppError('Pod not found', 404);
    }

    const podUserIds = Array.isArray(podCheck.rows[0]?.user_ids) 
      ? podCheck.rows[0].user_ids 
      : [];

    // Check membership using PostgreSQL ANY operator
    let membershipCheck;
    try {
      membershipCheck = await query<{ exists: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM pods WHERE id = $1 AND $2 = ANY(user_ids)) as exists',
        [podId, userId]
      );
    } catch (error) {
      logger.error('Database query failed when checking membership in sendMessage', {
        podId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AppError('Failed to validate pod membership', 500);
    }

    if (!membershipCheck.rows[0]?.exists) {
      throw new AppError('You are not a member of this pod', 403);
    }

    // Prepare metadata for attachments and reply
    const messageMetadata: Record<string, any> = {};
    if (attachments && attachments.length > 0) {
      messageMetadata['attachments'] = attachments;
    }
    if (replyToMessageId) {
      // Fetch the message being replied to for context
      const replyToMessage = await query<{
        id: string;
        user_id: string;
        content: string;
        username: string;
      }>(
        `SELECT cm.id, cm.user_id, cm.content, u.username
         FROM chat_messages cm
         LEFT JOIN users u ON cm.user_id = u.id
         WHERE cm.id = $1 AND cm.pod_id = $2`,
        [replyToMessageId, podId]
      );

      if (replyToMessage.rows.length > 0 && replyToMessage.rows[0]) {
        const replyMsg = replyToMessage.rows[0];
        messageMetadata['replyTo'] = {
          messageId: replyMsg.id,
          username: replyMsg.username || 'Unknown',
          content: replyMsg.content.slice(0, 100), // Truncate to 100 chars for preview
        };
      }
    }

    // Insert message
    let result;
    try {
      result = await query<{
        id: string;
        pod_id: string;
        user_id: string;
        content: string;
        message_type: 'user' | 'system' | 'ai';
        metadata: Record<string, any>;
        created_at: Date;
      }>(
        `INSERT INTO chat_messages (pod_id, user_id, content, message_type, metadata)
         VALUES ($1, $2, $3, 'user', $4)
         RETURNING id, pod_id, user_id, content, message_type, metadata, created_at`,
        [podId, userId, (content || '').trim(), JSON.stringify(messageMetadata)]
      );
    } catch (error) {
      logger.error('Database query failed when inserting message in sendMessage', {
        podId,
        userId,
        contentLength: content?.length || 0,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new AppError('Failed to send message', 500);
    }

    const message = result.rows[0];
    if (!message) {
      throw new AppError('Failed to send message', 500);
    }

    // Get username for notification
    const userResult = await query<{ username: string }>(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );

    const username = userResult.rows[0]?.username || 'Unknown';

    // Parse attachments and reply from metadata
    let storedMetadata: Record<string, any> = {};
    try {
      if (message.metadata) {
        storedMetadata = typeof message.metadata === 'string'
          ? JSON.parse(message.metadata)
          : (message.metadata || {});
      }
    } catch (err) {
      logger.warn('Failed to parse stored message metadata', { podId, messageId: message.id, error: err });
      storedMetadata = {};
    }
    const storedAttachments = Array.isArray(storedMetadata['attachments'])
      ? storedMetadata['attachments']
      : [];
    const storedReplyTo = storedMetadata['replyTo'];

    const chatMessage: ChatMessage = {
      id: message.id,
      podId: message.pod_id,
      userId: message.user_id,
      ...(username && { username }),
      content: message.content,
      messageType: message.message_type,
      ...(storedAttachments.length > 0 && { attachments: storedAttachments }),
      ...(storedReplyTo && { replyTo: storedReplyTo }),
      createdAt: message.created_at,
    };

    // Notify other pod members via WebSocket
    await notificationService.notifyChatMessage(chatMessage, podUserIds).catch(err => {
      logger.error('Failed to send chat message notification', { podId, error: err });
    });

    logger.info('Chat message sent', { podId, userId, messageLength: content.length });

    // Check if @vibe is mentioned OR if replying to @vibe's message
    const isReplyingToVibe = replyToMessageId ? await this.isReplyToVibeMessage(podId, replyToMessageId) : false;
    const mentionsVibe = this.containsVibeMention(content);

    if (mentionsVibe || isReplyingToVibe) {
      // If @mentioning @vibe (not as a reply), make @vibe reply to this message
      const vibeReplyToId = mentionsVibe && !replyToMessageId ? message.id : replyToMessageId;

      this.handleVibeMention(podId, content, username, vibeReplyToId).catch(err => {
        logger.error('Failed to handle @vibe mention', { podId, error: err });
      });
    }

    return chatMessage;
  }

  /**
   * Get chat messages for a pod
   */
  async getChatMessages(podId: string, userId?: string, limit: number = 50): Promise<ChatMessage[]> {
    // Validate limit
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    // If userId provided, validate pod membership using PostgreSQL ANY operator
    if (userId) {
      try {
        const podCheck = await query<{ exists: boolean }>(
          'SELECT EXISTS(SELECT 1 FROM pods WHERE id = $1 AND $2 = ANY(user_ids)) as exists',
          [podId, userId]
        );

        if (!podCheck.rows[0]?.exists) {
          // Check if pod exists at all
          const podExists = await query<{ exists: boolean }>(
            'SELECT EXISTS(SELECT 1 FROM pods WHERE id = $1) as exists',
            [podId]
          );
          
          if (!podExists.rows[0]?.exists) {
            throw new AppError('Pod not found', 404);
          }
          
          throw new AppError('You are not a member of this pod', 403);
        }
      } catch (error) {
        // If it's already an AppError, rethrow it
        if (error instanceof AppError) {
          throw error;
        }
        // Otherwise, log and wrap it
        logger.error('Error checking pod membership in getChatMessages', {
          podId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new AppError('Failed to validate pod membership', 500);
      }
    }

    let result;
    try {
      result = await query<{
        id: string;
        pod_id: string;
        user_id: string;
        username: string | null;
        content: string;
        message_type: 'user' | 'system' | 'ai';
        metadata: Record<string, any> | null;
        created_at: Date;
      }>(
        `SELECT
          cm.id, cm.pod_id, cm.user_id, cm.content, cm.message_type, cm.metadata, cm.created_at,
          u.username
         FROM chat_messages cm
         LEFT JOIN users u ON cm.user_id = u.id
         WHERE cm.pod_id = $1
         ORDER BY cm.created_at DESC
         LIMIT $2`,
        [podId, safeLimit]
      );
    } catch (error) {
      logger.error('Database query failed in getChatMessages', {
        podId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new AppError('Failed to fetch chat messages', 500);
    }

    return result.rows
      .map(row => {
        // Handle metadata - PostgreSQL JSONB can be null or a parsed object
        let rowMetadata: Record<string, any> = {};
        try {
          if (row.metadata) {
            // If metadata is a string, parse it; otherwise use as-is
            rowMetadata = typeof row.metadata === 'string'
              ? JSON.parse(row.metadata)
              : (row.metadata || {});
          }
        } catch (err) {
          logger.warn('Failed to parse message metadata', { podId, messageId: row.id, error: err });
          rowMetadata = {};
        }

        const rowAttachments = Array.isArray(rowMetadata['attachments'])
          ? rowMetadata['attachments']
          : [];
        const rowReplyTo = rowMetadata['replyTo'];

        const chatMessage: ChatMessage = {
          id: row.id,
          podId: row.pod_id,
          userId: row.user_id,
          ...(row.username && { username: row.username }),
          content: row.content,
          messageType: row.message_type,
          ...(rowAttachments.length > 0 && { attachments: rowAttachments }),
          ...(rowReplyTo && { replyTo: rowReplyTo }),
          createdAt: row.created_at instanceof Date
            ? row.created_at
            : new Date(row.created_at),
        };
        return chatMessage;
      })
      .reverse(); // Reverse to get chronological order (oldest first)
  }

  /**
   * Send a system message to a pod
   */
  async sendSystemMessage(podId: string, content: string): Promise<ChatMessage> {
    // Validate content
    if (!content || content.trim().length === 0) {
      throw new AppError('Message content cannot be empty', 400);
    }

    // Check if pod exists
    const podCheck = await query<{ id: string; user_ids: string[] }>(
      'SELECT id, user_ids FROM pods WHERE id = $1',
      [podId]
    );

    if (podCheck.rows.length === 0) {
      throw new AppError('Pod not found', 404);
    }

    const pod = podCheck.rows[0];
    if (!pod) {
      throw new AppError('Pod not found', 404);
    }

    // Insert system message (user_id can be null for system messages)
    // We'll use the first user_id as a placeholder since the schema requires it
    const systemUserId = pod.user_ids[0];

    const result = await query<{
      id: string;
      pod_id: string;
      user_id: string;
      content: string;
      message_type: 'user' | 'system' | 'ai';
      created_at: Date;
    }>(
      `INSERT INTO chat_messages (pod_id, user_id, content, message_type)
       VALUES ($1, $2, $3, 'system')
       RETURNING id, pod_id, user_id, content, message_type, created_at`,
      [podId, systemUserId, content.trim()]
    );

    const message = result.rows[0];
    if (!message) {
      throw new AppError('Failed to send system message', 500);
    }

    const chatMessage: ChatMessage = {
      id: message.id,
      podId: message.pod_id,
      userId: message.user_id,
      username: 'System',
      content: message.content,
      messageType: message.message_type,
      createdAt: message.created_at,
    };

    // Notify all pod members via WebSocket
    await notificationService.notifyChatMessage(chatMessage, pod.user_ids).catch(err => {
      logger.error('Failed to send system message notification', { podId, error: err });
    });

    logger.info('System message sent', { podId, content });

    return chatMessage;
  }

  /**
   * Send an AI message to a pod
   */
  async sendAiMessage(podId: string, content: string, replyToMessageId?: string): Promise<ChatMessage> {
    // Validate content
    if (!content || content.trim().length === 0) {
      throw new AppError('Message content cannot be empty', 400);
    }

    // Check if pod exists
    const podCheck = await query<{ id: string; user_ids: string[] }>(
      'SELECT id, user_ids FROM pods WHERE id = $1',
      [podId]
    );

    if (podCheck.rows.length === 0) {
      throw new AppError('Pod not found', 404);
    }

    const pod = podCheck.rows[0];
    if (!pod) {
      throw new AppError('Pod not found', 404);
    }

    // Prepare metadata for reply context
    const messageMetadata: Record<string, any> = {};
    if (replyToMessageId) {
      // Fetch the message being replied to for context
      const replyToMessage = await query<{
        id: string;
        user_id: string;
        content: string;
        username: string;
      }>(
        `SELECT cm.id, cm.user_id, cm.content, u.username
         FROM chat_messages cm
         LEFT JOIN users u ON cm.user_id = u.id
         WHERE cm.id = $1 AND cm.pod_id = $2`,
        [replyToMessageId, podId]
      );

      if (replyToMessage.rows.length > 0 && replyToMessage.rows[0]) {
        const replyMsg = replyToMessage.rows[0];
        messageMetadata['replyTo'] = {
          messageId: replyMsg.id,
          username: replyMsg.username || 'Unknown',
          content: replyMsg.content.slice(0, 100), // Truncate to 100 chars for preview
        };
      }
    }

    // Insert AI message (user_id can be null for AI messages)
    // We'll use the first user_id as a placeholder since the schema requires it
    const systemUserId = pod.user_ids[0];

    const result = await query<{
      id: string;
      pod_id: string;
      user_id: string;
      content: string;
      message_type: 'user' | 'system' | 'ai';
      metadata: Record<string, any>;
      created_at: Date;
    }>(
      `INSERT INTO chat_messages (pod_id, user_id, content, message_type, metadata)
       VALUES ($1, $2, $3, 'ai', $4)
       RETURNING id, pod_id, user_id, content, message_type, metadata, created_at`,
      [podId, systemUserId, content.trim(), JSON.stringify(messageMetadata)]
    );

    const message = result.rows[0];
    if (!message) {
      throw new AppError('Failed to send AI message', 500);
    }

    // Parse reply from metadata
    let storedMetadata: Record<string, any> = {};
    try {
      if (message.metadata) {
        storedMetadata = typeof message.metadata === 'string'
          ? JSON.parse(message.metadata)
          : (message.metadata || {});
      }
    } catch (err) {
      logger.warn('Failed to parse AI message metadata', { podId, messageId: message.id, error: err });
      storedMetadata = {};
    }
    const storedReplyTo = storedMetadata['replyTo'];

    const chatMessage: ChatMessage = {
      id: message.id,
      podId: message.pod_id,
      userId: message.user_id,
      username: '@vibe',
      content: message.content,
      messageType: message.message_type,
      ...(storedReplyTo && { replyTo: storedReplyTo }),
      createdAt: message.created_at,
    };

    // Notify all pod members via WebSocket
    await notificationService.notifyChatMessage(chatMessage, pod.user_ids).catch(err => {
      logger.error('Failed to send AI message notification', { podId, error: err });
    });

    logger.info('AI message sent', { podId, content, hasReply: !!replyToMessageId });

    return chatMessage;
  }

  /**
   * Get message count for a pod
   */
  async getMessageCount(podId: string): Promise<number> {
    const result = await query<{ count: number }>(
      'SELECT COUNT(*) as count FROM chat_messages WHERE pod_id = $1',
      [podId]
    );

    return Number(result.rows[0]?.count || 0);
  }

  /**
   * Check if a message contains @vibe mention
   */
  private containsVibeMention(content: string): boolean {
    // Check for @vibe in various forms (case-insensitive)
    const vibeMentionPattern = /@vibe\b/i;
    return vibeMentionPattern.test(content);
  }

  /**
   * Check if a message is from @vibe (AI message type)
   */
  private async isReplyToVibeMessage(podId: string, messageId: string): Promise<boolean> {
    try {
      const result = await query<{ message_type: string }>(
        'SELECT message_type FROM chat_messages WHERE id = $1 AND pod_id = $2',
        [messageId, podId]
      );

      return result.rows[0]?.message_type === 'ai';
    } catch (error) {
      logger.error('Error checking if message is from @vibe', { messageId, podId, error });
      return false;
    }
  }

  /**
   * Handle @vibe mention and generate AI response
   */
  private async handleVibeMention(
    podId: string,
    userMessage: string,
    username: string,
    replyToMessageId?: string
  ): Promise<void> {
    try {
      // Check if AI service is available
      if (!aiChatService.isAvailable()) {
        logger.info('AI service not available, skipping @vibe mention', { podId });
        return;
      }

      // Get pod details for context
      const podResult = await query<{
        id: string;
        activity: string;
        category: string;
        user_ids: string[];
        location: any;
        created_at: Date;
        expires_at: Date;
      }>(
        `SELECT
          id,
          shared_intent->>'activity' as activity,
          shared_intent->>'category' as category,
          user_ids,
          location,
          created_at,
          expires_at
        FROM pods
        WHERE id = $1`,
        [podId]
      );

      if (podResult.rows.length === 0) {
        logger.warn('@vibe mention in non-existent pod', { podId });
        return;
      }

      const pod = podResult.rows[0];
      if (!pod) {
        logger.warn('@vibe mention but pod data is null', { podId });
        return;
      }

      // Get recent messages for context (last 5 messages)
      // Note: No userId validation needed for AI service internal calls
      const recentMessages = await this.getChatMessages(podId, undefined, 5);
      const messageContext = recentMessages.map(msg => ({
        username: msg.username || 'Unknown',
        content: msg.content,
      }));

      // If replying to a message, include that context
      let replyContext = '';
      if (replyToMessageId) {
        const replyToMsg = recentMessages.find(m => m.id === replyToMessageId);
        if (replyToMsg) {
          replyContext = `\n\n[User is replying to this message: "${replyToMsg.username}: ${replyToMsg.content}"]`;
        }
      }

      // Extract user ID from the first member (for rate limiting)
      const userId = pod.user_ids[0];
      if (!userId) {
        logger.warn('@vibe mention in pod with no members', { podId });
        return;
      }

      // Check if this looks like a tool query (contains keywords like "find", "where", "meet", etc.)
      const toolKeywords = /\b(find|where|search|locate|meet|midpoint|middle|nearby|close|around)\b/i;
      const looksLikeToolQuery = toolKeywords.test(userMessage);

      let aiResponse: string;

      if (looksLikeToolQuery) {
        try {
          // Get pod location (extract from PostGIS POINT)
          let podLocation = { latitude: 0, longitude: 0 };
          if (pod.location) {
            // Parse PostGIS POINT format: "POINT(lng lat)" or use coordinates
            const locationStr = typeof pod.location === 'string' ? pod.location : JSON.stringify(pod.location);
            const pointMatch = locationStr.match(/POINT\(([^\s]+)\s+([^\)]+)\)/);
            if (pointMatch && pointMatch[1] && pointMatch[2]) {
              podLocation = {
                longitude: parseFloat(pointMatch[1]),
                latitude: parseFloat(pointMatch[2]),
              };
            }
          }

          // Get pod members with their locations
          const membersResult = await query<{
            user_id: string;
            username: string;
            location: any;
          }>(
            `SELECT u.id as user_id, u.username, u.last_location as location
             FROM users u
             WHERE u.id = ANY($1)`,
            [pod.user_ids]
          );

          const members = membersResult.rows.map(row => ({
            userId: row.user_id,
            username: row.username || 'Unknown',
            location: row.location ? {
              latitude: row.location.coordinates?.[1] || 0,
              longitude: row.location.coordinates?.[0] || 0,
            } : undefined,
          }));

          // Route through vibe orchestrator
          const toolResult = await vibeOrchestrator.processVibeQuery(userMessage, {
            podId,
            userId,
            location: podLocation,
            members,
            activity: pod.activity || 'unknown',
            category: pod.category || 'conversation',
            createdAt: new Date(pod.created_at),
            expiresAt: new Date(pod.expires_at),
          });

          // Use the tool's formatted message
          aiResponse = toolResult.message;

          logger.info('@vibe tool executed successfully', {
            podId,
            username,
            success: toolResult.success,
            metadata: toolResult.metadata,
          });
        } catch (error) {
          logger.error('Error executing @vibe tool, falling back to conversational AI', {
            podId,
            error: error instanceof Error ? error.message : String(error),
          });

          // Fall back to conversational AI
          aiResponse = await aiChatService.generateMentionResponse(
            userMessage + replyContext,
            username,
            pod.activity,
            messageContext
          );
        }
      } else {
        // Regular conversational query - use AI chat service
        aiResponse = await aiChatService.generateMentionResponse(
          userMessage + replyContext,
          username,
          pod.activity,
          messageContext
        );
      }

      // Send AI response as a reply if the user was replying to @vibe
      await this.sendAiMessage(podId, aiResponse, replyToMessageId);

      logger.info('@vibe responded to mention', { podId, username, hasReplyContext: !!replyToMessageId });
    } catch (error) {
      logger.error('Error handling @vibe mention', { podId, error });
      // Don't throw - AI response is nice-to-have, not critical
    }
  }
}

export const chatService = new ChatService();
