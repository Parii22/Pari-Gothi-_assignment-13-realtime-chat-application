/**
 * User & Room Management Socket Handler
 * Handles authentication, room joins/leaves, roster presence, and disconnects.
 */

const { getRoomHistory } = require('../utils/messageStore');

// Global map: socketId -> { socketId, username, avatar, currentRoom }
const connectedUsers = new Map();

/**
 * Returns all active users in a specific room
 * @param {Object} io - Socket.io server instance
 * @param {string} room - Room name
 * @returns {Array} Array of user objects { socketId, username, avatar }
 */
function getUsersInRoom(io, room) {
  if (!room) return [];
  const roomSockets = io.sockets.adapter.rooms.get(room);
  if (!roomSockets) return [];

  const users = [];
  for (const socketId of roomSockets) {
    const user = connectedUsers.get(socketId);
    if (user) {
      users.push({
        socketId: user.socketId,
        username: user.username,
        avatar: user.avatar
      });
    }
  }
  return users;
}

/**
 * Register user & room event handlers
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance for connected client
 */
function registerUserHandler(io, socket) {
  // 1. user:login (client -> server): { username, avatar }
  socket.on('user:login', (data) => {
    try {
      const username = (data && data.username ? data.username.trim() : `Guest_${socket.id.substring(0, 4)}`);
      const avatar = (data && data.avatar) ? data.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

      const userProfile = {
        socketId: socket.id,
        username,
        avatar,
        currentRoom: null
      };

      connectedUsers.set(socket.id, userProfile);

      socket.emit('user:login:success', userProfile);
      console.log(`[AUTH] User connected & logged in: ${username} (${socket.id})`);
    } catch (err) {
      console.error('[AUTH ERROR] Failed to process user login:', err);
      socket.emit('error:event', { message: 'Failed to process login.' });
    }
  });

  // 2. room:join (client -> server): { room }
  socket.on('room:join', ({ room }) => {
    try {
      if (!room || typeof room !== 'string') return;
      const cleanRoom = room.trim().toLowerCase();
      const user = connectedUsers.get(socket.id);

      // Leave previous room if the user was in another room
      if (user && user.currentRoom && user.currentRoom !== cleanRoom) {
        const oldRoom = user.currentRoom;
        socket.leave(oldRoom);
        
        // Broadcast updated userlist to old room
        io.to(oldRoom).emit('room:userlist', {
          room: oldRoom,
          users: getUsersInRoom(io, oldRoom)
        });
      }

      // Join new room
      socket.join(cleanRoom);
      if (user) {
        user.currentRoom = cleanRoom;
        connectedUsers.set(socket.id, user);
      }

      // Send recent history buffer specifically to this joined user
      const messages = getRoomHistory(cleanRoom);
      socket.emit('room:history', {
        room: cleanRoom,
        messages
      });

      // Broadcast updated roster to all members in the room
      const roomUsers = getUsersInRoom(io, cleanRoom);
      io.to(cleanRoom).emit('room:userlist', {
        room: cleanRoom,
        users: roomUsers
      });

      console.log(`[ROOM JOIN] ${user ? user.username : socket.id} joined #${cleanRoom}. Online: ${roomUsers.length}`);
    } catch (err) {
      console.error('[ROOM JOIN ERROR]', err);
    }
  });

  // 3. room:leave (client -> server): { room }
  socket.on('room:leave', ({ room }) => {
    try {
      if (!room) return;
      const cleanRoom = room.trim().toLowerCase();
      const user = connectedUsers.get(socket.id);

      socket.leave(cleanRoom);
      if (user && user.currentRoom === cleanRoom) {
        user.currentRoom = null;
      }

      // Broadcast updated roster to remaining users in the room
      io.to(cleanRoom).emit('room:userlist', {
        room: cleanRoom,
        users: getUsersInRoom(io, cleanRoom)
      });

      console.log(`[ROOM LEAVE] ${user ? user.username : socket.id} left #${cleanRoom}`);
    } catch (err) {
      console.error('[ROOM LEAVE ERROR]', err);
    }
  });

  // 4. disconnect
  socket.on('disconnect', () => {
    try {
      const user = connectedUsers.get(socket.id);
      if (user) {
        const lastRoom = user.currentRoom;
        connectedUsers.delete(socket.id);

        if (lastRoom) {
          io.to(lastRoom).emit('room:userlist', {
            room: lastRoom,
            users: getUsersInRoom(io, lastRoom)
          });
        }
        console.log(`[DISCONNECT] ${user.username} (${socket.id}) disconnected.`);
      }
    } catch (err) {
      console.error('[DISCONNECT ERROR]', err);
    }
  });
}

module.exports = {
  connectedUsers,
  getUsersInRoom,
  registerUserHandler
};
