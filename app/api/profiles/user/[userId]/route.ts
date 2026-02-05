import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authUserId = await getAuthUserFromRequest(request);
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getMongoDb();
    const profiles = db.collection('profiles');

    const { userId } = await params;
    const url = new URL(request.url);
    const gameId = url.searchParams.get('gameId');

    const profile = gameId
      ? await profiles.findOne({ userId, gameId })
      : await profiles.findOne({ userId }, { sort: { updatedAt: -1 } });
    if (!profile) {
      return NextResponse.json(null);
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Get profile by userId error:', error);
    return NextResponse.json({ error: 'Profile error' }, { status: 500 });
  }
}
