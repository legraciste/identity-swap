import { NextRequest } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const userId = await getAuthUserFromRequest(request);
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const gameId = request.nextUrl.searchParams.get('gameId');
  if (!gameId) {
    return new Response('Missing gameId', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const db = await getMongoDb();
      const games = db.collection('games');

      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const changeStream = games.watch([
        {
          $match: {
            'fullDocument.id': gameId,
            operationType: { $in: ['update', 'replace'] }
          }
        }
      ]);

      changeStream.on('change', async () => {
        const game = await games.findOne({ id: gameId });
        if (game) {
          // Envoie l'état du jeu complètement
          sendEvent({
            game,
            timestamp: Date.now()
          });
        }
      });

      request.signal.addEventListener('abort', () => {
        changeStream.close();
        controller.close();
      });

      // Send initial state
      const game = await games.findOne({ id: gameId });
      if (game) {
        sendEvent({
          game,
          timestamp: Date.now()
        });
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
