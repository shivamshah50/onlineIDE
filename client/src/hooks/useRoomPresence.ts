import { useEffect, useState } from 'react';
import { socket, connectSocket, disconnectSocket } from '../lib/Socket';

// Matches presenceStore.js's shape exactly: { userId, name, color }.
export interface PresenceUser {
  userId: string;
  name: string;
  color: string;
}

/**
 * Connects the socket, joins `roomId`, and keeps `users` in sync with the
 * server's `room:presence` broadcasts. The connection is scoped to this room
 * visit — it opens on mount and closes on unmount — since nothing else in
 * the app uses the socket yet. If you later need it elsewhere (e.g. live
 * notifications outside a room), move connectSocket()/disconnectSocket() up
 * to run once per login instead of once per room.
 */
export function useRoomPresence(roomId: string | undefined): PresenceUser[] {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!roomId) return;
    setUsers([]);
    connectSocket();

    function onPresence(list: PresenceUser[]) {
      setUsers(list);
    }

    function join() {
      socket.emit('room:join', { roomId });
    }

    socket.on('room:presence', onPresence);
    socket.on('connect', join); // covers reconnects after a dropped connection
    if (socket.connected) join();

    return () => {
      socket.emit('room:leave');
      socket.off('room:presence', onPresence);
      socket.off('connect', join);
      disconnectSocket();
    };
  }, [roomId]);

  return users;
}