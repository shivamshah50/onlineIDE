const { customAlphabet } = require('nanoid');
const Room = require('../models/Room');

// No ambiguous characters (0/O, 1/l/I) since people read these aloud or retype them.
const generate = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 8);

/** Generates a room id and retries on the (very unlikely) collision. */
async function generateRoomId() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generate();
    const exists = await Room.exists({ roomId: candidate });
    if (!exists) return candidate;
  }
  throw new Error('Could not generate a unique room id');
}

module.exports = generateRoomId;