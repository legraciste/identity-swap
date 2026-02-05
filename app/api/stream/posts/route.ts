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

async function getPosts(gameId: string, currentUserId: string) {
  const db = await getMongoDb();
  const posts = db.collection('posts');
  const profiles = db.collection('profiles');
  const games = db.collection('games');

  const game = await games.findOne({ id: gameId });
  if (!game) return null;

  const gamePosts = await posts.find({ gameId }).sort({ createdAt: -1 }).toArray();

  return Promise.all(
    gamePosts.map(async (post) => {
      const authorProfile = await profiles.findOne({ userId: post.authorId, gameId });
      const participant = game.participants?.find((p: any) => p.userId === post.authorId);
      const assignedProfile = participant?.assignedIdentityId
        ? await profiles.findOne({ userId: participant.assignedIdentityId, gameId })
        : null;

      const baseProfile = assignedProfile || authorProfile || {
        displayName: participant?.display_name || 'Anonyme',
      };
      const displayProfile = {
        ...baseProfile,
        display_name: (baseProfile as any).display_name || (baseProfile as any).displayName || participant?.display_name || 'Anonyme',
      };

      const reactionsArray = Array.isArray(post.reactions) ? post.reactions : [];
      const reactions: Record<string, number> = {};
      const userReactions: string[] = [];

      for (const reaction of reactionsArray) {
        if (!reaction?.emoji) continue;
        reactions[reaction.emoji] = (reactions[reaction.emoji] || 0) + 1;
        if (reaction.userId === currentUserId) {
          userReactions.push(reaction.emoji);
        }
      }

      return {
        _id: post.id,
        gameId: post.gameId,
        authorId: post.authorId,
        content: post.content,
        createdAt: post.createdAt,
        timestamp: post.createdAt,
        displayProfile,
        reactions,
        userReactions,
        likesCount: 0,
        isLikedByMe: false,
      };
    })
  );
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
        if (request.signal.aborted) return;
        const data = await getPosts(gameId, userId);
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
