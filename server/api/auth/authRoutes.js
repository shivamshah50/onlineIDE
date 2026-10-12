const express = require('express');
const { register, login, getMe } = require('./authController');
const { registerSchema, loginSchema } = require('./authValidator');
const { validate } = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authMiddleware, getMe);

module.exports = router;