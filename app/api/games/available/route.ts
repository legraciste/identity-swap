import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const db = await getMongoDb();
    const games = db.collection('games');
    const profiles = db.collection('profiles');

    const availableGames = await games
      .find({ status: 'waiting' })
      .sort({ createdAt: -1 })
      .toArray();

    const enrichedGames = (await Promise.all(
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
          max_players: 4,
        };
      })
    )).filter(Boolean);

    return NextResponse.json(enrichedGames);
  } catch (error) {
    console.error('Get available games error:', error);
    return NextResponse.json({ error: 'Games error' }, { status: 500 });
  }
}
