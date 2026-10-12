const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * authController's generateToken() signs only { id, email } — no name — so
 * REST's authMiddleware can decode the token alone, but presence needs a
 * display name, which means one extra Mongo lookup per socket connection
 * (not per room:join). That's a connect-time cost, not a per-message one.
 *
 * Client side (see socket.io docs "Sending credentials"):
 *   const socket = io(URL, { autoConnect: false, auth: { token } });
 *   socket.connect(); // call once the user is logged in
 */
async function authSocketMiddleware(socket, next) {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) {
    return next(new Error('AUTH_REQUIRED'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('name email');
    if (!user) {
      return next(new Error('AUTH_INVALID'));
    }
    socket.user = { id: String(user._id), name: user.name, email: user.email };
    return next();
  } catch (err) {
    return next(new Error('AUTH_INVALID'));
  }
}

module.exports = authSocketMiddleware;