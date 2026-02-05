import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';

async function getAvailableGames() {
  const db = await getMongoDb();
  const games = db.collection('games');
  const profiles = db.collection('profiles');

  const availableGames = await games
    .find({ status: 'waiting' })
    .sort({ createdAt: -1 })
    .toArray();

  return (await Promise.all(
    availableGames.map(async (game) => {
      const creatorProfile = await profiles.findOne({ userId: game.creatorId, gameId: game.id });

      if (!creatorProfile) return null;

      return {
        id: game.id,
        name: game.name,
        creator_id: game.creatorId,
        creator_name: creatorProfile.displayName || 'Anonyme',
        creator_profile: {
          displayName: creatorProfile.displayName,
          bio: creatorProfile.bio || '',
          interests: creatorProfile.interests || [],
        },
        current_players: game.participants?.length || 0,
        max_players: 15,
      };
    })
  )).filter(Boolean);
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        const data = await getAvailableGames();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      await send();
      const interval = setInterval(send, 2000);

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
