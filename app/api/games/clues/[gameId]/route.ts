import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest, context: { params: { gameId: string } }) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId } = context.params;
    if (!gameId || gameId === 'undefined' || gameId === 'null') {
      return NextResponse.json([]);
    }

    const db = await getMongoDb();
    const games = db.collection('games');

    const game = await games.findOne({
      id: gameId,
      'participants.userId': userId,
    });

    if (!game || !Array.isArray(game.clues)) {
      return NextResponse.json([]);
    }

    return NextResponse.json(game.clues);
  } catch (error) {
    console.error('Get clues history error:', error);
    return NextResponse.json([]);
  }
}
