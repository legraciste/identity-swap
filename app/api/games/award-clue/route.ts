import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId, targetUserId } = await request.json();
    if (!gameId || !targetUserId) {
      return NextResponse.json({ error: 'Game ID and target user ID required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const games = db.collection('games');
    const profiles = db.collection('profiles');
    const v4 = (await import('uuid')).v4;

    const game = await games.findOne({ id: gameId });
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Find who is PLAYING the target identity
    // targetUserId is the identity being played, we need to find who has assignedIdentityId === targetUserId
    const playerWhoPlaysTarget = game.participants?.find((p: any) => p.assignedIdentityId === targetUserId);
    if (!playerWhoPlaysTarget) {
      return NextResponse.json({ error: 'Player playing target identity not found' }, { status: 404 });
    }

    const realPlayerId = playerWhoPlaysTarget.userId;

    // Get the real profile of the player (not the identity they're playing)
    const realPlayerProfile = await profiles.findOne({ userId: realPlayerId, gameId });
    if (!realPlayerProfile || !realPlayerProfile.displayName) {
      return NextResponse.json({ error: 'Real player profile not found' }, { status: 404 });
    }

    // Get a random letter from the real player's display name
    const displayName = realPlayerProfile.displayName.toUpperCase();
    const letters = displayName.split('').filter((char: string) => /[A-Z]/.test(char));
    if (letters.length === 0) {
      return NextResponse.json({ error: 'No valid letters in display name' }, { status: 400 });
    }
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];

    const clueId = v4();
    await games.updateOne(
      { id: gameId },
      {
        $push: {
          clues: {
            id: clueId,
            recipientUserId: userId,
            targetUserId: targetUserId,
            letter: randomLetter,
            createdAt: new Date(),
          },
        } as any,
        $set: { winnerId: null }
      }
    );

    return NextResponse.json({ id: clueId, letter: randomLetter, success: true });
  } catch (error) {
    console.error('Award clue error:', error);
    return NextResponse.json({ error: 'Error awarding clue' }, { status: 500 });
  }
}
