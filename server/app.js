require('dotenv').config();
const http = require('http'); // NEW — Express and Socket.io share this server/port
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./api/auth/authRoutes');
const roomRoutes = require('./api/rooms/roomRoutes');
const createSocketServer = require('./realtime'); // NEW
const { setIO } = require('./realtime/ioRegistry'); // NEW — lets REST routes (execute) broadcast too

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// NEW — was app.listen(...) directly on `app`. Socket.io needs the raw HTTP
// server to attach to, so Express now hands its requests off to httpServer
// instead of listening on its own.
const httpServer = http.createServer(app);
const io = createSocketServer(httpServer, true); // origin: true matches cors() above (any origin, dev-friendly)
setIO(io); // NEW — so executeController.js can emit 'execution:result' to a room

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));