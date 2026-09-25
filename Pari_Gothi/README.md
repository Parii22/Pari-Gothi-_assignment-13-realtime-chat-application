# PulseChat — Real-Time Group Chat & Direct Messaging Engine

A high-performance, production-ready Real-Time Group Chat & Direct Messaging Engine built with **Node.js**, **Express.js**, and **Socket.io**. Features multi-room channels, instant in-memory message history replay, debounced typing indicators, live presence rosters, and private 1-on-1 direct messaging delivered strictly to the target recipient socket.

---

## 🚀 Key Features

1. **Multi-Room & Multi-Channel Chat**:
   - Join named channels like `#general`, `#developers`, `#random`, or create dynamic custom rooms at runtime via `socket.join(room)` and `socket.leave(room)`.
2. **User Identity & Avatar Registration**:
   - Client sends `user:login` mapping their socket ID to an interactive persona and username.
3. **In-Memory Message History Buffer (MAX_HISTORY = 50)**:
   - Preserves up to 50 recent messages per room in server RAM. Replays history instantly to newly joined users (`room:history`).
4. **Targeted Group Messaging**:
   - Real-time chat (`chat:send` -> `chat:receive`) broadcast strictly to active participants in the respective room.
5. **Private Direct Messaging (DMs)**:
   - Private 1-on-1 messages (`direct:send` -> `direct:receive`) delivered **only** to the recipient's socket (`io.to(recipientSocketId)`). Never leaks to public room channels.
6. **Debounced Typing Indicators**:
   - `typing:start` and `typing:stop` client events with a 2-second debounce timer to prevent server flooding. Relayed only to other room members (`typing:update`).
7. **Live Room Presence & User Roster**:
   - Online member roster (`room:userlist`) dynamically updated across room joins, leaves, and disconnects.
8. **Clean Disconnect Handling**:
   - Graceful cleanup on socket disconnects, updating user mappings and broadcasting roster changes immediately.

---

## 📁 Directory Structure

```
Pari_Gothi/
├── public/
│   ├── index.html       # Modern dark-themed UI: channels, user roster, chat feed, input
│   ├── app.js           # Client-side Socket.io events, debounced typing, DMs & DOM logic
│   └── style.css        # Responsive dark theme, chat bubbles, glassmorphism design
├── sockets/
│   ├── chatHandler.js   # chat:send/receive, direct:send/receive, typing indicators
│   └── userHandler.js   # user:login, room:join/leave, disconnect, presence broadcasting
├── utils/
│   └── messageStore.js  # roomHistories state buffer + addMessageToHistory() (MAX_HISTORY = 50)
├── server.js            # Express & Socket.io server bootstrap
├── package.json         # Project dependencies & scripts
├── .env                 # Environment variables (PORT)
├── .env.example         # Example configuration
├── .gitignore           # Git ignore rules
└── README.md            # Documentation & deployment guide
```

---

## 📡 Socket.io Event Protocol Specification

### 1. Session & Room Management

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `user:login` | Client ➔ Server | `{ username: string, avatar: string }` | Registers user identity and maps to socket. |
| `user:login:success` | Server ➔ Client | `{ socketId, username, avatar, currentRoom }` | Confirms authentication and provides profile. |
| `room:join` | Client ➔ Server | `{ room: string }` | Joins a chat channel via `socket.join(room)`. |
| `room:history` | Server ➔ Client | `{ room: string, messages: Array }` | Replays the last 50 messages to the joining socket. |
| `room:userlist` | Server ➔ Room | `{ room: string, users: Array }` | Broadcasts active online user roster to the room. |
| `room:leave` | Client ➔ Server | `{ room: string }` | Leaves channel via `socket.leave(room)` and updates roster. |

### 2. Messaging & Indicators

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `chat:send` | Client ➔ Server | `{ room: string, message: string }` | Client sends message to room channel. |
| `chat:receive` | Server ➔ Room | `{ id, room, sender, message, timestamp }` | Broadcast to all active users in that room. |
| `typing:start` | Client ➔ Server | `{ room: string }` | Emitted when user starts typing in a channel. |
| `typing:stop` | Client ➔ Server | `{ room: string }` | Emitted after 2 seconds of inactivity or message send. |
| `typing:update` | Server ➔ Room | `{ room: string, username: string, isTyping: boolean }` | Broadcast to other room members (excluding sender). |
| `direct:send` | Client ➔ Server | `{ recipientId: string, message: string }` | Sends private direct message to specific socket ID. |
| `direct:receive` | Server ➔ Client | `{ id, from, to, message, timestamp }` | Delivered **strictly** to intended recipient socket. |
| `direct:sent` | Server ➔ Client | `{ id, from, to, message, timestamp }` | Sent back to sender client for instant thread display. |

---

## 🛠️ In-Memory Data Structures

```javascript
// Connected Users State
const connectedUsers = new Map(); // socketId -> { socketId, username, avatar, currentRoom }

// In-Memory Message History Buffer (Max 50 per channel)
const roomHistories = {
  "general": [],
  "developers": [],
  "random": []
};
const MAX_HISTORY = 50;

function addMessageToHistory(room, messageObj) {
  if (!roomHistories[room]) roomHistories[room] = [];
  roomHistories[room].push(messageObj);
  if (roomHistories[room].length > MAX_HISTORY) {
    roomHistories[room].shift();
  }
}
```

---

## 💻 Local Setup & Execution

### 1. Install Dependencies
Navigate into `Pari_Gothi` and install required packages:
```bash
cd Pari_Gothi
npm install
```

### 2. Start the Server
- **Production Mode:**
  ```bash
  npm start
  ```
- **Development Mode (with auto-reload):**
  ```bash
  npm run dev
  ```

### 3. Open in Browser
Visit `http://localhost:5000` in your web browser.

---

## 🧪 Testing Multi-User Chat Flow

1. Open three browser windows/tabs:
   - **Tab 1**: Login as **Aarav**
   - **Tab 2**: Login as **Priya**
   - **Tab 3**: Login as **Rohan**
2. **Channel Isolation**:
   - Aarav and Priya join `#developers`.
   - Rohan joins `#random`.
3. **Typing Indicators**:
   - When Aarav types in `#developers`, Priya sees `"Aarav is typing..."`. Rohan in `#random` sees nothing.
4. **Group Messages**:
   - When Aarav sends `"Hello Devs!"`, Priya receives the message immediately. Rohan receives nothing in `#random`.
5. **History Hydration**:
   - Open a 4th tab and join `#developers`. The recent chat history is immediately visible.
6. **Direct Messaging (DMs)**:
   - Aarav clicks Priya in the online user roster and sends a private direct message.
   - Priya receives the private message in her DM tab.
   - Rohan and the `#developers` channel never receive or see this message.

---

## 🌐 Deploying to Render

Follow these exact steps to deploy this project live on Render:

### Step 1: Push Code to GitHub
1. In your terminal, initialize and commit your repository:
   ```bash
   git add .
   git commit -m "Complete Real-Time Group Chat and Direct Messaging Engine"
   git branch -M main
   ```
2. Create a new GitHub repository named `itm-assignment-13-chat-socket` (or your preferred name).
3. Link and push to GitHub:
   ```bash
   git remote add origin https://github.com/<YOUR_USERNAME>/itm-assignment-13-chat-socket.git
   git push -u origin main
   ```

### Step 2: Create Web Service on Render
1. Go to [render.com](https://render.com) and log in with GitHub.
2. Click **New +** ➔ **Web Service**.
3. Select your repository: `itm-assignment-13-chat-socket`.
4. Configure service settings:
   - **Root Directory**: `Pari_Gothi` (if you are pushing the parent folder) or leave blank if pushing `Pari_Gothi` directly.
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Click **Create Web Service**.

### Step 3: Verify Live Deployment
- Once the build succeeds and logs display `🚀 Real-Time Chat Engine running on PORT ...`, open the assigned `.onrender.com` URL.
- Test across multiple browser windows to verify real-time group chat, typing indicators, and private direct messaging!
