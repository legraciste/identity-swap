import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

interface Profile {
  userId: string;
  displayName: string;
  bio?: string;
}

interface Participant {
  userId: string;
  assignedIdentityId: string | null;
  isDiscovered: boolean;
  display_name?: string;
}

async function getUserIdFromQuery(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.userId || null;
}

async function getCurrentGame(userId: string) {
  const db = await getMongoDb();
  const game = await db.collection('games').findOne(
    { 'participants.userId': userId, status: { $in: ['active', 'voting', 'waiting', 'finished'] } },
    { sort: { createdAt: -1 } }
  );

  if (!game) return null;

  const participants: Participant[] = game.participants || [];
  const profiles = await db
    .collection('profiles')
    .find({ userId: { $in: participants.map((p: Participant) => p.userId) }, gameId: game.id })
    .toArray();

  const enrichedParticipants: Participant[] = participants.map((p: Participant) => {
    const profile = (profiles as unknown as Profile[]).find((prof: Profile) => prof.userId === p.userId);
    return {
      ...p,
      display_name: profile?.displayName || 'Anonyme',
    };
  });

  const myParticipant = enrichedParticipants.find((p: Participant) => p.userId === userId);
  const myAssignedIdentity = myParticipant?.assignedIdentityId;
  const myAssignedProfile = (profiles as unknown as Profile[]).find((prof: Profile) => prof.userId === myAssignedIdentity);
  const assignedParticipant = enrichedParticipants.find((p: Participant) => p.userId === myAssignedIdentity);
  const assignedProfileFallback = assignedParticipant
    ? { userId: assignedParticipant.userId, displayName: assignedParticipant.display_name || 'Anonyme' }
    : null;

  return {
    ...game,
    participants: enrichedParticipants,
    myParticipant: myParticipant || { userId, assignedIdentityId: null, isDiscovered: false, display_name: 'Anonyme' },
    myAssignedProfile: myAssignedProfile || assignedProfileFallback,
  };
}

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromQuery(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        if (request.signal.aborted) return;
        const data = await getCurrentGame(userId);
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream closed
        }
      };

      await send();
      const interval = setInterval(send, 500);

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
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