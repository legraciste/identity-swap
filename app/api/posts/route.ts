import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId, content } = await request.json();
    if (!gameId || !content) {
      return NextResponse.json({ error: 'Game ID and content required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const posts = db.collection('posts');

    const postId = uuidv4();
    await posts.insertOne({
      id: postId,
      gameId,
      authorId: userId,
      content,
      createdAt: new Date(),
    });

    return NextResponse.json({ id: postId, gameId, authorId: userId, content, createdAt: new Date() });
  } catch (error) {
    console.error('Create post error:', error);
    return NextResponse.json({ error: 'Post error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = await getMongoDb();
    const posts = db.collection('posts');
    const profiles = db.collection('profiles');
    const games = db.collection('games');

    const url = new URL(request.url);
    const gameId = url.searchParams.get('gameId');

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID required' }, { status: 400 });
    }

    const game = await games.findOne({ id: gameId });
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gamePosts = await posts.find({ gameId }).sort({ createdAt: -1 }).toArray();

    const enrichedPosts = await Promise.all(
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

    return NextResponse.json(enrichedPosts);
  } catch (error) {
    console.error('Get posts error:', error);
    return NextResponse.json({ error: 'Posts error' }, { status: 500 });
  }
}
