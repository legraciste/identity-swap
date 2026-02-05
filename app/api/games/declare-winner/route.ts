import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId, winnerUserId } = await request.json();
    if (!gameId || !winnerUserId) {
      return NextResponse.json({ error: 'Game ID and winner user ID required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const games = db.collection('games');
    const game = await games.findOne({ id: gameId });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Only creator can declare winner
    if (game.creatorId !== userId) {
      return NextResponse.json({ error: 'Only creator can declare winner' }, { status: 403 });
    }

    // Update game with winner
    await games.updateOne(
      { id: gameId },
      {
        $set: {
          winnerId: winnerUserId,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Declare winner error:', error);
    return NextResponse.json({ error: 'Error declaring winner' }, { status: 500 });
  }
}
