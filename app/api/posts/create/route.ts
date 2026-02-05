import { NextRequest, NextResponse } from 'next/server';
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
    const v4 = (await import('uuid')).v4;

    const postId = v4();
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
