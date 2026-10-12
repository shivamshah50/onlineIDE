const { z } = require('zod');

const createRoomSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Name is too long'),
  // Matches roomController's fallback: language is optional, defaults to 'javascript'.
  language: z.string().min(1).optional(),
});

module.exports = { createRoomSchema };