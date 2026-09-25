/**
 * Chat & Messaging Socket Handler
 * Handles group messages, typing indicator relays, and private direct messages.
 */

const { addMessageToHistory } = require('../utils/messageStore');
const { connectedUsers } = require('./userHandler');

/**
 * Register chat & messaging event handlers
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance for connected client
 */
function registerChatHandler(io, socket) {
  // 1. chat:send (client -> server): { room, message }
  socket.on('chat:send', ({ room, message }) => {
    try {
      if (!room || !message || typeof message !== 'string' || !message.trim()) {
        return;
      }

      const cleanRoom = room.trim().toLowerCase();
      const user = connectedUsers.get(socket.id);
      const username = user ? user.username : 'Anonymous';
      const avatar = user ? user.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

      const messageObj = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        room: cleanRoom,
        sender: {
          username,
          avatar,
          socketId: socket.id
        },
        message: message.trim(),
        timestamp: new Date().toISOString()
      };

      // Store in memory buffer (MAX_HISTORY = 50)
      addMessageToHistory(cleanRoom, messageObj);

      // Broadcast to all active members in the room
      io.to(cleanRoom).emit('chat:receive', messageObj);

      console.log(`[CHAT] [#${cleanRoom}] ${username}: "${message.trim().substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
    } catch (err) {
      console.error('[CHAT SEND ERROR]', err);
    }
  });

  // 2. typing:start (client -> server): { room }
  socket.on('typing:start', ({ room }) => {
    try {
      if (!room) return;
      const cleanRoom = room.trim().toLowerCase();
      const user = connectedUsers.get(socket.id);
      const username = user ? user.username : 'Someone';

      // Relay to all other members in the room excluding the sender
      socket.broadcast.to(cleanRoom).emit('typing:update', {
        room: cleanRoom,
        username,
        isTyping: true
      });
    } catch (err) {
      console.error('[TYPING START ERROR]', err);
    }
  });

  // 3. typing:stop (client -> server): { room }
  socket.on('typing:stop', ({ room }) => {
    try {
      if (!room) return;
      const cleanRoom = room.trim().toLowerCase();
      const user = connectedUsers.get(socket.id);
      const username = user ? user.username : 'Someone';

      // Relay to all other members in the room excluding the sender
      socket.broadcast.to(cleanRoom).emit('typing:update', {
        room: cleanRoom,
        username,
        isTyping: false
      });
    } catch (err) {
      console.error('[TYPING STOP ERROR]', err);
    }
  });

  // 4. direct:send (client -> server): { recipientId, message }
  socket.on('direct:send', ({ recipientId, message }) => {
    try {
      if (!recipientId || !message || typeof message !== 'string' || !message.trim()) {
        return;
      }

      const senderUser = connectedUsers.get(socket.id);
      const recipientUser = connectedUsers.get(recipientId);

      // Verify recipient exists and is actively connected
      const recipientSocket = io.sockets.sockets.get(recipientId);
      if (!recipientUser || !recipientSocket) {
        socket.emit('direct:error', {
          recipientId,
          message: 'User is no longer online or socket was not found.'
        });
        return;
      }

      const senderName = senderUser ? senderUser.username : 'Anonymous';
      const senderAvatar = senderUser ? senderUser.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(senderName)}`;

      const dmPayload = {
        id: `dm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        from: {
          username: senderName,
          avatar: senderAvatar,
          socketId: socket.id
        },
        to: {
          username: recipientUser.username,
          avatar: recipientUser.avatar,
          socketId: recipientId
        },
        message: message.trim(),
        timestamp: new Date().toISOString()
      };

      // Deliver ONLY to the target recipient socket — never leaks to any room
      io.to(recipientId).emit('direct:receive', dmPayload);

      // Confirm send to the sender's client so their DM thread updates seamlessly
      socket.emit('direct:sent', dmPayload);

      console.log(`[DM] Private message from ${senderName} (${socket.id}) to ${recipientUser.username} (${recipientId})`);
    } catch (err) {
      console.error('[DIRECT SEND ERROR]', err);
    }
  });
}

module.exports = {
  registerChatHandler
};
