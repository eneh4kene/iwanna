import { Server as SocketServer } from 'socket.io';
import { logger } from '../utils/logger';
import { Pod } from './podService';

/**
 * Pod member information for notifications
 */
interface PodMember {
  userId: string;
  username: string;
}

/**
 * Notification Service
 * Handles real-time notifications via WebSocket
 */
class NotificationService {
  private io: SocketServer | null = null;

  /**
   * Initialize the notification service with Socket.IO server
   */
  initialize(io: SocketServer): void {
    this.io = io;
    logger.info('Notification service initialized');
  }

  /**
   * Notify all members when a pod is formed
   */
  async notifyPodFormed(pod: Pod, members: PodMember[]): Promise<void> {
    if (!this.io) {
      logger.warn('Socket.IO not initialized, cannot send notifications');
      return;
    }

    const memberUsernames = members.map(m => m.username);

    // Prepare notification payload
    const notification = {
      podId: pod.id,
      members: memberUsernames,
      memberCount: members.length,
      activity: pod.sharedIntent.activity || 'group activity',
      category: pod.sharedIntent.category || 'social',
      location: {
        latitude: pod.centroid.latitude,
        longitude: pod.centroid.longitude,
      },
      expiresAt: pod.expiresAt,
      createdAt: pod.createdAt,
    };

    // Send to each member's personal room
    for (const userId of pod.userIds) {
      this.io.to(`user:${userId}`).emit('pod.formed', notification);
      logger.info('Sent pod.formed notification', { userId, podId: pod.id });
    }
  }

  /**
   * Notify remaining members when someone joins a pod
   */
  async notifyMemberJoined(
    podId: string,
    newMember: PodMember,
    existingMemberIds: string[]
  ): Promise<void> {
    if (!this.io) return;

    const notification = {
      podId,
      userId: newMember.userId,
      username: newMember.username,
      timestamp: new Date(),
    };

    // Notify existing members
    for (const userId of existingMemberIds) {
      this.io.to(`user:${userId}`).emit('pod.member_joined', notification);
    }

    // Also broadcast to pod room
    this.io.to(`pod:${podId}`).emit('pod.member_joined', notification);

    logger.info('Sent member_joined notification', {
      podId,
      newMember: newMember.username,
    });
  }

  /**
   * Notify remaining members when someone leaves a pod
   */
  async notifyMemberLeft(
    podId: string,
    userId: string,
    username: string,
    remainingMemberIds: string[]
  ): Promise<void> {
    if (!this.io) return;

    const notification = {
      podId,
      userId,
      username,
      timestamp: new Date(),
    };

    // Notify remaining members
    for (const memberId of remainingMemberIds) {
      this.io.to(`user:${memberId}`).emit('pod.member_left', notification);
    }

    // Also broadcast to pod room
    this.io.to(`pod:${podId}`).emit('pod.member_left', notification);

    logger.info('Sent member_left notification', {
      podId,
      leavingUser: username,
      remainingCount: remainingMemberIds.length,
    });
  }

  /**
   * Notify all pod members that the pod is expiring soon
   */
  async notifyPodExpiringSoon(
    podId: string,
    memberIds: string[],
    minutesRemaining: number
  ): Promise<void> {
    if (!this.io) return;

    const notification = {
      podId,
      minutesRemaining,
      timestamp: new Date(),
    };

    // Notify all members
    for (const userId of memberIds) {
      this.io.to(`user:${userId}`).emit('pod.expiring_soon', notification);
    }

    this.io.to(`pod:${podId}`).emit('pod.expiring_soon', notification);

    logger.info('Sent expiring_soon notification', {
      podId,
      minutesRemaining,
    });
  }

  /**
   * Notify all pod members that the pod has expired
   */
  async notifyPodExpired(podId: string, memberIds: string[]): Promise<void> {
    if (!this.io) return;

    const notification = {
      podId,
      timestamp: new Date(),
    };

    // Notify all members
    for (const userId of memberIds) {
      this.io.to(`user:${userId}`).emit('pod.expired', notification);
    }

    this.io.to(`pod:${podId}`).emit('pod.expired', notification);

    logger.info('Sent pod_expired notification', { podId });
  }

  /**
   * Notify all pod members that the pod was completed
   */
  async notifyPodCompleted(
    podId: string,
    memberIds: string[],
    completedBy: string
  ): Promise<void> {
    if (!this.io) return;

    const notification = {
      podId,
      completedBy,
      timestamp: new Date(),
    };

    // Notify all members
    for (const userId of memberIds) {
      this.io.to(`user:${userId}`).emit('pod.completed', notification);
    }

    this.io.to(`pod:${podId}`).emit('pod.completed', notification);

    logger.info('Sent pod_completed notification', { podId, completedBy });
  }

  /**
   * Notify pod members of a new chat message
   */
  async notifyChatMessage(
    message: {
      id: string;
      podId: string;
      userId: string;
      username?: string;
      content: string;
      messageType: 'user' | 'system' | 'ai';
      attachments?: any[];
      replyTo?: {
        messageId: string;
        username: string;
        content: string;
      };
      createdAt: Date;
    },
    memberIds: string[]
  ): Promise<void> {
    if (!this.io) {
      logger.warn('Socket.IO not initialized, cannot send chat message notification');
      return;
    }

    const notification: any = {
      id: message.id,
      podId: message.podId,
      userId: message.userId,
      username: message.username || 'Unknown',
      content: message.content,
      messageType: message.messageType,
      createdAt: message.createdAt instanceof Date
        ? message.createdAt.toISOString()
        : typeof message.createdAt === 'string'
          ? message.createdAt
          : new Date().toISOString(),
    };

    // Include attachments if present
    if (message.attachments && message.attachments.length > 0) {
      notification.attachments = message.attachments;
    }

    // Include replyTo if present
    if (message.replyTo) {
      notification.replyTo = message.replyTo;
    }

    // Notify all pod members (including sender for confirmation)
    for (const userId of memberIds) {
      this.io.to(`user:${userId}`).emit('chat.message', notification);
    }

    // Also broadcast to pod room
    this.io.to(`pod:${message.podId}`).emit('chat.message', notification);

    logger.info('Sent chat message notification', {
      podId: message.podId,
      messageId: message.id,
      messageType: message.messageType,
      memberCount: memberIds.length,
      createdAt: notification.createdAt,
    });
  }

  /**
   * Notify pod members when someone confirms arrival
   */
  async notifyMemberConfirmed(
    podId: string,
    userId: string,
    username: string,
    memberIds: string[],
    confirmedCount: number,
    totalCount: number
  ): Promise<void> {
    if (!this.io) return;

    const notification = {
      podId,
      userId,
      username,
      confirmedCount,
      totalCount,
      timestamp: new Date(),
    };

    // Notify all pod members
    for (const memberId of memberIds) {
      this.io.to(`user:${memberId}`).emit('pod.member_confirmed', notification);
    }

    // Also broadcast to pod room
    this.io.to(`pod:${podId}`).emit('pod.member_confirmed', notification);

    logger.info('Sent member_confirmed notification', {
      podId,
      username,
      confirmedCount,
      totalCount,
    });
  }

  /**
   * Send a notification to a specific user
   */
  emitToUser(userId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Broadcast a notification to a pod room
   */
  emitToPod(podId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`pod:${podId}`).emit(event, data);
  }

  /**
   * Get online user count (for debugging/admin)
   */
  getOnlineUserCount(): number {
    if (!this.io) return 0;
    return this.io.sockets.sockets.size;
  }

  /**
   * Check if a user is currently connected
   */
  isUserOnline(userId: string): boolean {
    if (!this.io) return false;

    // Check if any socket is in the user's room
    const room = this.io.sockets.adapter.rooms.get(`user:${userId}`);
    return room !== undefined && room.size > 0;
  }
}

export const notificationService = new NotificationService();
