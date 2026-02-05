import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

interface Participant {
  userId: string;
  assignedIdentityId: string | null;
  isDiscovered: boolean;
}

function shuffle(array: string[]): string[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

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
      return NextResponse.json({ error: 'Only creator can start the game' }, { status: 403 });
    }

    const participants: Participant[] = game.participants || [];
    if (!participants || participants.length < 2) {
      return NextResponse.json({ error: 'Not enough participants' }, { status: 400 });
    }

    const userIds = participants.map((p: Participant) => p.userId);
    const shuffled = shuffle(userIds);

    const updates = participants.map((p: Participant, i: number) => ({
      userId: p.userId,
      assignedIdentityId: shuffled[i],
      isDiscovered: false,
    }));

    await games.updateOne(
      { id: gameId },
      { $set: { participants: updates, status: 'active', startedAt: new Date() } }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Start game error:', error);
    return NextResponse.json({ error: 'Error starting game' }, { status: 500 });
  }
}
