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

async function startGame(gameId: string) {
  const db = await getMongoDb();
  const games = db.collection('games');
  const game = await games.findOne({ id: gameId });
  if (!game) return;

  const participants: Participant[] = game.participants || [];
  if (!participants || participants.length < 2) return;

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

    const alreadyParticipant = (game.participants || []).some((p: Participant) => p.userId === userId);
    if (alreadyParticipant) {
      return NextResponse.json({ success: true, alreadyInGame: true });
    }

    const updated = await games.findOneAndUpdate(
      { id: gameId },
      { $push: { participants: { userId, assignedIdentityId: null, isDiscovered: false } } } as any,
      { returnDocument: 'after' }
    );

    if (updated && (updated.participants || []).length >= 3) {
      await startGame(gameId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Join game error:', error);
    return NextResponse.json({ error: 'Error joining game' }, { status: 500 });
  }
}
