import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { getMongoDb } from '@/lib/mongodb';
import { createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    const body = await request.json();

    if (path.endsWith('/signup')) {
      const { email, password, name } = body;
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
    }

    if (path.endsWith('/signin')) {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
      }

      const db = await getMongoDb();
      const users = db.collection('users');

      const user = await users.findOne({ email });
      if (!user) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash || '');
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      const token = await createToken(user.id);
      return NextResponse.json({ token, user: { id: user.id, email: user.email } });
    }

    if (path.endsWith('/anonymous-signin')) {
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
    }

    if (path.endsWith('/me')) {
      const token = request.headers.get('Authorization')?.replace('Bearer ', '');
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const db = await getMongoDb();
      const users = db.collection('users');

      // Note: You would normally verify the token here
      // For now, we'll just return a basic response
      return NextResponse.json({ user: { id: 'user_id', email: 'user@email.com' } });
    }

    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
