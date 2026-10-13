import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';

let io: SocketIOServer | null = null;

export const initSocket = (httpServer: HttpServer, allowedOrigins: string[]): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/+$/, '');
        if (allowedOrigins.includes(normalized)) {
          return callback(null, true);
        }
        callback(null, true); // Allow during dev / fallback
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    socket.on('join:video', (videoId: string) => {
      if (videoId) {
        socket.join(`video:${videoId}`);
      }
    });

    socket.on('leave:video', (videoId: string) => {
      if (videoId) {
        socket.leave(`video:${videoId}`);
      }
    });
  });

  return io;
};

export const getIO = (): SocketIOServer | null => {
  return io;
};

export const emitCommentAdded = (videoId: string, comment: unknown, commentsCount: number) => {
  if (!io) return;
  io.to(`video:${videoId}`).emit('video:comment_added', { videoId, comment, commentsCount });
  // Also emit globally in case feeds track comment counts
  io.emit('video:comment_count_updated', { videoId, commentsCount });
};

export const emitVideoLikeUpdated = (videoId: string, likesCount: number) => {
  if (!io) return;
  io.emit('video:like_updated', { videoId, likesCount });
};

export const emitTrackLikeUpdated = (trackId: string, likesCount: number) => {
  if (!io) return;
  io.emit('track:like_updated', { trackId, likesCount });
};
