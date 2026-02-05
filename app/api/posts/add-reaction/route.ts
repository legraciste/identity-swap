import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId, emoji } = await request.json();
    if (!postId || !emoji) {
      return NextResponse.json({ error: 'Post ID and emoji required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const posts = db.collection('posts');

    await posts.updateOne(
      { id: postId },
      {
        $pull: {
          reactions: {
            userId,
            emoji,
          },
        } as any,
      }
    );

    await posts.updateOne(
      { id: postId },
      {
        $push: {
          reactions: {
            userId,
            emoji,
            createdAt: new Date(),
          },
        } as any,
      }
    );
    const updatedPost = await posts.findOne({ id: postId });
    const reactionsArray = Array.isArray(updatedPost?.reactions) ? updatedPost.reactions : [];
    const reactions: Record<string, number> = {};
    const userReactions: string[] = [];

    for (const reaction of reactionsArray) {
      if (!reaction?.emoji) continue;
      reactions[reaction.emoji] = (reactions[reaction.emoji] || 0) + 1;
      if (reaction.userId === userId) {
        userReactions.push(reaction.emoji);
      }
    }

    return NextResponse.json({ success: true, reactions, userReactions });
  } catch (error) {
    console.error('Add reaction error:', error);
    return NextResponse.json({ error: 'Reaction error' }, { status: 500 });
  }
}
