import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

interface Vote {
  gameId: string;
  voterId: string;
  targetUserId: string;
  guessedIdentityId: string;
}

interface Participant {
  userId: string;
  assignedIdentityId: string;
}

async function getUserIdFromQuery(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.userId || null;
}

async function getVoteResults(gameId: string) {
  const db = await getMongoDb();
  const votes = db.collection('votes');
  const games = db.collection('games');
  const profiles = db.collection('profiles');

  const game = await games.findOne({ id: gameId });
  if (!game) return null;

  const gameVotes = (await votes.find({ gameId }).toArray()) as unknown as Vote[];
  const participants = game.participants as Participant[];

  const userIds = participants.map((p) => p.userId);
  const assignedIds = participants.map((p) => p.assignedIdentityId);
  const allIds = Array.from(new Set([...userIds, ...assignedIds]));

  const profilesData = await profiles.find({ userId: { $in: allIds }, gameId }).toArray();
  const profilesMap = new Map(profilesData.map((p) => [p.userId, p]));

  const getProfile = (userId?: string) => (userId ? profilesMap.get(userId) : null);

  const results = participants.map((participant) => {
    const participantVotes = gameVotes.filter((v) => v.voterId === participant.userId);

    const correctGuesses = participantVotes.filter((vote) => {
      const target = participants.find((p) => p.userId === vote.targetUserId);
      return target && vote.guessedIdentityId === target.assignedIdentityId;
    }).length;

    const detailedVotes = participantVotes.map((vote) => {
      const target = participants.find((p) => p.userId === vote.targetUserId);
      return {
        targetProfile: getProfile(target?.userId),
        guessedProfile: getProfile(vote.guessedIdentityId),
        isCorrect: !!target && vote.guessedIdentityId === target.assignedIdentityId,
      };
    });

    return {
      userId: participant.userId,
      userName: getProfile(participant.userId)?.displayName || 'Anonyme',
      userProfile: getProfile(participant.userId),
      assignedProfile: getProfile(participant.assignedIdentityId),
      correctGuesses,
      totalVotes: participantVotes.length,
      wasGuessedCorrectly: correctGuesses > 0,
      votes: detailedVotes,
    };
  });

  return { results };
}

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromQuery(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const gameId = url.searchParams.get('gameId');
  if (!gameId) {
    return NextResponse.json({ error: 'Game ID required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        const data = await getVoteResults(gameId);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      await send();
      const interval = setInterval(send, 500);

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
