const axios = require('axios');
const readline = require('readline');

const BASE_URL = 'http://localhost:3004';
const SERVICE_SECRET = 'shared_service_secret_key_1234567890';

// Sample JWT tokens (you'll need to generate these from your auth service)
// For testing, you can get these by logging in through your UI
const DRIVER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3MzgzODQ5ZC1jMzE4LTRmZDctOGM2Mi02ZTk5ODFiZWFkYzUiLCJ1c2VyVHlwZSI6ImRyaXZlciIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3Njk2MzA2NzYsImV4cCI6MTc3MDIzNTQ3Nn0.qqk0oURgFVpm0EpXFxYxmeUlN_W6CU0A31JGiOcA4gU';
const CUSTOMER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxZDI1Yjk2MS0wODcwLTRmOTItOTkxZC02Zjk2NmY1OTU2NTgiLCJ1c2VyVHlwZSI6ImN1c3RvbWVyIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3MDU0NjIwMSwiZXhwIjoxNzcxMTUxMDAxfQ.BzsdSQUWH-lVkzJAkzMQfSUKj67nrygCfPgRdG4X0oM';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createOrder() {
  console.log('\n📦 Creating test order...');
  
  const orderData = {
    orderId: `ORD-TEST-${Date.now()}`,
    customerInfo: {
      id: "1d25b961-0870-4f92-991d-6f966f595658",
      name: "Makolas Jones",
      email: "mwale22@gmail.com",
      phone: "0963884441"
    },
    driverInfo: {
      id: "1358764d-1e0b-44bd-a735-ca0fc71732f1",
      name: "Lieson Mwale",
      phone: "0963884441",
      email: "lieson22@gmail.com",
      rating: 4.8
    },
    locations: {
      pickup: {
        address: "Zagorodnyi prospekt, 24, Sankt-Peterburg",
        coordinates: { lat: 59.925209, lng: 30.341745 }
      },
      delivery: {
        address: "ulitsa Esenina, 3, Sankt-Peterburg",
        coordinates: { lat: 60.033350, lng: 30.329644 }
      },
      distance: { km: 11.287 }
    },
    packageDetails: {
      category: "furniture",
      weight: { value: 2.5, unit: "kg" },
      volume: { value: 1.4, unit: "m³" },
      urgency: "normal"
    },
    pricing: {
      estimatedPrice: { usd: 6.84, rub: 615.44 },
      currency: "USD"
    },
    timing: {
      estimatedDuration: { minutes: 15 }
    }
  };

  try {
    const response = await axios.post(`${BASE_URL}/api/orders/receive`, orderData, {
      headers: {
        'Content-Type': 'application/json',
        'x-service-secret': SERVICE_SECRET
      }
    });
    
    console.log('✅ Order created successfully!');
    console.log(`Order ID: ${response.data.data.id}`);
    console.log(`Order Number: ${response.data.data.order_number}`);
    
    return response.data.data;
  } catch (error) {
    console.error('❌ Failed to create order:', error.response?.data || error.message);
    return null;
  }
}

async function acceptOrder(orderId, driverToken) {
  console.log(`\n✅ Accepting order ${orderId}...`);
  
  try {
    const response = await axios.post(`${BASE_URL}/api/orders/${orderId}/accept`, {}, {
      headers: {
        'Authorization': `Bearer ${driverToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Order accepted successfully!');
    console.log('Response:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to accept order:', error.response?.data || error.message);
    return null;
  }
}

async function rejectOrder(orderId, driverToken, reason) {
  console.log(`\n❌ Rejecting order ${orderId}...`);
  
  try {
    const response = await axios.post(`${BASE_URL}/api/orders/${orderId}/reject`, {
      reason: reason
    }, {
      headers: {
        'Authorization': `Bearer ${driverToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Order rejected successfully!');
    console.log('Response:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to reject order:', error.response?.data || error.message);
    return null;
  }
}

async function getOrder(orderId, userToken) {
  console.log(`\n🔍 Getting order details for ${orderId}...`);
  
  try {
    const response = await axios.get(`${BASE_URL}/api/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    console.log('✅ Order retrieved successfully!');
    console.log('Status:', response.data.data.status);
    console.log('Driver accepted:', response.data.data.driver_info?.accepted);
    
    return response.data.data;
  } catch (error) {
    console.error('❌ Failed to get order:', error.response?.data || error.message);
    return null;
  }
}

async function checkWebSocketStatus() {
  try {
    const response = await axios.get(`${BASE_URL}/api/test/websocket`);
    console.log('\n📡 WebSocket Status:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Failed to check WebSocket status:', error.message);
  }
}

async function main() {
  console.log('🚀 Order Service Test CLI');
  console.log('==========================\n');
  
  // First check WebSocket status
  await checkWebSocketStatus();
  
  console.log('\n⚠️  IMPORTANT: You need valid JWT tokens for testing');
  console.log('Please update the tokens in the script file.\n');
  
  rl.question('Enter driver JWT token (or press Enter to skip): ', async (driverToken) => {
    rl.question('Enter customer JWT token (or press Enter to skip): ', async (customerToken) => {
      
      console.log('\nOptions:');
      console.log('1. Create a new order');
      console.log('2. Accept an order');
      console.log('3. Reject an order');
      console.log('4. Get order details');
      console.log('5. Check WebSocket status');
      console.log('6. Exit');
      
      rl.question('\nSelect option (1-6): ', async (option) => {
        if (option === '1') {
          const order = await createOrder();
          if (order) {
            console.log('\nNext steps:');
            console.log(`- Accept order: POST /api/orders/${order.id}/accept`);
            console.log(`- Reject order: POST /api/orders/${order.id}/reject`);
            console.log(`- Get details: GET /api/orders/${order.id}`);
          }
        } else if (option === '2') {
          if (!driverToken || driverToken === 'YOUR_DRIVER_JWT_TOKEN_HERE') {
            console.log('❌ Please provide a valid driver token first');
            rl.close();
            return;
          }
          rl.question('Enter order ID to accept: ', async (orderId) => {
            await acceptOrder(orderId, driverToken);
            rl.close();
          });
          return;
        } else if (option === '3') {
          if (!driverToken || driverToken === 'YOUR_DRIVER_JWT_TOKEN_HERE') {
            console.log('❌ Please provide a valid driver token first');
            rl.close();
            return;
          }
          rl.question('Enter order ID to reject: ', async (orderId) => {
            rl.question('Reason for rejection: ', async (reason) => {
              await rejectOrder(orderId, driverToken, reason);
              rl.close();
            });
          });
          return;
        } else if (option === '4') {
          rl.question('Enter order ID: ', async (orderId) => {
            const token = customerToken && customerToken !== 'YOUR_CUSTOMER_JWT_TOKEN_HERE' 
              ? customerToken 
              : (driverToken && driverToken !== 'YOUR_DRIVER_JWT_TOKEN_HERE' ? driverToken : null);
            
            if (!token) {
              console.log('❌ Please provide a valid token first');
              rl.close();
              return;
            }
            await getOrder(orderId, token);
            rl.close();
          });
          return;
        } else if (option === '5') {
          await checkWebSocketStatus();
        }
        
        rl.close();
      });
    });
  });
}

// Install axios if not already installed
try {
  require.resolve('axios');
} catch (e) {
  console.log('Installing axios...');
  require('child_process').execSync('npm install axios', { stdio: 'inherit' });
}

main();