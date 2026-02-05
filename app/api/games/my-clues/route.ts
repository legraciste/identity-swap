import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gameId = request.nextUrl.searchParams.get('gameId') || '';
    if (!gameId || gameId === 'undefined' || gameId === 'null') {
      return NextResponse.json([]);
    }

    const db = await getMongoDb();
    const games = db.collection('games');

    const game = await games.findOne(
      {
        id: gameId,
        'participants.userId': userId,
      }
    );

    if (!game || !game.clues) {
      return NextResponse.json([]);
    }

    // Filter clues for the current user (recipientUserId matches userId)
    const userClues = (game.clues || []).filter((clue: any) => clue.recipientUserId === userId);

    return NextResponse.json(userClues);
  } catch (error) {
    console.error('Get my clues error:', error);
    return NextResponse.json(null);
  }
}
