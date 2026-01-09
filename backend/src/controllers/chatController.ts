import { Response, NextFunction } from 'express';
import { chatService } from '../services/chatService';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import { z } from 'zod';

/**
 * Chat Controller
 * Handles chat message HTTP requests
 */
export class ChatController {
  /**
   * Send a message to a pod
   * POST /api/v1/pods/:podId/messages
   */
  async sendMessage(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const userId = req.userId;
    const { podId } = req.params;
    
    try {
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!podId) {
        res.status(400).json({ success: false, error: 'Pod ID required' });
        return;
      }

      // Validate request body
      const schema = z.object({
        content: z.string().max(500).optional().default(''),
        attachments: z.array(z.object({
          type: z.enum(['image', 'gif', 'emoji']),
          url: z.string().optional(),
          emoji: z.string().optional(),
          gifId: z.string().optional(),
          thumbnailUrl: z.string().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
        })).optional().default([]),
        replyToMessageId: z.string().uuid().optional(),
      });

      const parsed = schema.parse(req.body);
      const content = parsed.content || '';
      const attachments = parsed.attachments || [];
      const replyToMessageId = parsed.replyToMessageId;

      // Validate that message has either content or attachments
      if (!content.trim() && attachments.length === 0) {
        res.status(400).json({ success: false, error: 'Message must have content or attachments' });
        return;
      }

      // Map attachments to match the expected type (remove undefined values)
      const mappedAttachments = attachments.map(att => ({
        type: att.type,
        ...(att.url !== undefined && { url: att.url }),
        ...(att.emoji !== undefined && { emoji: att.emoji }),
        ...(att.gifId !== undefined && { gifId: att.gifId }),
        ...(att.thumbnailUrl !== undefined && { thumbnailUrl: att.thumbnailUrl }),
        ...(att.width !== undefined && { width: att.width }),
        ...(att.height !== undefined && { height: att.height }),
      }));

      // Send message
      const message = await chatService.sendMessage(
        podId,
        userId,
        content,
        mappedAttachments,
        replyToMessageId
      );

      logger.info('Message sent', { userId, podId, messageId: message.id });

      // Convert Date object to ISO string for JSON serialization
      const serializedMessage = {
        ...message,
        createdAt: message.createdAt instanceof Date 
          ? message.createdAt.toISOString() 
          : typeof message.createdAt === 'string' 
            ? message.createdAt 
            : new Date(message.createdAt).toISOString(),
      };

      res.status(201).json({
        success: true,
        data: { message: serializedMessage },
      });
    } catch (error) {
      logger.error('Error in sendMessage controller', {
        podId: podId || 'unknown',
        userId: userId || 'unknown',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      next(error);
    }
  }

  /**
   * Get chat messages for a pod
   * GET /api/v1/pods/:podId/messages
   */
  async getMessages(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const userId = req.userId;
    const { podId } = req.params;
    
    try {
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!podId) {
        res.status(400).json({ success: false, error: 'Pod ID required' });
        return;
      }

      // Optional limit parameter
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 50;

      // Get messages (with user validation)
      const messages = await chatService.getChatMessages(podId, userId, limit);

      // Convert Date objects to ISO strings for JSON serialization
      const serializedMessages = messages.map(msg => ({
        ...msg,
        createdAt: msg.createdAt instanceof Date 
          ? msg.createdAt.toISOString() 
          : typeof msg.createdAt === 'string' 
            ? msg.createdAt 
            : new Date(msg.createdAt).toISOString(),
      }));

      res.json({
        success: true,
        data: {
          messages: serializedMessages,
          count: serializedMessages.length,
        },
      });
    } catch (error) {
      logger.error('Error in getMessages controller', {
        podId: podId || 'unknown',
        userId: userId || 'unknown',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      next(error);
    }
  }
}

export const chatController = new ChatController();
