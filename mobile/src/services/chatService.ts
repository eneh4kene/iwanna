import { apiClient as api } from './api';

/**
 * Attachment types
 */
export interface ImageAttachment {
  type: 'image';
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

export interface GifAttachment {
  type: 'gif';
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  gifId?: string; // Giphy/Tenor ID
}

export interface EmojiAttachment {
  type: 'emoji';
  emoji: string;
  unicode?: string;
}

export type Attachment = ImageAttachment | GifAttachment | EmojiAttachment;

/**
 * Chat message interface
 */
export interface ChatMessage {
  id: string;
  podId: string;
  userId: string;
  username: string;
  content: string;
  messageType: 'user' | 'system' | 'ai';
  attachments?: Attachment[];
  replyTo?: {
    messageId: string;
    username: string;
    content: string; // Preview of original message
  };
  createdAt: string;
}

/**
 * Chat Service
 * Manages pod chat messages via API
 */
class ChatService {
  /**
   * Send a message to a pod
   */
  async sendMessage(
    podId: string,
    content: string,
    attachments?: Attachment[],
    replyToMessageId?: string
  ): Promise<ChatMessage> {
    const response = await api.post<{
      success: boolean;
      data: { message: ChatMessage };
    }>(`/pods/${podId}/messages`, { content, attachments, replyToMessageId });

    if (!response.success || !response.data) {
      throw new Error('Failed to send message');
    }

    return response.data.message;
  }

  /**
   * Upload an image attachment
   */
  async uploadImage(podId: string, imageUri: string): Promise<ImageAttachment> {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'image.jpg',
    } as any);

    const response = await api.post<{
      success: boolean;
      data: { attachment: ImageAttachment };
    }>(`/pods/${podId}/attachments/image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to upload image');
    }

    return response.data.attachment;
  }

  /**
   * Get chat messages for a pod
   */
  async getMessages(podId: string, limit: number = 50): Promise<ChatMessage[]> {
    const response = await api.get<{
      success: boolean;
      data: {
        messages: ChatMessage[];
        count: number;
      };
    }>(`/pods/${podId}/messages?limit=${limit}`);

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch messages');
    }

    return response.data.messages;
  }
}

export const chatService = new ChatService();
