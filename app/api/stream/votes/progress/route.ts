import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

async function getUserIdFromQuery(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.userId || null;
}

async function getVoteProgress(gameId: string) {
  const db = await getMongoDb();
  const votes = db.collection('votes');
  const games = db.collection('games');

  const game = await games.findOne({ id: gameId });
  if (!game) return null;

  const gameVotes = await votes.find({ gameId }).toArray();
  const participants = game.participants || [];

  const perVoter: Record<string, number> = {};
  for (const vote of gameVotes) {
    perVoter[vote.voterId] = (perVoter[vote.voterId] || 0) + 1;
  }

  const requiredPerVoter = participants.length - 1;
  const totalRequiredVotes = requiredPerVoter * participants.length;

  return {
    perVoter,
    totalVotesCast: gameVotes.length,
    requiredPerVoter,
    totalRequiredVotes,
  };
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
        const data = await getVoteProgress(gameId);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      await send();
      const interval = setInterval(send, 100); // Ultra-fast polling (100ms) for instant vote sync

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
