import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getMongoDb } from '@/lib/mongodb';
import { createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = uuidv4();
    const db = await getMongoDb();
    const users = db.collection('users');

    await users.insertOne({
      id: userId,
      email: `anon_${userId}@anonymous.local`,
      passwordHash: '',
      isAnonymous: true,
      createdAt: new Date(),
    });

    const token = await createToken(userId);
    return NextResponse.json({ token, user: { id: userId, email: 'Anonymous' } });
  } catch (error) {
    console.error('Anonymous signin error:', error);
    return NextResponse.json({ error: 'Anonymous signin error' }, { status: 500 });
  }
}
