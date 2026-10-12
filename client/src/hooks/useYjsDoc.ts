import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { socket, connectSocket, disconnectSocket } from '../lib/Socket';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const FROM_SERVER = 'server'; // Yjs transaction origin tag for anything applied FROM a server message

export interface YjsRoom {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  synced: boolean;
}

/**
 * Creates one Y.Doc + Awareness per room visit and keeps it synced over the
 * shared socket — see lib/socket.ts and the server's
 * realtime/registerYjsHandlers.js. This piggybacks on the same connection
 * useRoomPresence uses, rather than opening a separate y-websocket
 * connection (see the phase-3 planning doc for why).
 *
 * Independent of useRoomPresence: both hooks call connectSocket() and emit
 * 'room:join'/'room:leave' on their own. That's intentional and safe — the
 * server's registerYjsHandlers.js ignores a duplicate join for the same
 * room, and connectSocket()/disconnectSocket() are both idempotent.
 */
export function useYjsDoc(roomId: string | undefined): YjsRoom | null {
  const [room, setRoom] = useState<YjsRoom | null>(null);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      return;
    }

    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    let synced = false;

    function markSynced() {
      if (synced) return;
      synced = true;
      setRoom({ doc, awareness, synced: true });
    }

    function sendSyncStep1() {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(encoder, doc);
      socket.emit('yjs:message', encoding.toUint8Array(encoder));
    }

    function onMessage(message: ArrayBuffer | Uint8Array) {
      const decoder = decoding.createDecoder(new Uint8Array(message));
      const messageType = decoding.readVarUint(decoder);

      if (messageType === MESSAGE_SYNC) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, doc, FROM_SERVER);
        if (encoding.length(encoder) > 1) socket.emit('yjs:message', encoding.toUint8Array(encoder));
        markSynced(); // the server only sends sync messages right after a join, so any one confirms we're live
      } else if (messageType === MESSAGE_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), FROM_SERVER);
      }
    }

    // Local edits (from MonacoBinding) produce doc/awareness updates whose
    // origin is NOT 'server' — those are what get sent out. Updates applied
    // FROM a server message (above) are tagged 'server' and skipped here,
    // or they'd echo straight back.
    function onDocUpdate(update: Uint8Array, origin: unknown) {
      if (origin === FROM_SERVER) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      socket.emit('yjs:message', encoding.toUint8Array(encoder));
    }

    function onAwarenessUpdate(
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) {
      if (origin === FROM_SERVER) return;
      const changed = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changed));
      socket.emit('yjs:message', encoding.toUint8Array(encoder));
    }

    function join() {
      synced = false;
      socket.emit('room:join', { roomId });
      sendSyncStep1();
    }

    doc.on('update', onDocUpdate);
    awareness.on('update', onAwarenessUpdate);
    socket.on('yjs:message', onMessage);
    socket.on('connect', join); // covers reconnects after a dropped connection

    connectSocket();
    if (socket.connected) join();

    return () => {
      socket.emit('room:leave');
      socket.off('yjs:message', onMessage);
      socket.off('connect', join);
      doc.off('update', onDocUpdate);
      awareness.off('update', onAwarenessUpdate);
      awarenessProtocol.removeAwarenessStates(awareness, [doc.clientID], 'unmount');
      awareness.destroy();
      doc.destroy();
      disconnectSocket();
      setRoom(null);
    };
  }, [roomId]);

  return room;
}