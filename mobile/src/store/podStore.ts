import { create } from 'zustand';
import { socketService, PodFormedEvent, MemberJoinedEvent, MemberLeftEvent, PodExpiringSoonEvent, PodExpiredEvent, PodCompletedEvent } from '../services/socketService';
import { api } from '../services/api';

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

  // Actions
  fetchActivePods: () => Promise<void>;
  addPod: (pod: Pod) => void;
  removePod: (podId: string) => void;
  updatePod: (podId: string, updates: Partial<Pod>) => void;
  leavePod: (podId: string) => Promise<void>;
  completePod: (podId: string) => Promise<void>;

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
  _unsubscribeFns: [],

  /**
   * Fetch active pods from API
   */
  fetchActivePods: async (): Promise<void> => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.get<{ success: boolean; data: Pod[] }>('/pods/active');

      if (response.data.success) {
        set({ activePods: response.data.data, isLoading: false });

        // Join all active pod rooms
        response.data.data.forEach(pod => {
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
   * Add a new pod to the store
   */
  addPod: (pod: Pod): void => {
    set(state => ({
      activePods: [...state.activePods, pod],
    }));

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
      const response = await api.post<{ success: boolean }>(`/pods/${podId}/leave`);

      if (response.data.success) {
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
      const response = await api.post<{ success: boolean }>(`/pods/${podId}/complete`);

      if (response.data.success) {
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
