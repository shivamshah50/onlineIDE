const { Server } = require('socket.io');
const authSocketMiddleware = require('./authSocket');
const registerRoomHandlers = require('./registerRoomHandlers');
const registerYjsHandlers = require('./registerYjsHandlers');

/**
 * corsOrigin: pass the same value you'd give Express's cors(). `true`
 * reflects the request's Origin header, matching app.js's current
 * unconfigured cors() (which allows any origin). Tighten both together later.
 */
function createSocketServer(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  });

  io.use(authSocketMiddleware);
  io.on('connection', (socket) => {
    registerRoomHandlers(io, socket);
    registerYjsHandlers(io, socket); // shared-editing sync, piggybacked on the same connection — see yjsStore.js
  });

  return io;
}

module.exports = createSocketServer;