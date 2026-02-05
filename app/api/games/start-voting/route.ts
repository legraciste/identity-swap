import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId } = await request.json();
    if (!gameId) {
      return NextResponse.json({ error: 'Game ID required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const games = db.collection('games');
    const game = await games.findOne({ id: gameId });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.creatorId !== userId) {
      return NextResponse.json({ error: 'Only creator can start voting' }, { status: 403 });
    }

    await games.updateOne({ id: gameId }, { $set: { status: 'voting' } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Start voting error:', error);
    return NextResponse.json({ error: 'Error starting voting' }, { status: 500 });
  }
}
