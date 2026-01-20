const axios = require('axios');
const fs = require('fs');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

console.log(`${colors.cyan}🚀 Starting data seeding debug...${colors.reset}\n`);

// Check if services are running
const services = [
  { name: 'User Service', url: 'http://localhost:3001' },
  { name: 'Driver Service', url: 'http://localhost:3002' },
  { name: 'Customer Service', url: 'http://localhost:3003' }
];

async function checkService(url, name) {
  console.log(`${colors.blue}🔍 Checking ${name} at ${url}...${colors.reset}`);
  
  try {
    const response = await axios.get(`${url}/health`, { timeout: 5000 });
    console.log(`${colors.green}✅ ${name} is running!${colors.reset}`);
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Service: ${response.data.service}`);
    console.log(`   Timestamp: ${response.data.timestamp}`);
    return true;
  } catch (error) {
    console.log(`${colors.red}❌ ${name} is NOT running${colors.reset}`);
    console.log(`   Error: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log(`   ${colors.yellow}Make sure ${name} is started on port ${url.split(':').pop()}${colors.reset}`);
    }
    
    return false;
  }
}

async function testUserService() {
  console.log(`\n${colors.magenta}📝 Testing User Service endpoints...${colors.reset}`);
  
  const testUser = {
    email: `test_${Date.now()}@example.com`,
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    userType: 'customer',
    phone: '+1234567890'
  };
  
  try {
    console.log(`${colors.blue}Attempting to register user: ${testUser.email}${colors.reset}`);
    
    const response = await axios.post('http://localhost:3001/api/auth/register', testUser, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`${colors.green}✅ User registration successful!${colors.reset}`);
    console.log(`   User ID: ${response.data.user?.id || 'N/A'}`);
    console.log(`   Has Token: ${!!response.data.tokens?.accessToken}`);
    
    if (response.data.tokens?.accessToken) {
      console.log(`${colors.green}✅ Auth token received!${colors.reset}`);
      return {
        token: response.data.tokens.accessToken,
        userId: response.data.user.id,
        email: testUser.email,
        password: testUser.password
      };
    }
    
    return null;
  } catch (error) {
    console.log(`${colors.red}❌ User registration failed${colors.reset}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    
    return null;
  }
}

async function testDriverService(token) {
  console.log(`\n${colors.magenta}🚗 Testing Driver Service endpoints...${colors.reset}`);
  
  if (!token) {
    console.log(`${colors.yellow}⚠️  Skipping - no auth token${colors.reset}`);
    return;
  }
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  try {
    // Try to get driver profile
    console.log(`${colors.blue}Testing GET /api/drivers/profile...${colors.reset}`);
    
    const profileResponse = await axios.get('http://localhost:3002/api/drivers/profile', {
      headers,
      timeout: 5000
    });
    
    console.log(`${colors.green}✅ Driver profile exists!${colors.reset}`);
    console.log(`   Profile ID: ${profileResponse.data.data?.id || 'N/A'}`);
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`${colors.yellow}⚠️  Driver profile not found (404) - this is normal for new users${colors.reset}`);
      
      // Try to create a driver profile
      console.log(`${colors.blue}Attempting to create driver profile...${colors.reset}`);
      
      try {
        const createResponse = await axios.post(
          'http://localhost:3002/api/drivers/profile',
          {
            licenseNumber: 'TEST123456',
            licenseExpiry: '2025-12-31',
            insuranceNumber: 'INS123456',
            insuranceExpiry: '2025-12-31'
          },
          { headers, timeout: 5000 }
        );
        
        console.log(`${colors.green}✅ Driver profile created!${colors.reset}`);
        return true;
      } catch (createError) {
        console.log(`${colors.red}❌ Failed to create driver profile${colors.reset}`);
        console.log(`   Error: ${createError.response?.data?.message || createError.message}`);
        return false;
      }
    } else {
      console.log(`${colors.red}❌ Driver service error${colors.reset}`);
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }
}

async function testCustomerService(token, userId) {
  console.log(`\n${colors.magenta}🛒 Testing Customer Service endpoints...${colors.reset}`);
  
  if (!token) {
    console.log(`${colors.yellow}⚠️  Skipping - no auth token${colors.reset}`);
    return;
  }
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  try {
    // Try to get customer profile
    console.log(`${colors.blue}Testing GET /api/customers/profile...${colors.reset}`);
    
    const profileResponse = await axios.get('http://localhost:3003/api/customers/profile', {
      headers,
      timeout: 5000
    });
    
    console.log(`${colors.green}✅ Customer profile exists!${colors.reset}`);
    console.log(`   Account Type: ${profileResponse.data.data?.accountType || 'N/A'}`);
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`${colors.yellow}⚠️  Customer profile not found (404) - attempting to create...${colors.reset}`);
      
      try {
        const createResponse = await axios.post(
          'http://localhost:3003/api/customers/profile',
          {
            userId: userId,
            accountType: 'personal',
            dateOfBirth: '1990-01-01'
          },
          { headers, timeout: 5000 }
        );
        
        console.log(`${colors.green}✅ Customer profile created!${colors.reset}`);
        
        // Try to add an address
        console.log(`${colors.blue}Testing address creation...${colors.reset}`);
        
        await axios.post(
          'http://localhost:3003/api/customers/addresses',
          {
            label: 'Home',
            address: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            country: 'US',
            postalCode: '12345',
            isDefault: true
          },
          { headers, timeout: 5000 }
        );
        
        console.log(`${colors.green}✅ Test address added!${colors.reset}`);
        return true;
      } catch (createError) {
        console.log(`${colors.red}❌ Failed to create customer profile${colors.reset}`);
        console.log(`   Error: ${createError.response?.data?.message || createError.message}`);
        return false;
      }
    } else {
      console.log(`${colors.red}❌ Customer service error${colors.reset}`);
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }
}

async function runTests() {
  console.log(`${colors.cyan}🔧 Running service health checks...${colors.reset}\n`);
  
  // Check all services
  const serviceStatus = {};
  for (const service of services) {
    serviceStatus[service.name] = await checkService(service.url, service.name);
  }
  
  console.log(`\n${colors.cyan}📊 Service Status Summary:${colors.reset}`);
  for (const [name, status] of Object.entries(serviceStatus)) {
    const icon = status ? '✅' : '❌';
    const color = status ? colors.green : colors.red;
    console.log(`${color}${icon} ${name}${colors.reset}`);
  }
  
  // If any service is down, stop here
  const allServicesRunning = Object.values(serviceStatus).every(status => status);
  if (!allServicesRunning) {
    console.log(`\n${colors.red}⚠️  Some services are not running. Please start all services first.${colors.reset}`);
    console.log(`${colors.yellow}Start commands:${colors.reset}`);
    console.log(`   User Service: cd user-service && npm run dev`);
    console.log(`   Driver Service: cd driver-service && npm run dev`);
    console.log(`   Customer Service: cd customer-service && npm run dev`);
    return;
  }
  
  console.log(`\n${colors.green}🎉 All services are running! Proceeding with API tests...${colors.reset}\n`);
  
  // Test User Service registration
  const userData = await testUserService();
  
  if (userData) {
    console.log(`\n${colors.green}✅ User created successfully!${colors.reset}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Password: ${userData.password}`);
    console.log(`   Token: ${userData.token.substring(0, 20)}...`);
  }
  
  // Test Driver Service
  await testDriverService(userData?.token);
  
  // Test Customer Service
  await testCustomerService(userData?.token, userData?.userId);
  
  console.log(`\n${colors.cyan}📋 FINAL SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}================${colors.reset}`);
  
  if (userData) {
    console.log(`${colors.green}✅ Test user created:${colors.reset}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Password: ${userData.password}`);
    console.log(`   You can use this to login to the frontend!`);
  }
  
  console.log(`\n${colors.yellow}🚀 Next steps:${colors.reset}`);
  console.log(`1. Make sure your frontend is running (npm run dev)`);
  console.log(`2. Login with the test user credentials above`);
  console.log(`3. Check if you can access the dashboard`);
  
  console.log(`\n${colors.green}✨ Debug script completed!${colors.reset}`);
}

// Run with error handling
runTests().catch(error => {
  console.error(`${colors.red}💥 Unhandled error:${colors.reset}`, error);
  process.exit(1);
});