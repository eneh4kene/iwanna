import { create } from 'zustand';
import { socketService, PodFormedEvent, MemberJoinedEvent, MemberLeftEvent, PodExpiringSoonEvent, PodExpiredEvent, PodCompletedEvent, ChatMessageEvent, MemberConfirmedEvent } from '../services/socketService';
import { apiClient as api } from '../services/api';
import { chatService, ChatMessage, Attachment } from '../services/chatService';
import { useAuthStore } from './authStore';

/**
 * Pod member interface
 */
export interface PodMember {
  userId: string;
  username: string;
  joinedAt: string;
}

/**
 * Pod interface
 */
export interface Pod {
  id: string;
  members: PodMember[];
  memberCount: number;
  activity: string;
  category: string;
  location: {
    latitude: number;
    longitude: number;
  };
  meetingPlaceName?: string | null;
  confirmedUserIds?: string[];
  showUpCount?: number;
  expiresAt: string;
  createdAt: string;
  status: 'forming' | 'active' | 'completed' | 'expired';
}

/**
 * Pod store state
 */
interface PodStoreState {
  // State
  activePods: Pod[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;

  // Chat state
  chatMessages: Record<string, ChatMessage[]>; // podId -> messages
  isSendingMessage: Record<string, boolean>; // podId -> sending state

  // Actions
  fetchActivePods: () => Promise<void>;
  addPod: (pod: Pod) => void;
  removePod: (podId: string) => void;
  updatePod: (podId: string, updates: Partial<Pod>) => void;
  leavePod: (podId: string) => Promise<void>;
  completePod: (podId: string) => Promise<void>;

  // Chat actions
  fetchChatMessages: (podId: string) => Promise<void>;
  sendMessage: (podId: string, content: string, attachments?: Attachment[], replyToMessageId?: string) => Promise<void>;
  addChatMessage: (podId: string, message: ChatMessage) => void;

  // Confirmation actions
  confirmArrival: (podId: string) => Promise<void>;
  submitFeedback: (podId: string, showedUp: boolean, rating?: number, comment?: string) => Promise<void>;

  // WebSocket management
  connectSocket: () => Promise<void>;
  disconnectSocket: () => void;
  subscribeToEvents: () => void;
  unsubscribeFromEvents: () => void;

  // Internal
  _unsubscribeFns: Array<() => void>;
}

/**
 * Pod Store
 * Manages pod state and integrates with WebSocket for real-time updates
 */
export const usePodStore = create<PodStoreState>((set, get) => ({
  // Initial state
  activePods: [],
  isLoading: false,
  error: null,
  isConnected: false,
  chatMessages: {},
  isSendingMessage: {},
  _unsubscribeFns: [],

  /**
   * Fetch active pods from API
   */
  fetchActivePods: async (): Promise<void> => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.get<{ success: boolean; data: { pods: Pod[]; count: number } }>('/pods/active');

      if (response.success) {
        set({ activePods: response.data.pods, isLoading: false });

        // Join all active pod rooms
        response.data.pods.forEach(pod => {
          if (pod.status === 'active' || pod.status === 'forming') {
            socketService.joinPodRoom(pod.id);
          }
        });
      } else {
        set({ error: 'Failed to fetch pods', isLoading: false });
      }
    } catch (error) {
      console.error('Error fetching active pods:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch pods',
        isLoading: false
      });
    }
  },

  /**
   * Add a new pod to the store (or update if exists)
   */
  addPod: (pod: Pod): void => {
    set(state => {
      // Check if pod already exists
      const existingIndex = state.activePods.findIndex(p => p.id === pod.id);

      if (existingIndex >= 0) {
        // Pod exists - update it (merge new data with existing)
        console.log('Pod already exists, updating:', pod.id);
        const updatedPods = [...state.activePods];
        updatedPods[existingIndex] = {
          ...updatedPods[existingIndex],
          ...pod,
          // Preserve members if new pod has placeholder data
          members: pod.members[0]?.username === 'Loading...'
            ? updatedPods[existingIndex].members
            : pod.members,
        };
        return {
          activePods: updatedPods,
        };
      }

      // New pod - add it
      return {
        activePods: [...state.activePods, pod],
      };
    });

    // Join the pod room for real-time updates
    socketService.joinPodRoom(pod.id);
  },

  /**
   * Remove a pod from the store
   */
  removePod: (podId: string): void => {
    set(state => ({
      activePods: state.activePods.filter(pod => pod.id !== podId),
    }));

    // Leave the pod room
    socketService.leavePodRoom(podId);
  },

  /**
   * Update a pod in the store
   */
  updatePod: (podId: string, updates: Partial<Pod>): void => {
    set(state => ({
      activePods: state.activePods.map(pod =>
        pod.id === podId ? { ...pod, ...updates } : pod
      ),
    }));
  },

  /**
   * Leave a pod
   */
  leavePod: async (podId: string): Promise<void> => {
    try {
      const response = await api.post<{ success: boolean; message: string }>(`/pods/${podId}/leave`);

      if (response.success) {
        get().removePod(podId);
      } else {
        set({ error: 'Failed to leave pod' });
      }
    } catch (error) {
      console.error('Error leaving pod:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to leave pod'
      });
    }
  },

  /**
   * Mark pod as completed
   */
  completePod: async (podId: string): Promise<void> => {
    try {
      const response = await api.post<{ success: boolean; message: string }>(`/pods/${podId}/complete`);

      if (response.success) {
        get().updatePod(podId, { status: 'completed' });
      } else {
        set({ error: 'Failed to complete pod' });
      }
    } catch (error) {
      console.error('Error completing pod:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to complete pod'
      });
    }
  },

  /**
   * Fetch chat messages for a pod
   */
  fetchChatMessages: async (podId: string): Promise<void> => {
    try {
      const messages = await chatService.getMessages(podId);
      set(state => ({
        chatMessages: {
          ...state.chatMessages,
          [podId]: messages,
        },
      }));
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch messages'
      });
    }
  },

  /**
   * Send a message to a pod
   */
  sendMessage: async (podId: string, content: string, attachments?: Attachment[], replyToMessageId?: string): Promise<void> => {
    // Prevent duplicate sends
    if (get().isSendingMessage[podId]) {
      console.log('Already sending message, ignoring duplicate');
      return;
    }

    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Get current user ID from auth store
    const currentUser = useAuthStore.getState().user;
    const currentUserId = currentUser?.id || 'unknown';
    const currentUsername = currentUser?.username || 'You';

    try {
      set(state => ({
        isSendingMessage: {
          ...state.isSendingMessage,
          [podId]: true,
        },
      }));

      // Get reply context for optimistic message
      let replyToContext: ChatMessage['replyTo'] | undefined;
      if (replyToMessageId) {
        const messages = get().chatMessages[podId] || [];
        const replyToMessage = messages.find(m => m.id === replyToMessageId);
        if (replyToMessage) {
          replyToContext = {
            messageId: replyToMessage.id,
            username: replyToMessage.username || 'Unknown',
            content: replyToMessage.content.slice(0, 100),
          };
        }
      }

      // Optimistically add message to store
      const optimisticMessage: ChatMessage = {
        id: tempId,
        podId,
        userId: currentUserId,
        username: currentUsername,
        content,
        messageType: 'user',
        createdAt: new Date().toISOString(),
        ...(attachments && attachments.length > 0 && { attachments }),
        ...(replyToContext && { replyTo: replyToContext }),
      };
      get().addChatMessage(podId, optimisticMessage);

      // Send message to API
      const message = await chatService.sendMessage(podId, content, attachments, replyToMessageId);

      // Replace optimistic message with real message (in case WebSocket doesn't fire)
      // The WebSocket event handler will also add it, but addChatMessage prevents duplicates
      get().addChatMessage(podId, {
        id: message.id,
        podId: message.podId,
        userId: message.userId,
        username: message.username,
        content: message.content,
        messageType: message.messageType,
        createdAt: message.createdAt,
        ...(message.attachments && { attachments: message.attachments }),
        ...(message.replyTo && { replyTo: message.replyTo }),
      });

      // Remove optimistic message if it still exists
      set(state => {
        const messages = state.chatMessages[podId] || [];
        const filteredMessages = messages.filter(m => m.id !== tempId);
        return {
          chatMessages: {
            ...state.chatMessages,
            [podId]: filteredMessages,
          },
          isSendingMessage: {
            ...state.isSendingMessage,
            [podId]: false,
          },
        };
      });
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove optimistic message on error
      set(state => {
        const messages = state.chatMessages[podId] || [];
        const filteredMessages = messages.filter(m => m.id !== tempId);
        return {
          chatMessages: {
            ...state.chatMessages,
            [podId]: filteredMessages,
          },
          error: error instanceof Error ? error.message : 'Failed to send message',
          isSendingMessage: {
            ...state.isSendingMessage,
            [podId]: false,
          },
        };
      });
    }
  },

  /**
   * Add a chat message to the store (from WebSocket or API)
   */
  addChatMessage: (podId: string, message: ChatMessage): void => {
    set(state => {
      const existingMessages = state.chatMessages[podId] || [];

      // Check if message already exists (prevent duplicates)
      const messageExists = existingMessages.some(m => m.id === message.id);
      if (messageExists) {
        return state;
      }

      return {
        chatMessages: {
          ...state.chatMessages,
          [podId]: [...existingMessages, message],
        },
      };
    });
  },

  /**
   * Confirm arrival at meeting point
   */
  confirmArrival: async (podId: string): Promise<void> => {
    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        data: {
          confirmed: boolean;
          confirmedCount: number;
          totalCount: number;
        };
      }>(`/pods/${podId}/confirm`);

      if (response.success && response.data) {
        // Update pod with new confirmation count
        get().updatePod(podId, {
          showUpCount: response.data.confirmedCount,
        });
      } else {
        set({ error: 'Failed to confirm arrival' });
      }
    } catch (error) {
      console.error('Error confirming arrival:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to confirm arrival'
      });
    }
  },

  /**
   * Submit post-pod feedback
   */
  submitFeedback: async (
    podId: string,
    showedUp: boolean,
    rating?: number,
    comment?: string
  ): Promise<void> => {
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        `/pods/${podId}/feedback`,
        {
          showedUp,
          rating,
          comment,
        }
      );

      if (!response.success) {
        set({ error: 'Failed to submit feedback' });
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to submit feedback'
      });
    }
  },

  /**
   * Connect to WebSocket
   */
  connectSocket: async (): Promise<void> => {
    try {
      await socketService.connect();
      set({ isConnected: true });

      // Subscribe to events after connection
      get().subscribeToEvents();
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      set({
        isConnected: false,
        error: error instanceof Error ? error.message : 'Failed to connect to WebSocket'
      });
    }
  },

  /**
   * Disconnect from WebSocket
   */
  disconnectSocket: (): void => {
    get().unsubscribeFromEvents();
    socketService.disconnect();
    set({ isConnected: false });
  },

  /**
   * Subscribe to WebSocket events
   */
  subscribeToEvents: (): void => {
    const unsubscribeFns: Array<() => void> = [];

    // Pod formed - You've been matched!
    const unsubPodFormed = socketService.onPodFormed((data: PodFormedEvent) => {
      console.log('Pod formed event received:', data);

      const newPod: Pod = {
        id: data.podId,
        members: data.members.map(memberId => ({
          userId: memberId,
          username: 'Loading...', // Will be populated when fetching pod details
          joinedAt: data.createdAt,
        })),
        memberCount: data.memberCount,
        activity: data.activity,
        category: data.category,
        location: data.location,
        expiresAt: data.expiresAt,
        createdAt: data.createdAt,
        status: 'forming',
      };

      get().addPod(newPod);
    });
    unsubscribeFns.push(unsubPodFormed);

    // Member joined
    const unsubMemberJoined = socketService.onMemberJoined((data: MemberJoinedEvent) => {
      console.log('Member joined event received:', data);

      const pod = get().activePods.find(p => p.id === data.podId);
      if (pod) {
        const newMember: PodMember = {
          userId: data.userId,
          username: data.username,
          joinedAt: data.timestamp,
        };

        get().updatePod(data.podId, {
          members: [...pod.members, newMember],
          memberCount: pod.memberCount + 1,
        });
      }
    });
    unsubscribeFns.push(unsubMemberJoined);

    // Member left
    const unsubMemberLeft = socketService.onMemberLeft((data: MemberLeftEvent) => {
      console.log('Member left event received:', data);

      const pod = get().activePods.find(p => p.id === data.podId);
      if (pod) {
        get().updatePod(data.podId, {
          members: pod.members.filter(m => m.userId !== data.userId),
          memberCount: pod.memberCount - 1,
        });
      }
    });
    unsubscribeFns.push(unsubMemberLeft);

    // Pod expiring soon
    const unsubPodExpiringSoon = socketService.onPodExpiringSoon((data: PodExpiringSoonEvent) => {
      console.log('Pod expiring soon event received:', data);

      // Could trigger a notification or UI update
      // For now, just log it
    });
    unsubscribeFns.push(unsubPodExpiringSoon);

    // Pod expired
    const unsubPodExpired = socketService.onPodExpired((data: PodExpiredEvent) => {
      console.log('Pod expired event received:', data);

      get().updatePod(data.podId, { status: 'expired' });

      // Remove from active pods after a delay
      setTimeout(() => {
        get().removePod(data.podId);
      }, 3000);
    });
    unsubscribeFns.push(unsubPodExpired);

    // Pod completed
    const unsubPodCompleted = socketService.onPodCompleted((data: PodCompletedEvent) => {
      console.log('Pod completed event received:', data);

      get().updatePod(data.podId, { status: 'completed' });

      // Remove from active pods after a delay
      setTimeout(() => {
        get().removePod(data.podId);
      }, 5000);
    });
    unsubscribeFns.push(unsubPodCompleted);

    // Chat message received
    const unsubChatMessage = socketService.onChatMessage((data: ChatMessageEvent) => {
      console.log('Chat message received via WebSocket:', {
        id: data.id,
        podId: data.podId,
        userId: data.userId,
        username: data.username,
        content: data.content.substring(0, 50),
        messageType: data.messageType,
        createdAt: data.createdAt,
      });

      // Add message to store
      try {
        get().addChatMessage(data.podId, {
          id: data.id,
          podId: data.podId,
          userId: data.userId,
          username: data.username,
          content: data.content,
          messageType: data.messageType,
          createdAt: data.createdAt,
          ...(data.attachments && { attachments: data.attachments }),
          ...(data.replyTo && { replyTo: data.replyTo }),
        });
        console.log('Message added to store successfully');
      } catch (error) {
        console.error('Error adding chat message to store:', error);
      }
    });
    unsubscribeFns.push(unsubChatMessage);

    // Member confirmed arrival
    const unsubMemberConfirmed = socketService.onMemberConfirmed((data: MemberConfirmedEvent) => {
      console.log('Member confirmed event received:', data);

      // Update pod with new confirmation count
      get().updatePod(data.podId, {
        showUpCount: data.confirmedCount,
      });

      // Also update confirmedUserIds if we have it
      const pod = get().activePods.find(p => p.id === data.podId);
      if (pod && pod.confirmedUserIds) {
        if (!pod.confirmedUserIds.includes(data.userId)) {
          get().updatePod(data.podId, {
            confirmedUserIds: [...pod.confirmedUserIds, data.userId],
          });
        }
      }
    });
    unsubscribeFns.push(unsubMemberConfirmed);

    // Store unsubscribe functions
    set({ _unsubscribeFns: unsubscribeFns });
  },

  /**
   * Unsubscribe from all WebSocket events
   */
  unsubscribeFromEvents: (): void => {
    const { _unsubscribeFns } = get();
    _unsubscribeFns.forEach(unsubscribe => unsubscribe());
    set({ _unsubscribeFns: [] });
  },
}));
