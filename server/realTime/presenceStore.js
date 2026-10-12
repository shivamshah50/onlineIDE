const PALETTE = ['#c68fe8', '#7fdfc4', '#f3b37a', '#8fb8f5', '#f28fa5', '#b7e07f', '#f0d878'];

function colorFor(userId) {
  let hash = 0;
  for (const ch of String(userId)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

// roomId -> socketId -> entry. Keyed by socket, not userId, so the same
// person in two tabs shows as two presences, and closing one tab doesn't
// remove both.
const rooms = new Map();
// Reverse index so `disconnecting` can find a socket's room in O(1) without
// scanning every room.
const socketIndex = new Map();

const presenceStore = {
  /** Call on `room:join`. Returns the room's full presence list after adding this socket. */
  join(roomId, socketId, user) {
    this.leave(socketId); // a socket can only be in one of our rooms at a time
    const entry = { userId: user.userId, name: user.name, color: colorFor(user.userId), socketId, roomId };
    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    rooms.get(roomId).set(socketId, entry);
    socketIndex.set(socketId, { roomId });
    return this.list(roomId);
  },

  /** Call on `room:leave` or `disconnecting`. Returns the room id the socket left, if any. */
  leave(socketId) {
    const index = socketIndex.get(socketId);
    if (!index) return null;
    const room = rooms.get(index.roomId);
    if (room) {
      room.delete(socketId);
      if (room.size === 0) rooms.delete(index.roomId);
    }
    socketIndex.delete(socketId);
    return index.roomId;
  },

  list(roomId) {
    const room = rooms.get(roomId);
    if (!room) return [];
    return [...room.values()].map(({ userId, name, color }) => ({ userId, name, color }));
  },
};

module.exports = presenceStore;