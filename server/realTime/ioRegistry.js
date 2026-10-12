// Tiny singleton so REST controllers (which never see the Socket.io server
// directly — app.js only passes it to createSocketServer) can still
// broadcast to a room. Set once from app.js right after the socket server is
// created; read from anywhere else that needs to emit (e.g.
// executeController.js, so a code run shows up in every tab in the room, not
// just the one that clicked Run).
let io = null;

function setIO(instance) {
  io = instance;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io server not initialized yet — setIO() must run before any route uses getIO()');
  }
  return io;
}

module.exports = { setIO, getIO };