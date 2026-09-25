/**
 * PulseChat — Client-side Application Logic
 * Implements Socket.io real-time layer, debounced typing indicators,
 * in-memory history rendering, room switching, and direct messaging.
 */

// Connect to Socket.io Server
const socket = io();

// Application State
const state = {
  currentUser: {
    username: '',
    avatar: '',
    socketId: ''
  },
  currentMode: 'room', // 'room' | 'dm'
  activeRoom: 'general',
  activeDmUser: null, // { socketId, username, avatar }
  knownRooms: ['general', 'developers', 'random'],
  roomTypingUsers: new Set(),
  dmHistories: {}, // socketId -> Array of { id, from, to, message, timestamp }
  dmConversations: new Map(), // socketId -> { socketId, username, avatar, unread: 0 }
  isTyping: false,
  typingTimer: null
};

// DOM Elements
const elements = {
  loginModal: document.getElementById('login-modal'),
  loginForm: document.getElementById('login-form'),
  usernameInput: document.getElementById('username-input'),
  avatarPicker: document.getElementById('avatar-picker'),
  appContainer: document.getElementById('app-container'),
  
  // Sidebar elements
  channelList: document.getElementById('channel-list'),
  dmList: document.getElementById('dm-conversations-list'),
  dmTotalBadge: document.getElementById('dm-total-badge'),
  btnCreateRoom: document.getElementById('btn-create-room'),
  navChannelsBtn: document.getElementById('nav-channels-btn'),
  navDmsBtn: document.getElementById('nav-dms-btn'),
  channelsSection: document.getElementById('channels-section'),
  dmsSection: document.getElementById('dms-section'),
  
  // User profile elements
  currentUserAvatar: document.getElementById('current-user-avatar'),
  currentUserName: document.getElementById('current-user-name'),
  currentUserSocket: document.getElementById('current-user-socket'),
  btnCopyId: document.getElementById('btn-copy-id'),
  socketStatusDot: document.getElementById('socket-status-indicator'),
  
  // Header elements
  headerIcon: document.getElementById('header-icon'),
  currentChatTitle: document.getElementById('current-chat-title'),
  currentChatDesc: document.getElementById('current-chat-desc'),
  chatModeBadge: document.getElementById('chat-mode-badge'),
  headerOnlineCount: document.getElementById('header-online-count'),
  btnToggleRoster: document.getElementById('btn-toggle-roster'),
  
  // Chat viewport elements
  messagesViewport: document.getElementById('messages-viewport'),
  welcomeBanner: document.getElementById('welcome-banner'),
  welcomeTitle: document.getElementById('welcome-title'),
  welcomeSubtitle: document.getElementById('welcome-subtitle'),
  messagesList: document.getElementById('messages-list'),
  
  // Typing indicator elements
  typingBar: document.getElementById('typing-indicator-bar'),
  typingText: document.getElementById('typing-text'),
  
  // Input elements
  chatForm: document.getElementById('chat-form'),
  messageInput: document.getElementById('message-input'),
  btnEmojiToggle: document.getElementById('btn-emoji-toggle'),
  emojiPicker: document.getElementById('emoji-picker'),
  
  // Roster elements
  sidebarRoster: document.getElementById('sidebar-roster'),
  rosterCount: document.getElementById('roster-count'),
  rosterList: document.getElementById('roster-list'),
  
  // Custom Room Modal
  customRoomModal: document.getElementById('custom-room-modal'),
  customRoomForm: document.getElementById('custom-room-form'),
  customRoomInput: document.getElementById('custom-room-input'),
  btnCloseRoomModal: document.getElementById('btn-close-room-modal'),
  
  // Toasts
  toastContainer: document.getElementById('toast-container')
};

// Default Avatar Seeds
const defaultAvatarSeeds = ['Aarav', 'Priya', 'Rohan', 'CyberBot', 'Nova'];
let selectedAvatarUrl = '';

/**
 * Initialize Avatar Picker in Login Modal
 */
function initAvatarPicker() {
  elements.avatarPicker.innerHTML = '';
  defaultAvatarSeeds.forEach((seed, index) => {
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
    const option = document.createElement('div');
    option.className = `avatar-option ${index === 0 ? 'selected' : ''}`;
    option.innerHTML = `<img src="${avatarUrl}" alt="Avatar ${seed}">`;
    if (index === 0) selectedAvatarUrl = avatarUrl;

    option.addEventListener('click', () => {
      document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
      option.classList.add('selected');
      selectedAvatarUrl = avatarUrl;
    });

    elements.avatarPicker.appendChild(option);
  });
}

/**
 * Toast Notification Utility
 */
function showToast(message, isDm = false) {
  const toast = document.createElement('div');
  toast.className = `toast ${isDm ? 'dm-toast' : ''}`;
  toast.innerHTML = `
    <i class="fa-solid ${isDm ? 'fa-envelope' : 'fa-bell'}"></i>
    <span>${message}</span>
  `;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Format timestamp into readable time string (e.g. 2:45 PM)
 */
function formatTime(isoString) {
  try {
    const d = new Date(isoString || Date.now());
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

/**
 * Append Message Bubble to Chat Viewport
 */
function renderMessageItem(msg, isSelf, isDm = false) {
  const row = document.createElement('div');
  row.className = `chat-message-row ${isSelf ? 'self' : ''} ${isDm ? 'dm-message' : ''}`;
  
  const senderName = typeof msg.sender === 'object' ? msg.sender.username : (msg.from ? msg.from.username : (msg.sender || 'Anonymous'));
  const avatarUrl = (typeof msg.sender === 'object' && msg.sender.avatar) 
    ? msg.sender.avatar 
    : (msg.from && msg.from.avatar ? msg.from.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(senderName)}`);
  
  const formattedTime = formatTime(msg.timestamp);

  row.innerHTML = `
    <img src="${avatarUrl}" alt="${senderName}" class="msg-avatar">
    <div class="msg-content-block">
      <div class="msg-metadata">
        <span class="msg-sender">${escapeHtml(senderName)}</span>
        <span class="msg-time">${formattedTime}</span>
      </div>
      <div class="msg-bubble">${escapeHtml(msg.message)}</div>
    </div>
  `;

  elements.messagesList.appendChild(row);
  scrollToBottom();
}

/**
 * Helper to escape HTML characters
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Scroll message container to bottom smoothly
 */
function scrollToBottom() {
  elements.messagesViewport.scrollTop = elements.messagesViewport.scrollHeight;
}

/**
 * Switch to Room Channel View
 */
function switchToRoom(roomName) {
  const cleanRoom = roomName.toLowerCase().trim();
  state.currentMode = 'room';
  state.activeRoom = cleanRoom;
  state.activeDmUser = null;
  state.roomTypingUsers.clear();
  updateTypingBanner();

  // Highlight active channel in sidebar
  document.querySelectorAll('.channel-item').forEach(el => {
    el.classList.toggle('active', el.dataset.room === cleanRoom);
  });
  document.querySelectorAll('.dm-item').forEach(el => el.classList.remove('active'));

  // Update Header
  elements.headerIcon.className = 'channel-header-icon';
  elements.headerIcon.innerHTML = '<i class="fa-solid fa-hashtag"></i>';
  elements.currentChatTitle.textContent = cleanRoom;
  elements.currentChatDesc.textContent = `Channel discussion for #${cleanRoom}`;
  elements.chatModeBadge.className = 'chat-mode-badge';
  elements.chatModeBadge.innerHTML = '<i class="fa-solid fa-users"></i><span>Group Chat</span>';
  elements.messageInput.placeholder = `Message #${cleanRoom}...`;

  // Update Welcome Banner
  elements.welcomeBanner.style.display = 'block';
  elements.welcomeTitle.textContent = `Welcome to #${cleanRoom}!`;
  elements.welcomeSubtitle.textContent = `This is the start of the #${cleanRoom} channel. Messages are buffered in-memory (last 50).`;
  elements.messagesList.innerHTML = '';

  // Emit room join event
  socket.emit('room:join', { room: cleanRoom });
}

/**
 * Switch to Direct Message View
 */
function switchToDm(recipient) {
  state.currentMode = 'dm';
  state.activeDmUser = recipient;
  state.roomTypingUsers.clear();
  updateTypingBanner();

  // Reset unread count for this user
  if (state.dmConversations.has(recipient.socketId)) {
    const conv = state.dmConversations.get(recipient.socketId);
    conv.unread = 0;
    state.dmConversations.set(recipient.socketId, conv);
    updateDmSidebarList();
  }

  // Highlight sidebar
  document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.dm-item').forEach(el => {
    el.classList.toggle('active', el.dataset.socketId === recipient.socketId);
  });

  // Update Header
  elements.headerIcon.className = 'channel-header-icon dm-mode';
  elements.headerIcon.innerHTML = '<i class="fa-solid fa-at"></i>';
  elements.currentChatTitle.textContent = recipient.username;
  elements.currentChatDesc.textContent = `Direct Message Thread (Private & Encrypted to Socket)`;
  elements.chatModeBadge.className = 'chat-mode-badge dm';
  elements.chatModeBadge.innerHTML = '<i class="fa-solid fa-lock"></i><span>Direct Message</span>';
  elements.messageInput.placeholder = `Message @${recipient.username}...`;

  // Update Welcome Banner
  elements.welcomeBanner.style.display = 'block';
  elements.welcomeTitle.textContent = `Private Chat with ${recipient.username}`;
  elements.welcomeSubtitle.textContent = `Direct messages are delivered ONLY to ${recipient.username}'s socket and never leak to rooms.`;
  elements.messagesList.innerHTML = '';

  // Render previous DM history if available
  const history = state.dmHistories[recipient.socketId] || [];
  history.forEach(dm => {
    const isSelf = dm.from.socketId === socket.id;
    renderMessageItem(dm, isSelf, true);
  });
}

/**
 * Update Direct Messages List in Sidebar
 */
function updateDmSidebarList() {
  if (state.dmConversations.size === 0) {
    elements.dmList.innerHTML = '<li class="empty-state-text">No private messages yet. Click an online user in the roster to start!</li>';
    elements.dmTotalBadge.classList.add('hidden');
    return;
  }

  elements.dmList.innerHTML = '';
  let totalUnread = 0;

  state.dmConversations.forEach(conv => {
    totalUnread += conv.unread || 0;
    const item = document.createElement('li');
    item.className = `dm-item ${state.currentMode === 'dm' && state.activeDmUser && state.activeDmUser.socketId === conv.socketId ? 'active' : ''}`;
    item.dataset.socketId = conv.socketId;
    
    item.innerHTML = `
      <img src="${conv.avatar}" class="dm-avatar" alt="${conv.username}">
      <span class="channel-name">${escapeHtml(conv.username)}</span>
      ${conv.unread > 0 ? `<span class="dm-unread-badge">${conv.unread}</span>` : ''}
    `;

    item.addEventListener('click', () => {
      switchToDm(conv);
    });

    elements.dmList.appendChild(item);
  });

  if (totalUnread > 0) {
    elements.dmTotalBadge.textContent = totalUnread;
    elements.dmTotalBadge.classList.remove('hidden');
  } else {
    elements.dmTotalBadge.classList.add('hidden');
  }
}

/**
 * Update Typing Banner UI
 */
function updateTypingBanner() {
  if (state.currentMode !== 'room' || state.roomTypingUsers.size === 0) {
    elements.typingBar.classList.remove('visible');
    elements.typingText.textContent = '';
    return;
  }

  const usersArray = Array.from(state.roomTypingUsers);
  let text = '';
  if (usersArray.length === 1) {
    text = `${usersArray[0]} is typing...`;
  } else if (usersArray.length === 2) {
    text = `${usersArray[0]} and ${usersArray[1]} are typing...`;
  } else {
    text = 'Several people are typing...';
  }

  elements.typingText.textContent = text;
  elements.typingBar.classList.add('visible');
}

/**
 * Render Online User Roster for Current Room
 */
function renderUserRoster(users) {
  elements.rosterList.innerHTML = '';
  elements.rosterCount.textContent = users.length;
  elements.headerOnlineCount.textContent = users.length;

  users.forEach(u => {
    const isSelf = u.socketId === socket.id;
    const card = document.createElement('div');
    card.className = 'roster-user-card';

    card.innerHTML = `
      <div class="roster-user-info">
        <div class="roster-avatar-wrap">
          <img src="${u.avatar}" alt="${u.username}" class="roster-avatar">
          <span class="online-indicator"></span>
        </div>
        <span class="roster-user-name">${escapeHtml(u.username)} ${isSelf ? '<small style="color:var(--primary)">(You)</small>' : ''}</span>
      </div>
      ${!isSelf ? `
        <button class="btn-dm-user" title="Send Direct Message to ${escapeHtml(u.username)}">
          <i class="fa-solid fa-message"></i>
        </button>
      ` : ''}
    `;

    if (!isSelf) {
      const dmBtn = card.querySelector('.btn-dm-user');
      dmBtn.addEventListener('click', () => {
        // Register in DM conversations
        state.dmConversations.set(u.socketId, {
          socketId: u.socketId,
          username: u.username,
          avatar: u.avatar,
          unread: 0
        });
        updateDmSidebarList();
        switchToDm(u);
      });
    }

    elements.rosterList.appendChild(card);
  });
}

/**
 * Handle Debounced Typing Input
 */
function handleTypingInput() {
  if (state.currentMode !== 'room') return;

  if (!state.isTyping) {
    state.isTyping = true;
    socket.emit('typing:start', { room: state.activeRoom });
  }

  // Clear existing debounce timeout and start a new 2-second timer
  clearTimeout(state.typingTimer);
  state.typingTimer = setTimeout(() => {
    state.isTyping = false;
    socket.emit('typing:stop', { room: state.activeRoom });
  }, 2000);
}

// ==========================================
// Socket.io Event Listeners (Spec Compliant)
// ==========================================

// 1. Connection Event
socket.on('connect', () => {
  elements.socketStatusDot.style.backgroundColor = 'var(--online)';
  elements.socketStatusDot.title = `Connected (${socket.id})`;
  state.currentUser.socketId = socket.id;
  if (elements.currentUserSocket) {
    elements.currentUserSocket.textContent = `#${socket.id.substring(0, 5)}`;
  }
});

socket.on('disconnect', () => {
  elements.socketStatusDot.style.backgroundColor = 'var(--offline)';
  elements.socketStatusDot.title = 'Disconnected from server';
});

// 2. user:login:success
socket.on('user:login:success', (profile) => {
  state.currentUser = profile;
  elements.currentUserName.textContent = profile.username;
  elements.currentUserAvatar.src = profile.avatar;
  elements.currentUserSocket.textContent = `#${profile.socketId.substring(0, 5)}`;
  
  elements.loginModal.classList.add('hidden');
  elements.appContainer.classList.remove('hidden');

  // Join initial default room
  switchToRoom('general');
});

// 3. room:history: { room, messages: [...] }
socket.on('room:history', ({ room, messages }) => {
  if (state.currentMode === 'room' && state.activeRoom === room) {
    elements.messagesList.innerHTML = '';
    if (messages && messages.length > 0) {
      messages.forEach(msg => {
        const isSelf = typeof msg.sender === 'object' ? msg.sender.socketId === socket.id : false;
        renderMessageItem(msg, isSelf, false);
      });
    }
    scrollToBottom();
  }
});

// 4. room:userlist: { room, users: [...] }
socket.on('room:userlist', ({ room, users }) => {
  if (state.currentMode === 'room' && state.activeRoom === room) {
    renderUserRoster(users || []);
  }
});

// 5. chat:receive: { id, sender, message, timestamp }
socket.on('chat:receive', (msg) => {
  if (state.currentMode === 'room' && msg.room === state.activeRoom) {
    const isSelf = typeof msg.sender === 'object' ? msg.sender.socketId === socket.id : false;
    renderMessageItem(msg, isSelf, false);
  }
});

// 6. typing:update: { room, username, isTyping }
socket.on('typing:update', ({ room, username, isTyping }) => {
  if (state.currentMode === 'room' && room === state.activeRoom) {
    if (isTyping) {
      state.roomTypingUsers.add(username);
    } else {
      state.roomTypingUsers.delete(username);
    }
    updateTypingBanner();
  }
});

// 7. direct:receive: { id, from, message, timestamp }
socket.on('direct:receive', (dmPayload) => {
  const senderSocketId = dmPayload.from.socketId;

  // Add to local dmHistories
  if (!state.dmHistories[senderSocketId]) {
    state.dmHistories[senderSocketId] = [];
  }
  state.dmHistories[senderSocketId].push(dmPayload);

  // Add or update conversation entry
  const conv = state.dmConversations.get(senderSocketId) || {
    socketId: senderSocketId,
    username: dmPayload.from.username,
    avatar: dmPayload.from.avatar,
    unread: 0
  };

  // If currently chatting with this user, render directly
  if (state.currentMode === 'dm' && state.activeDmUser && state.activeDmUser.socketId === senderSocketId) {
    renderMessageItem(dmPayload, false, true);
  } else {
    conv.unread = (conv.unread || 0) + 1;
    showToast(`New Direct Message from ${dmPayload.from.username}: "${dmPayload.message.substring(0, 30)}"`, true);
  }

  state.dmConversations.set(senderSocketId, conv);
  updateDmSidebarList();
});

// 8. direct:sent: (Confirmation for sender)
socket.on('direct:sent', (dmPayload) => {
  const recipientSocketId = dmPayload.to.socketId;
  
  if (!state.dmHistories[recipientSocketId]) {
    state.dmHistories[recipientSocketId] = [];
  }
  state.dmHistories[recipientSocketId].push(dmPayload);

  if (state.currentMode === 'dm' && state.activeDmUser && state.activeDmUser.socketId === recipientSocketId) {
    renderMessageItem(dmPayload, true, true);
  }
});

// 9. direct:error:
socket.on('direct:error', ({ message }) => {
  showToast(message || 'Failed to send direct message.');
});

// ==========================================
// DOM Event Listeners & Interactions
// ==========================================

// Login Form Submission
elements.loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = elements.usernameInput.value.trim();
  if (!username) return;

  socket.emit('user:login', {
    username,
    avatar: selectedAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`
  });
});

// Chat Form Submission (Group Message or DM)
elements.chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = elements.messageInput.value.trim();
  if (!text) return;

  if (state.currentMode === 'room') {
    // Clear typing state immediately on send
    if (state.isTyping) {
      state.isTyping = false;
      clearTimeout(state.typingTimer);
      socket.emit('typing:stop', { room: state.activeRoom });
    }

    // Send group message
    socket.emit('chat:send', {
      room: state.activeRoom,
      message: text
    });
  } else if (state.currentMode === 'dm' && state.activeDmUser) {
    // Send private direct message
    socket.emit('direct:send', {
      recipientId: state.activeDmUser.socketId,
      message: text
    });
  }

  elements.messageInput.value = '';
  elements.messageInput.focus();
  elements.emojiPicker.classList.add('hidden');
});

// Message Input Typing Debounce Handler
elements.messageInput.addEventListener('input', handleTypingInput);

// Channel Selection Clicks
elements.channelList.addEventListener('click', (e) => {
  const channelItem = e.target.closest('.channel-item');
  if (channelItem) {
    const room = channelItem.dataset.room;
    if (room && (state.currentMode !== 'room' || state.activeRoom !== room)) {
      switchToRoom(room);
    }
  }
});

// Create / Custom Room Modal Handlers
elements.btnCreateRoom.addEventListener('click', () => {
  elements.customRoomModal.classList.remove('hidden');
  elements.customRoomInput.value = '';
  elements.customRoomInput.focus();
});

elements.btnCloseRoomModal.addEventListener('click', () => {
  elements.customRoomModal.classList.add('hidden');
});

elements.customRoomForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const roomName = elements.customRoomInput.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
  if (!roomName) return;

  // Add to sidebar if not already in list
  if (!state.knownRooms.includes(roomName)) {
    state.knownRooms.push(roomName);
    const li = document.createElement('li');
    li.className = 'channel-item';
    li.dataset.room = roomName;
    li.innerHTML = `
      <i class="fa-solid fa-hashtag"></i>
      <span class="channel-name">${escapeHtml(roomName)}</span>
    `;
    elements.channelList.appendChild(li);
  }

  elements.customRoomModal.classList.add('hidden');
  switchToRoom(roomName);
});

// Copy Socket ID Button
elements.btnCopyId.addEventListener('click', () => {
  if (socket.id) {
    navigator.clipboard.writeText(socket.id).then(() => {
      showToast(`Copied Socket ID: ${socket.id}`);
    }).catch(() => {
      showToast(`Socket ID: ${socket.id}`);
    });
  }
});

// Emoji Toolbar Toggle
elements.btnEmojiToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  elements.emojiPicker.classList.toggle('hidden');
});

elements.emojiPicker.addEventListener('click', (e) => {
  if (e.target.classList.contains('emoji-btn')) {
    elements.messageInput.value += e.target.textContent;
    elements.messageInput.focus();
  }
});

document.addEventListener('click', (e) => {
  if (!elements.emojiPicker.contains(e.target) && e.target !== elements.btnEmojiToggle) {
    elements.emojiPicker.classList.add('hidden');
  }
});

// Toggle Roster on small screens
elements.btnToggleRoster.addEventListener('click', () => {
  elements.sidebarRoster.classList.toggle('collapsed');
});

// Activity Nav buttons
elements.navChannelsBtn.addEventListener('click', () => {
  elements.navChannelsBtn.classList.add('active');
  elements.navDmsBtn.classList.remove('active');
  elements.channelsSection.scrollIntoView({ behavior: 'smooth' });
});

elements.navDmsBtn.addEventListener('click', () => {
  elements.navDmsBtn.classList.add('active');
  elements.navChannelsBtn.classList.remove('active');
  elements.dmsSection.scrollIntoView({ behavior: 'smooth' });
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initAvatarPicker();
  elements.usernameInput.focus();
});
