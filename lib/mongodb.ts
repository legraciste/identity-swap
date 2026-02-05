import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function initializeMongo(uri: string, dbName: string = 'identity_swap') {
  if (!uri) throw new Error('MONGODB_URI is required');
  
  if (client && db) {
    return db;
  }

  const tlsEnabled = process.env.MONGODB_TLS === 'true';
  const tlsInsecure = process.env.MONGODB_TLS_INSECURE === 'true';

  client = new MongoClient(uri, {
    connectTimeoutMS: 10000,
    ...(tlsEnabled ? { tls: true } : {}),
    ...(tlsInsecure ? { tlsAllowInvalidCertificates: true } : {}),
  });
  await client.connect();
  db = client.db(dbName);
  console.log('✅ Connected to MongoDB:', dbName);
  
  return db;
}

export async function getMongoDb(): Promise<Db> {
  if (!db) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is required');
    return initializeMongo(uri);
  }
  return db;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
