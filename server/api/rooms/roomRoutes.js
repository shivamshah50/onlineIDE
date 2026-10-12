const express = require('express');
const authMiddleware = require('../../middleware/auth');
const { validate } = require('../../middleware/validate'); // named export, matching your validate.js
const { createRoomSchema } = require('./roomValidator');
const { executeSchema } = require('./executeValidator');
const { listRooms, createRoom, getRoom, joinRoom, deleteRoom } = require('./roomController');
const { executeCode } = require('./executeController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', listRooms);
router.post('/', validate(createRoomSchema), createRoom);
router.get('/:roomId', getRoom);
router.post('/:roomId/join', joinRoom);
router.post('/:roomId/execute', validate(executeSchema), executeCode);
router.delete('/:roomId', deleteRoom);

module.exports = router;