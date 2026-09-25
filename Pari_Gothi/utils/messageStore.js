/**
 * In-Memory Message History Store
 * Caches the last MAX_HISTORY messages per room for instant hydration on join.
 */

const MAX_HISTORY = 50;

// Pre-seeded rooms with dynamic room support
const roomHistories = {
  "general": [],
  "developers": [],
  "random": []
};

/**
 * Appends a message to the specified room history buffer
 * Keeps only up to MAX_HISTORY (50) latest messages
 * @param {string} room - Target room name
 * @param {Object} messageObj - { id, sender, message, timestamp }
 */
function addMessageToHistory(room, messageObj) {
  if (!room) return;
  
  if (!roomHistories[room]) {
    roomHistories[room] = [];
  }
  
  roomHistories[room].push(messageObj);
  
  if (roomHistories[room].length > MAX_HISTORY) {
    roomHistories[room].shift();
  }
}

/**
 * Retrieves the message history for a given room
 * @param {string} room - Room name
 * @returns {Array} List of recent messages
 */
function getRoomHistory(room) {
  if (!room) return [];
  if (!roomHistories[room]) {
    roomHistories[room] = [];
  }
  return [...roomHistories[room]];
}

module.exports = {
  MAX_HISTORY,
  roomHistories,
  addMessageToHistory,
  getRoomHistory
};
