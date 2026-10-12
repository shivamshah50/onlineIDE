const { z } = require('zod');

const executeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(100000, 'Code is too long'),
  stdin: z.string().max(10000, 'Input is too long').optional(),
  // Optional override — normally the room's own saved language is used, same
  // as yjsStore.js's seeding logic. Lets a future "run with different input
  // language" use case pass one without changing the room.
  language: z.string().min(1).optional(),
});

module.exports = { executeSchema };