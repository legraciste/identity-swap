import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId, miniGameState } = await request.json();
    if (!gameId) {
      return NextResponse.json({ error: 'Game ID required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const games = db.collection('games');

    await games.updateOne(
      { id: gameId },
      { $set: { miniGameState, miniGameStateUpdatedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update mini-game state error:', error);
    return NextResponse.json({ error: 'Error updating mini-game state' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gameId = request.nextUrl.searchParams.get('gameId');
    if (!gameId) {
      return NextResponse.json({ error: 'Game ID required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const games = db.collection('games');

    const game = await games.findOne({ id: gameId });
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json(game.miniGameState || null);
  } catch (error) {
    console.error('Get mini-game state error:', error);
    return NextResponse.json({ error: 'Error getting mini-game state' }, { status: 500 });
  }
}
