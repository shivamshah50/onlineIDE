const Room = require('../models/Room');
const presenceStore = require('./presenceStore');

const PRESENCE_EVENT = 'room:presence';

function broadcastPresence(io, roomId) {
  io.to(roomId).emit(PRESENCE_EVENT, presenceStore.list(roomId));
}

function registerRoomHandlers(io, socket) {
  socket.on('room:join', async (payload, ack) => {
    const roomId = payload && payload.roomId;
    if (typeof roomId !== 'string' || !roomId) {
      if (typeof ack === 'function') ack(false);
      return;
    }

    // A socket can only be in one of our rooms — presenceStore.join() already
    // removes it from any previous room, so leave the Socket.io room to match.
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }

    socket.join(roomId);
    presenceStore.join(roomId, socket.id, { userId: socket.user.id, name: socket.user.name });
    broadcastPresence(io, roomId);

    // Bumps updatedAt, which the REST layer reports to the frontend as
    // lastActiveAt (see roomController's toRoomJSON). Best-effort — a slow
    // write here shouldn't block the join.
    Room.updateOne({ roomId }, { $set: { updatedAt: new Date() } }).catch(() => {});

    if (typeof ack === 'function') ack(true);
  });

  socket.on('room:leave', () => {
    const roomId = presenceStore.leave(socket.id);
    if (roomId) {
      socket.leave(roomId);
      broadcastPresence(io, roomId);
    }
  });

  // `disconnecting` (not `disconnect`) fires while socket.rooms is still
  // populated — the gotcha from earlier. presenceStore is keyed by socketId
  // already so it works either way, but this is still the correct event to
  // use if you later need socket.rooms directly in this handler.
  socket.on('disconnecting', () => {
    const roomId = presenceStore.leave(socket.id);
    if (roomId) broadcastPresence(io, roomId);
  });
}

module.exports = registerRoomHandlers;