import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { serverConfig } from '../config';
import { socketAuthMiddleware, AuthenticatedSocket } from './socketAuth';
import { notificationService } from '../services/notificationService';
import { podService } from '../services/podService';
import { logger } from '../utils/logger';

/**
 * Initialize and configure Socket.IO server
 */
export function initializeWebSocket(httpServer: HTTPServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: serverConfig.corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Initialize notification service
  notificationService.initialize(io);

  // Handle connections
  io.on('connection', (socket: Socket) => {
    handleConnection(socket as AuthenticatedSocket);
  });

  logger.info('WebSocket server initialized', {
    cors: serverConfig.corsOrigins,
  });

  return io;
}

/**
 * Handle a new WebSocket connection
 */
function handleConnection(socket: AuthenticatedSocket): void {
  const { userId, username } = socket;

  logger.info('WebSocket client connected', {
    socketId: socket.id,
    userId,
    username,
  });

  // Join user's personal room for direct notifications
  socket.join(`user:${userId}`);

  // Send connection confirmation
  socket.emit('connected', {
    success: true,
    userId,
    timestamp: new Date(),
  });

  // Handle joining pod rooms
  socket.on('join_pod_room', async (data: { podId: string }) => {
    try {
      const { podId } = data;

      // Verify user is a member of this pod
      const pod = await podService.getPodById(podId);
      if (!pod) {
        socket.emit('error', { message: 'Pod not found' });
        return;
      }

      if (!pod.userIds.includes(userId)) {
        socket.emit('error', { message: 'You are not a member of this pod' });
        return;
      }

      // Join the pod room
      socket.join(`pod:${podId}`);
      logger.info('User joined pod room', { userId, podId, socketId: socket.id });

      socket.emit('pod_room_joined', { podId, success: true });
    } catch (error) {
      logger.error('Error joining pod room', {
        userId,
        error,
        socketId: socket.id,
      });
      socket.emit('error', { message: 'Failed to join pod room' });
    }
  });

  // Handle leaving pod rooms
  socket.on('leave_pod_room', (data: { podId: string }) => {
    const { podId } = data;
    socket.leave(`pod:${podId}`);

    logger.info('User left pod room', { userId, podId, socketId: socket.id });

    socket.emit('pod_room_left', { podId, success: true });
  });

  // Handle getting pod status
  socket.on('get_pod_status', async (data: { podId: string }) => {
    try {
      const { podId } = data;

      const pod = await podService.getPodById(podId);
      if (!pod) {
        socket.emit('pod_status', { podId, exists: false });
        return;
      }

      const members = await podService.getPodMembers(podId);

      socket.emit('pod_status', {
        podId,
        exists: true,
        status: pod.status,
        memberCount: pod.userIds.length,
        members,
        expiresAt: pod.expiresAt,
      });
    } catch (error) {
      logger.error('Error getting pod status', {
        userId,
        error,
        socketId: socket.id,
      });
      socket.emit('error', { message: 'Failed to get pod status' });
    }
  });

  // Handle ping/pong for connection monitoring
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date() });
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    logger.info('WebSocket client disconnected', {
      socketId: socket.id,
      userId,
      username,
      reason,
    });

    // Socket.IO automatically handles leaving all rooms on disconnect
  });

  // Handle errors
  socket.on('error', (error) => {
    logger.error('WebSocket error', {
      socketId: socket.id,
      userId,
      error,
    });
  });
}

/**
 * Gracefully shutdown WebSocket server
 */
export async function shutdownWebSocket(io: SocketServer): Promise<void> {
  return new Promise((resolve) => {
    logger.info('Shutting down WebSocket server...');

    // Disconnect all clients
    io.disconnectSockets(true);

    // Close the server
    io.close(() => {
      logger.info('WebSocket server closed');
      resolve();
    });
  });
}
