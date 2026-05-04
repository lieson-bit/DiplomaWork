const WebSocket = require('ws');
const readline = require('readline');

const WS_URL = 'ws://localhost:3004/ws'; // or 8080 if using standalone

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔌 WebSocket Test Client');
console.log('=======================\n');

rl.question('Enter user ID to authenticate as: ', (userId) => {
  rl.question('Enter user type (customer/driver): ', (userType) => {
    
    console.log(`\nConnecting to ${WS_URL}...`);
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      console.log('✅ Connected to WebSocket server');
      
      // Authenticate
      ws.send(JSON.stringify({
        type: 'authenticate',
        data: {
          userId: userId,
          userType: userType,
          token: 'test-token' // In production, use real JWT
        }
      }));
      
      console.log(`\n🔐 Authenticating as ${userType}: ${userId}`);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('\n📩 Received message:');
        console.log('Type:', message.type);
        console.log('Data:', JSON.stringify(message.data, null, 2));
        console.log('Timestamp:', new Date(message.timestamp).toLocaleTimeString());
        
        // Special handling for different message types
        if (message.type === 'new_order_available') {
          console.log('\n🚚 NEW ORDER FOR DRIVER!');
          console.log('Action required: Accept or Reject');
        } else if (message.type === 'order_accepted') {
          console.log('\n✅ ORDER ACCEPTED!');
        } else if (message.type === 'order_rejected') {
          console.log('\n❌ ORDER REJECTED!');
        } else if (message.type === 'notification') {
          console.log('\n🔔 NOTIFICATION!');
        }
        
      } catch (error) {
        console.log('\n📩 Raw message:', data.toString());
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });

    ws.on('close', () => {
      console.log('🔌 Disconnected from WebSocket server');
    });

    // Keep connection alive with ping
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', data: {} }));
      }
    }, 30000);

    console.log('\n📝 Listening for messages... (Press Ctrl+C to exit)');
    
    // Handle exit
    process.on('SIGINT', () => {
      clearInterval(interval);
      ws.close();
      rl.close();
      process.exit();
    });
  });
});
