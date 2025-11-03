import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/config';

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
      // Get auth token
      const token = await SecureStore.getItemAsync('authToken');
      if (!token) {
        console.error('No auth token found for WebSocket connection');
        this.isConnecting = false;
        return;
      }

      // Create socket connection
      this.socket = io(API_BASE_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        timeout: 10000,
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
        console.error('WebSocket connection error:', error.message);
        this.reconnectAttempts++;
        this.isConnecting = false;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Max reconnection attempts reached');
          this.disconnect();
        }
      });

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
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
}

export const socketService = new SocketService();
