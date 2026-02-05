import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { getMongoDb } from '@/lib/mongodb';
import { createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const users = db.collection('users');

    const existing = await users.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await users.insertOne({
      id: userId,
      email,
      passwordHash,
      isAnonymous: false,
      createdAt: new Date(),
    });

    const token = await createToken(userId);
    return NextResponse.json({ token, user: { id: userId, email } });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Signup error' }, { status: 500 });
  }
}
