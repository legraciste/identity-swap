import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Game name required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const games = db.collection('games');

    const gameId = uuidv4();

    await games.insertOne({
      id: gameId,
      name,
      creatorId: userId,
      status: 'waiting',
      participants: [],
      createdAt: new Date(),
      startedAt: null,
      finishedAt: null,
    });

    return NextResponse.json({ id: gameId, name, creatorId: userId, status: 'waiting' });
  } catch (error) {
    console.error('Create game error:', error);
    return NextResponse.json({ error: 'Game error' }, { status: 500 });
  }
}
