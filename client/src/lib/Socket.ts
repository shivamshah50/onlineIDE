import { io, type Socket } from 'socket.io-client';

// lib/api.ts's baseURL is '.../api' for REST calls, but Socket.io listens on
// the server root (see your realtime/index.js attaching to the same
// httpServer, not to an /api sub-path) — strip the trailing /api here.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '');

export const socket: Socket = io(SOCKET_URL, { autoConnect: false });

/**
 * Reference-counted on purpose: useRoomPresence and useYjsDoc both call
 * connectSocket()/disconnectSocket() independently on their own mount and
 * unmount, since both hooks share this one socket. Without counting,
 * whichever of the two unmounts first (which happens on every `roomId`
 * change, and — in dev — on every StrictMode double-invoke) would disconnect
 * the socket out from under the other hook mid-sync, silently dropping
 * whatever Yjs messages were in flight at that moment. That's the actual
 * cause of dropped/corrupted characters when typing right as a room loads
 * or changes — not a Monaco bug.
 */
let refCount = 0;

export function connectSocket(): void {
  refCount += 1;
  const token = localStorage.getItem('token');
  if (!token) return;
  socket.auth = { token };
  if (!socket.connected) socket.connect();
}

export function disconnectSocket(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && socket.connected) socket.disconnect();
}