const { io } = require('socket.io-client');

async function runTests() {
  console.log('--- Starting Automated Socket & Multi-Client Tests ---');
  const SERVER_URL = 'http://localhost:5050';

  // 1. Connect Client A (Aarav), Client B (Priya), Client C (Rohan)
  const clientA = io(SERVER_URL);
  const clientB = io(SERVER_URL);
  const clientC = io(SERVER_URL);

  await new Promise(r => setTimeout(r, 500));

  console.log('Client A Socket ID:', clientA.id);
  console.log('Client B Socket ID:', clientB.id);
  console.log('Client C Socket ID:', clientC.id);

  // 2. Login
  clientA.emit('user:login', { username: 'Aarav', avatar: 'avatar_aarav.svg' });
  clientB.emit('user:login', { username: 'Priya', avatar: 'avatar_priya.svg' });
  clientC.emit('user:login', { username: 'Rohan', avatar: 'avatar_rohan.svg' });

  await new Promise(r => setTimeout(r, 500));

  // 3. Aarav and Priya join #developers, Rohan joins #random
  clientA.emit('room:join', { room: 'developers' });
  clientB.emit('room:join', { room: 'developers' });
  clientC.emit('room:join', { room: 'random' });

  await new Promise(r => setTimeout(r, 500));

  // Set up listeners to verify test flow
  let priyaGotTyping = false;
  let rohanGotTyping = false;
  let priyaGotChat = false;
  let rohanGotChat = false;
  let priyaGotDm = false;
  let rohanGotDm = false;

  clientB.on('typing:update', (data) => {
    console.log('[TEST CHECK] Priya received typing update:', data);
    priyaGotTyping = true;
  });

  clientC.on('typing:update', (data) => {
    console.log('[TEST ERROR] Rohan in #random should NOT receive typing update for #developers:', data);
    rohanGotTyping = true;
  });

  clientB.on('chat:receive', (data) => {
    console.log('[TEST CHECK] Priya received group chat message:', data.message);
    priyaGotChat = true;
  });

  clientC.on('chat:receive', (data) => {
    console.log('[TEST ERROR] Rohan in #random should NOT receive #developers chat:', data);
    rohanGotChat = true;
  });

  clientB.on('direct:receive', (data) => {
    console.log('[TEST CHECK] Priya received Direct Message:', data.message);
    priyaGotDm = true;
  });

  clientC.on('direct:receive', (data) => {
    console.log('[TEST ERROR] Rohan should NOT receive private DM intended for Priya:', data);
    rohanGotDm = true;
  });

  // 4. Aarav starts typing in #developers
  console.log('\n--- Step 1: Typing Indicator Test ---');
  clientA.emit('typing:start', { room: 'developers' });
  await new Promise(r => setTimeout(r, 500));

  // 5. Aarav sends chat to #developers
  console.log('\n--- Step 2: Group Message Test ---');
  clientA.emit('chat:send', { room: 'developers', message: 'Hello Priya, working on the API!' });
  await new Promise(r => setTimeout(r, 500));

  // 6. Aarav sends private DM to Priya (using Priya's socket ID)
  console.log('\n--- Step 3: Direct Message (DM) Test ---');
  clientA.emit('direct:send', { recipientId: clientB.id, message: 'Hey Priya, secret DM!' });
  await new Promise(r => setTimeout(r, 500));

  // 7. Client D joins #developers and checks history hydration
  console.log('\n--- Step 4: History Hydration Test (Client D) ---');
  const clientD = io(SERVER_URL);
  await new Promise(r => setTimeout(r, 300));
  clientD.emit('user:login', { username: 'NewDev' });
  
  let hydrationSuccess = false;
  clientD.on('room:history', ({ room, messages }) => {
    console.log(`[TEST CHECK] Client D received history for #${room}: ${messages.length} messages`);
    if (messages.length > 0 && messages[0].message === 'Hello Priya, working on the API!') {
      hydrationSuccess = true;
    }
  });
  clientD.emit('room:join', { room: 'developers' });

  await new Promise(r => setTimeout(r, 800));

  console.log('\n=========================================');
  console.log('TEST SUMMARY:');
  console.log('1. Priya received typing:', priyaGotTyping ? '✅ PASSED' : '❌ FAILED');
  console.log('2. Rohan isolated from typing:', !rohanGotTyping ? '✅ PASSED' : '❌ FAILED');
  console.log('3. Priya received group chat:', priyaGotChat ? '✅ PASSED' : '❌ FAILED');
  console.log('4. Rohan isolated from #developers chat:', !rohanGotChat ? '✅ PASSED' : '❌ FAILED');
  console.log('5. Priya received private DM:', priyaGotDm ? '✅ PASSED' : '❌ FAILED');
  console.log('6. Rohan isolated from private DM:', !rohanGotDm ? '✅ PASSED' : '❌ FAILED');
  console.log('7. History hydrated on new join:', hydrationSuccess ? '✅ PASSED' : '❌ FAILED');
  console.log('=========================================');

  clientA.disconnect();
  clientB.disconnect();
  clientC.disconnect();
  clientD.disconnect();

  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
