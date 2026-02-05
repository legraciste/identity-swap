import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

interface Vote {
  id: string;
  gameId: string;
  voterId: string;
  targetUserId: string;
  guessedIdentityId: string;
  createdAt: Date;
}

interface Participant {
  userId: string;
  assignedIdentityId: string;
  isDiscovered: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId, targetUserId, guessedIdentityId } = await request.json();
    if (!gameId || !targetUserId || !guessedIdentityId) {
      return NextResponse.json({ error: 'Game ID, target user ID, and guessed identity ID required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const votes = db.collection('votes');

    const voteId = uuidv4();
    await votes.insertOne({
      id: voteId,
      gameId,
      voterId: userId,
      targetUserId,
      guessedIdentityId,
      createdAt: new Date(),
    });

    return NextResponse.json({ id: voteId, gameId, voterId: userId, targetUserId, guessedIdentityId });
  } catch (error) {
    console.error('Submit vote error:', error);
    return NextResponse.json({ error: 'Vote error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = await getMongoDb();
    const votes = db.collection('votes');
    const games = db.collection('games');
    const profiles = db.collection('profiles');

    const url = new URL(request.url);
    const gameId = url.searchParams.get('gameId');

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID required' }, { status: 400 });
    }

    const game = await games.findOne({ id: gameId });
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gameVotes = await votes.find({ gameId }).toArray();

    const results = await Promise.all(
      game.participants.map(async (participant: Participant) => {
        const userProfile = await profiles.findOne({ userId: participant.userId });
        const assignedProfile = await profiles.findOne({ userId: participant.assignedIdentityId });

        const correctGuesses = (gameVotes as unknown as Vote[]).filter(
          (v: Vote) => v.targetUserId === participant.userId && v.guessedIdentityId === participant.assignedIdentityId
        ).length;

        return {
          userId: participant.userId,
          userName: userProfile?.displayName || 'Anonyme',
          userProfile,
          assignedProfile,
          correctGuesses,
          totalVotes: (gameVotes as unknown as Vote[]).filter((v: Vote) => v.targetUserId === participant.userId).length,
          wasGuessedCorrectly: correctGuesses > 0,
        };
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Get votes error:', error);
    return NextResponse.json({ error: 'Votes error' }, { status: 500 });
  }
}
