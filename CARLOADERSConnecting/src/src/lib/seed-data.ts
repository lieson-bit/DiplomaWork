import api from './api';
import { projectId } from '../../utils/supabase/info';

// Health check to see if the server is available
async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-50719f66/health`,
      { 
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      }
    );
    return response.ok;
  } catch (error) {
    console.log('Server health check failed:', error);
    return false;
  }
}

// This function seeds the database with initial sample data
export async function seedInitialData() {
  try {
    console.log('Checking server availability...');
    
    // Check if server is available first
    const serverAvailable = await checkServerHealth();
    if (!serverAvailable) {
      console.warn('⚠️  Backend server not available. The server may still be deploying.');
      console.warn('   Sample data seeding will be skipped.');
      console.warn('   You can still use the app, but you\'ll need to register new users.');
      return;
    }
    
    console.log('✅ Server is available. Checking if initial data needs to be seeded...');
    
    // Check if data already exists by trying to get available drivers
    const drivers = await api.driver.getAvailableDrivers();
    
    if (drivers.drivers && drivers.drivers.length > 0) {
      console.log('ℹ️  Sample data already exists, skipping seed.');
      return;
    }
    
    console.log('🌱 Seeding initial sample data...');
    
    // Create sample driver users
    const driver1 = await api.auth.register({
      email: 'driver1@deliverymatch.com',
      password: 'password123',
      firstName: 'Mike',
      lastName: 'Johnson',
      userType: 'driver',
      phone: '+1-555-0101',
    });
    
    const driver2 = await api.auth.register({
      email: 'driver2@deliverymatch.com',
      password: 'password123',
      firstName: 'Sarah',
      lastName: 'Williams',
      userType: 'driver',
      phone: '+1-555-0102',
    });
    
    const driver3 = await api.auth.register({
      email: 'driver3@deliverymatch.com',
      password: 'password123',
      firstName: 'James',
      lastName: 'Brown',
      userType: 'driver',
      phone: '+1-555-0103',
    });
    
    // Create sample customer users
    const customer1 = await api.auth.register({
      email: 'customer1@deliverymatch.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Smith',
      userType: 'customer',
      phone: '+1-555-0201',
    });
    
    const customer2 = await api.auth.register({
      email: 'customer2@deliverymatch.com',
      password: 'password123',
      firstName: 'Emma',
      lastName: 'Davis',
      userType: 'customer',
      phone: '+1-555-0202',
    });
    
    console.log('✅ Sample users created successfully!');
    console.log('');
    console.log('📋 You can now login with these test accounts:');
    console.log('   Driver: driver1@deliverymatch.com / password123');
    console.log('   Customer: customer1@deliverymatch.com / password123');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    console.error('   This is not critical - you can still register new users manually.');
    // Don't throw error, just log it - seeding is optional
  }
}
