export async function seedInitialData() {
  console.log('🌱 Checking if sample data needs to be seeded...');
  
  try {
    // Just log sample accounts
    console.log('📋 Sample accounts (for manual testing):');
    console.log('   Driver: driver1@deliverymatch.com / password123');
    console.log('   Customer: customer1@deliverymatch.com / password123');
    console.log('');
    console.log('ℹ️  Seed functionality is disabled. Please register new users manually.');
    
  } catch (error) {
    console.error('❌ Error in seed data:', error);
  }
}