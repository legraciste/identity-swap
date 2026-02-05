import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { displayName, bio, interests } = await request.json();
    if (!displayName) {
      return NextResponse.json({ error: 'Display name required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const profiles = db.collection('profiles');

    await profiles.updateOne(
      { userId },
      {
        $set: {
          userId,
          displayName,
          bio: bio || '',
          interests: interests || [],
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    const profile = await profiles.findOne({ userId });
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Create/update profile error:', error);
    return NextResponse.json({ error: 'Profile error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getMongoDb();
    const profiles = db.collection('profiles');

    const url = new URL(request.url);
    const targetUserId = url.searchParams.get('userId') || userId;

    const profile = await profiles.findOne({ userId: targetUserId });
    if (!profile) {
      return NextResponse.json(null);
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'Profile error' }, { status: 500 });
  }
}
