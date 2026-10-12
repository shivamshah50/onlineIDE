const Room = require('../../models/Room');
const generateRoomId = require('../../utils/generateRoomId');
const presenceStore = require('../../realTime/presenceStore'); // Corrected import path

/**
 * Your Room model has `owner` (not `ownerId`) and only `createdAt`/`updatedAt`
 * (no `lastActiveAt`). Rather than change the model, every response is shaped
 * here to match the frontend's existing contract: ownerId <- owner,
 * lastActiveAt <- updatedAt. socket room:join also bumps updatedAt, so this
 * stays accurate once Socket.io is wired in.
 */
function toRoomJSON(room) {
  return {
    roomId: room.roomId,
    name: room.name,
    language: room.language,
    ownerId: String(room.owner),
    createdAt: room.createdAt,
    lastActiveAt: room.updatedAt,
  };
}

// GET /api/rooms — only rooms the caller owns. "Rooms I've joined but don't
// own" needs a separate membership collection — add that when you actually
// need a "shared with me" view, not before.
async function listRooms(req, res) {
  try {
    const rooms = await Room.find({ owner: req.user.id }).sort({ updatedAt: -1 }).limit(50);
    return res.status(200).json({ success: true, data: rooms.map(toRoomJSON) });
  } catch (err) {
    console.error('List rooms error:', err);
    return res.status(500).json({ success: false, error: 'Could not load rooms' });
  }
}

// POST /api/rooms
async function createRoom(req, res) {
  try {
    const { name, language } = req.body;
    const roomId = await generateRoomId();
    const room = await Room.create({
      roomId,
      name,
      language: language || 'javascript',
      owner: req.user.id,
    });
    return res.status(201).json({ success: true, data: toRoomJSON(room) });
  } catch (err) {
    console.error('Create room error:', err);
    return res.status(500).json({ success: false, error: 'Could not create the room' });
  }
}

// GET /api/rooms/:roomId — anyone with the link can look it up (link = access, for now).
async function getRoom(req, res) {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    const activeUsers = presenceStore.list(room.roomId).length;
    return res.status(200).json({ success: true, data: { ...toRoomJSON(room), activeUsers } });
  } catch (err) {
    console.error('Get room error:', err);
    return res.status(500).json({ success: false, error: 'Could not load the room' });
  }
}

/**
 * POST /api/rooms/:roomId/join — confirms the room exists before the client
 * opens a socket. Presence itself is established over the socket
 * (`room:join` event), not here.
 */
async function joinRoom(req, res) {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    return res.status(200).json({ success: true, data: { roomId: room.roomId } });
  } catch (err) {
    console.error('Join room error:', err);
    return res.status(500).json({ success: false, error: 'Could not join the room' });
  }
}

// DELETE /api/rooms/:roomId — owner only.
async function deleteRoom(req, res) {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    if (String(room.owner) !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Only the room owner can close this room' });
    }
    await room.deleteOne();
    return res.status(200).json({ success: true, data: { success: true } });
  } catch (err) {
    console.error('Delete room error:', err);
    return res.status(500).json({ success: false, error: 'Could not delete the room' });
  }
}

module.exports = { listRooms, createRoom, getRoom, joinRoom, deleteRoom, toRoomJSON };