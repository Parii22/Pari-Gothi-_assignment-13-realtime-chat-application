/**
 * Real-Time Group Chat & Direct Messaging Engine
 * Server Bootstrap: Express.js + Socket.io
 */

require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { registerUserHandler } = require('./sockets/userHandler');
const { registerChatHandler } = require('./sockets/chatHandler');

const app = express();
const server = http.createServer(app);

// Enable CORS for Express and Socket.io
app.use(cors());
app.use(express.json());

// Initialize Socket.io with permissive CORS for cloud deployment (Render, etc.)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Socket.io Connection Router
io.on('connection', (socket) => {
  console.log(`[SOCKET CONNECTED] Socket ID: ${socket.id}`);

  // Register modular handlers
  registerUserHandler(io, socket);
  registerChatHandler(io, socket);
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Real-Time Chat Engine running on PORT ${PORT}`);
  console.log(`📡 Local URL: http://localhost:${PORT}`);
  console.log(`=========================================`);
});
