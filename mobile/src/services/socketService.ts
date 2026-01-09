import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { WS_URL } from '../constants/config';

/**
 * WebSocket event types
 */
export interface PodFormedEvent {
  podId: string;
  members: string[];
  memberCount: number;
  activity: string;
  category: string;
  location: {
    latitude: number;
    longitude: number;
  };
  expiresAt: string;
  createdAt: string;
}

export interface MemberJoinedEvent {
  podId: string;
  userId: string;
  username: string;
  timestamp: string;
}

export interface MemberLeftEvent {
  podId: string;
  userId: string;
  username: string;
  timestamp: string;
}

export interface PodExpiringSoonEvent {
  podId: string;
  minutesRemaining: number;
  timestamp: string;
}

export interface PodExpiredEvent {
  podId: string;
  timestamp: string;
}

export interface PodCompletedEvent {
  podId: string;
  completedBy: string;
  timestamp: string;
}

export interface ChatMessageEvent {
  id: string;
  podId: string;
  userId: string;
  username: string;
  content: string;
  messageType: 'user' | 'system' | 'ai';
  attachments?: any[];
  replyTo?: {
    messageId: string;
    username: string;
    content: string;
  };
  createdAt: string;
}

export interface MemberConfirmedEvent {
  podId: string;
  userId: string;
  username: string;
  confirmedCount: number;
  totalCount: number;
  timestamp: string;
}

/**
 * Socket Service
 * Manages WebSocket connection to backend
 */
class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.socket?.connected || this.isConnecting) {
      console.log('Socket already connected or connecting');
      return;
    }

    this.isConnecting = true;

    try {
      // Get auth token (must match the key used in api.ts)
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) {
        console.error('No auth token found for WebSocket connection');
        this.isConnecting = false;
        return;
      }

      console.log('Connecting to WebSocket...', {
        url: WS_URL,
        hasToken: !!token,
        tokenLength: token.length,
      });

      // Create socket connection
      this.socket = io(WS_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        timeout: 10000,
        forceNew: true, // Force new connection
      });

      // Connection event handlers
      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected', this.socket?.id);
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket disconnected:', reason);
        this.isConnecting = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', {
          message: error.message,
          type: error.type,
          description: error.description,
          context: error.context,
          wsUrl: WS_URL,
          hasToken: !!token,
        });
        this.reconnectAttempts++;
        this.isConnecting = false;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Max reconnection attempts reached', {
            attempts: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
          });
          this.disconnect();
        }
      });

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', {
          error,
          message: error?.message || 'Unknown error',
          type: error?.type || 'Unknown type',
        });
      });

      // Confirmation event
      this.socket.on('connected', (data) => {
        console.log('Server confirmed connection:', data);
      });

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      console.log('Disconnecting WebSocket...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Subscribe to an event
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.socket) {
      console.warn('Socket not initialized, cannot subscribe to event:', event);
      return;
    }
    this.socket.on(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback?: (data: any) => void): void {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }

  /**
   * Emit an event to server
   */
  emit(event: string, data?: any): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot emit event:', event);
      return;
    }
    this.socket.emit(event, data);
  }

  /**
   * Join a pod room
   */
  joinPodRoom(podId: string): void {
    this.emit('join_pod_room', { podId });
  }

  /**
   * Leave a pod room
   */
  leavePodRoom(podId: string): void {
    this.emit('leave_pod_room', { podId });
  }

  /**
   * Get pod status
   */
  getPodStatus(podId: string): void {
    this.emit('get_pod_status', { podId });
  }

  /**
   * Send ping to check connection
   */
  ping(): void {
    this.emit('ping');
  }

  /**
   * Subscribe to pod formed events
   */
  onPodFormed(callback: (data: PodFormedEvent) => void): () => void {
    this.on('pod.formed', callback);
    return () => this.off('pod.formed', callback);
  }

  /**
   * Subscribe to member joined events
   */
  onMemberJoined(callback: (data: MemberJoinedEvent) => void): () => void {
    this.on('pod.member_joined', callback);
    return () => this.off('pod.member_joined', callback);
  }

  /**
   * Subscribe to member left events
   */
  onMemberLeft(callback: (data: MemberLeftEvent) => void): () => void {
    this.on('pod.member_left', callback);
    return () => this.off('pod.member_left', callback);
  }

  /**
   * Subscribe to pod expiring soon events
   */
  onPodExpiringSoon(callback: (data: PodExpiringSoonEvent) => void): () => void {
    this.on('pod.expiring_soon', callback);
    return () => this.off('pod.expiring_soon', callback);
  }

  /**
   * Subscribe to pod expired events
   */
  onPodExpired(callback: (data: PodExpiredEvent) => void): () => void {
    this.on('pod.expired', callback);
    return () => this.off('pod.expired', callback);
  }

  /**
   * Subscribe to pod completed events
   */
  onPodCompleted(callback: (data: PodCompletedEvent) => void): () => void {
    this.on('pod.completed', callback);
    return () => this.off('pod.completed', callback);
  }

  /**
   * Subscribe to chat message events
   */
  onChatMessage(callback: (data: ChatMessageEvent) => void): () => void {
    this.on('chat.message', callback);
    return () => this.off('chat.message', callback);
  }

  /**
   * Subscribe to member confirmed events
   */
  onMemberConfirmed(callback: (data: MemberConfirmedEvent) => void): () => void {
    this.on('pod.member_confirmed', callback);
    return () => this.off('pod.member_confirmed', callback);
  }

  /**
   * Send a chat message
   */
  sendChatMessage(podId: string, content: string): void {
    this.emit('chat.send', { podId, content });
  }

  /**
   * Send typing indicator
   */
  sendTyping(podId: string): void {
    this.emit('chat.typing', { podId });
  }
}

export const socketService = new SocketService();
