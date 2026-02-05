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
      const db = await getMongoDb();
      const games = db.collection('games');

      const sendGames = async () => {
        const data = await getAvailableGames();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial state
      await sendGames();

      // Watch for changes on waiting games
      const changeStream = games.watch([
        {
          $match: {
            operationType: { $in: ['insert', 'update', 'replace', 'delete'] },
            $or: [
              { 'fullDocument.status': 'waiting' },
              { 'operationType': 'delete' }
            ]
          }
        }
      ]);

      const onChangeHandler = async () => {
        await sendGames();
      };

      changeStream.on('change', onChangeHandler);

      request.signal.addEventListener('abort', () => {
        changeStream.close();
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
