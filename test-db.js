import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ MONGODB_URI not set in .env.local');
    process.exit(1);
  }

  console.log('🔄 Testing connection to MongoDB...');
  console.log('URI:', uri.replace(/:[^:]*@/, ':****@'));

  const client = new MongoClient(uri, { connectTimeoutMS: 10000, serverSelectionTimeoutMS: 5000 });

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('identity_swap');
    const adminDb = client.db('admin');
    
    // Test server info
    await adminDb.command({ serverStatus: 1 });
    console.log('✅ Server is running');

    // List collections
    const collections = await db.listCollections().toArray();
    console.log('✅ Collections found:', collections.map(c => c.name).join(', ') || 'None yet');

    // Try to insert test data
    const testCollection = db.collection('_test');
    const testDoc = { test: true, timestamp: new Date() };
    const result = await testCollection.insertOne(testDoc);
    console.log('✅ Can write to database (test doc ID:', result.insertedId, ')');

    // Clean up test doc
    await testCollection.deleteOne({ _id: result.insertedId });
    console.log('✅ Cleanup successful');

    console.log('\n✅ All tests passed! Database is connected and working.');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

testConnection();
