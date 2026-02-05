import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId, gameTitle, gameSummary } = await request.json();
    if (!gameId || !gameTitle || !gameSummary) {
      return NextResponse.json({ error: 'Game ID, title and summary required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const games = db.collection('games');

    // Check if user is creator
    const game = await games.findOne({ id: gameId });
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.creatorId !== userId) {
      return NextResponse.json({ error: 'Only creator can set mini-games' }, { status: 403 });
    }

    await games.updateOne(
      { id: gameId },
      {
        $set: {
          gameTitle,
          gameSummary,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Set mini-games error:', error);
    return NextResponse.json({ error: 'Error setting mini-games' }, { status: 500 });
  }
}
