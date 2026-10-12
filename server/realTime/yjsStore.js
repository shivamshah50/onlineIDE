const encoding = require('lib0/encoding');
const Y = require('yjs');
const awarenessProtocol = require('y-protocols/awareness');
const syncProtocol = require('y-protocols/sync');
const Room = require('../models/Room');

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// One Y.Doc (+ Awareness) per room, for as long as at least one socket is
// attached to it. Lost on server restart — intentional for this phase (see
// the phase-3 planning doc); persistence is a later phase, by agreement.
const docs = new Map(); // roomId -> { doc, awareness, refCount }
const creating = new Map(); // roomId -> Promise, guards concurrent first-joins racing to create the same doc

// Minimal starter snippets, duplicated from the client's own starter map on
// purpose: this is server-side SEED content for a brand-new room's Yjs
// document, inserted exactly once per room's lifetime, right when its Y.Doc
// is first created. If the client's starters change, update this too.
const STARTERS = {
  javascript:
    'function mergeSort(arr) {\n  if (arr.length <= 1) return arr;\n  const mid = Math.floor(arr.length / 2);\n  return merge(mergeSort(arr.slice(0, mid)), mergeSort(arr.slice(mid)));\n}\n',
  typescript: "const greet = (name) => `Hello, ${name}`;\nconsole.log(greet('world'));\n",
  python: 'def greet(name):\n    return f"Hello, {name}"\n\nprint(greet("world"))\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, world");\n    }\n}\n',
  cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, world" << std::endl;\n    return 0;\n}\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, world")\n}\n',
};

function broadcastDocUpdate(io, roomId, update, origin) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  const message = encoding.toUint8Array(encoder);
  // origin is the sending socket's id (see registerYjsHandlers.js) — .except()
  // skips echoing a client's own change straight back to it.
  const target = typeof origin === 'string' ? io.to(roomId).except(origin) : io.to(roomId);
  target.emit('yjs:message', message);
}

function broadcastAwarenessUpdate(io, roomId, awareness, changedClientIds, origin) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClientIds));
  const message = encoding.toUint8Array(encoder);
  const target = typeof origin === 'string' ? io.to(roomId).except(origin) : io.to(roomId);
  target.emit('yjs:message', message);
}

/**
 * Returns the room's { doc, awareness } entry, creating it (and bumping its
 * refCount) if this is the first socket to attach. Call release(roomId)
 * exactly once for every successful call to this, when that socket detaches.
 */
async function getOrCreateDoc(io, roomId) {
  const existing = docs.get(roomId);
  if (existing) {
    existing.refCount += 1;
    return existing;
  }

  if (creating.has(roomId)) {
    const entry = await creating.get(roomId);
    entry.refCount += 1;
    return entry;
  }

  const createPromise = (async () => {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);

    // Seed once, from whatever language the room was created with.
    // Best-effort: a failed lookup just leaves the doc empty rather than
    // blocking the join.
    try {
      const room = await Room.findOne({ roomId }).select('language');
      const starter = STARTERS[room && room.language] || '';
      if (starter) doc.getText('monaco').insert(0, starter);
    } catch (err) {
      console.error('Yjs seed lookup failed:', err);
    }

    // ONE pair of listeners for this doc's whole lifetime, regardless of how
    // many sockets attach to it later — keeping these at the store level
    // (not one per socket) is what stops N people in a room from each
    // rebroadcasting the same update to everyone else N times over.
    doc.on('update', (update, origin) => broadcastDocUpdate(io, roomId, update, origin));
    awareness.on('update', ({ added, updated, removed }, origin) => {
      broadcastAwarenessUpdate(io, roomId, awareness, added.concat(updated, removed), origin);
    });

    const entry = { doc, awareness, refCount: 0 };
    docs.set(roomId, entry);
    return entry;
  })();

  creating.set(roomId, createPromise);
  try {
    const entry = await createPromise;
    entry.refCount += 1;
    return entry;
  } finally {
    creating.delete(roomId);
  }
}

/** Call once per socket that previously called getOrCreateDoc, on detach. */
function release(roomId) {
  const entry = docs.get(roomId);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    entry.awareness.destroy();
    entry.doc.destroy();
    docs.delete(roomId);
  }
}

module.exports = { getOrCreateDoc, release, MESSAGE_SYNC, MESSAGE_AWARENESS };