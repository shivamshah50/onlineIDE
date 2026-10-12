const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const { getOrCreateDoc, release, MESSAGE_SYNC, MESSAGE_AWARENESS } = require('./yjsStore');

/**
 * Relays Yjs sync + awareness traffic over the same Socket.io connection
 * registerRoomHandlers.js already uses for presence — not a separate
 * y-websocket server (see the phase-3 planning doc for why). Call this once
 * per socket, alongside registerRoomHandlers(io, socket).
 *
 * The actual Y.Doc and Awareness instances, and their room-wide broadcast
 * listeners, live in yjsStore.js — ONE pair per room, not one per socket.
 */
function registerYjsHandlers(io, socket) {
  let roomId = null;
  let doc = null;
  let awareness = null;
  const controlledIds = new Set(); // this socket's own awareness clientIDs, for cleanup on disconnect

  // A per-socket filter on the shared awareness object, only to track which
  // clientIDs belong to THIS socket — it never re-broadcasts (yjsStore's own
  // listener already does that for the whole room), so having one of these
  // per socket is harmless, unlike a doc-update listener would be.
  function trackOwnAwareness({ added, removed }, origin) {
    if (origin !== socket.id) return;
    added.forEach((id) => controlledIds.add(id));
    removed.forEach((id) => controlledIds.delete(id));
  }

  socket.on('room:join', async ({ roomId: joinedRoomId }) => {
    if (typeof joinedRoomId !== 'string' || !joinedRoomId) return;
    if (roomId === joinedRoomId && doc) return; // already attached to this room — ignore a duplicate join
    if (roomId) detach(); // switching rooms on the same socket: tear down the old doc first

    roomId = joinedRoomId;
    const entry = await getOrCreateDoc(io, roomId);
    doc = entry.doc;
    awareness = entry.awareness;
    awareness.on('update', trackOwnAwareness);

    // Catch this one socket up: our sync step 1 (state vector), then every
    // other client's current awareness state — sent directly to this
    // socket only, not broadcast.
    const syncEncoder = encoding.createEncoder();
    encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(syncEncoder, doc);
    socket.emit('yjs:message', encoding.toUint8Array(syncEncoder));

    const states = awareness.getStates();
    if (states.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(states.keys())),
      );
      socket.emit('yjs:message', encoding.toUint8Array(awarenessEncoder));
    }
  });

  socket.on('yjs:message', (message) => {
    if (!doc || !awareness) return; // message arrived before room:join finished — drop it
    const decoder = decoding.createDecoder(new Uint8Array(message));
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MESSAGE_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      // socket.id becomes the Yjs transaction origin — yjsStore's broadcast
      // listener uses it to skip echoing this change straight back to its sender.
      syncProtocol.readSyncMessage(decoder, encoder, doc, socket.id);
      if (encoding.length(encoder) > 1) socket.emit('yjs:message', encoding.toUint8Array(encoder));
    } else if (messageType === MESSAGE_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), socket.id);
    }
  });

  function detach() {
    if (!doc) return;
    awareness.off('update', trackOwnAwareness);
    if (controlledIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(awareness, Array.from(controlledIds), null);
      controlledIds.clear();
    }
    release(roomId);
    doc = null;
    awareness = null;
  }

  socket.on('room:leave', detach);
  socket.on('disconnecting', detach);
}

module.exports = registerYjsHandlers;