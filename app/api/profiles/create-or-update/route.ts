import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { displayName, bio, interests, gameId } = await request.json();
    if (!displayName || !gameId) {
      return NextResponse.json({ error: 'Display name and game ID required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const profiles = db.collection('profiles');

    await profiles.updateOne(
      { userId, gameId },
      {
        $set: {
          userId,
          gameId,
          displayName,
          bio: bio || '',
          interests: interests || [],
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    const profile = await profiles.findOne({ userId, gameId });
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Create/update profile error:', error);
    return NextResponse.json({ error: 'Profile error' }, { status: 500 });
  }
}
