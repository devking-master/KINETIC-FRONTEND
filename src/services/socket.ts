import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const getSocketUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
  }
  return window.location.origin.includes(':3000') ? 'http://localhost:5000' : window.location.origin;
};

export const getSocket = (): Socket => {
  if (!socket) {
    const url = getSocketUrl();
    socket = io(url, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      // connected successfully
    });

    socket.on('connect_error', () => {
      // fallback silently
    });
  }
  return socket;
};

export const joinVideoRoom = (videoId: string) => {
  const s = getSocket();
  s.emit('join:video', videoId);
};

export const leaveVideoRoom = (videoId: string) => {
  const s = getSocket();
  s.emit('leave:video', videoId);
};
