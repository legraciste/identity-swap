import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

interface Profile {
  userId: string;
  displayName: string;
  bio?: string;
}

interface Participant {
  userId: string;
  assignedIdentityId: string | null;
  isDiscovered: boolean;
  display_name?: string;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      console.log('❌ No auth user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getMongoDb();
    const game = await db.collection('games').findOne(
      { 'participants.userId': userId, status: { $in: ['active', 'voting', 'waiting', 'finished'] } },
      { sort: { createdAt: -1 } }
    );

    if (!game) {
      return NextResponse.json(null);
    }

    const participants: Participant[] = game.participants || [];
    const profiles = await db
      .collection('profiles')
      .find({ userId: { $in: participants.map((p: Participant) => p.userId) }, gameId: game.id })
      .toArray();

    // Enrich participants with profile info
    const enrichedParticipants: Participant[] = participants.map((p: Participant) => {
      const profile = (profiles as unknown as Profile[]).find((prof: Profile) => prof.userId === p.userId);
      return {
        ...p,
        display_name: profile?.displayName || 'Anonyme',
      };
    });

    const myParticipant = enrichedParticipants.find((p: Participant) => p.userId === userId);
    const myAssignedIdentity = myParticipant?.assignedIdentityId;
    const myAssignedProfile = (profiles as unknown as Profile[]).find((prof: Profile) => prof.userId === myAssignedIdentity);
    const assignedParticipant = enrichedParticipants.find((p: Participant) => p.userId === myAssignedIdentity);
    const assignedProfileFallback = assignedParticipant
      ? { userId: assignedParticipant.userId, displayName: assignedParticipant.display_name || 'Anonyme' }
      : null;

    return NextResponse.json({
      ...game,
      participants: enrichedParticipants,
      myParticipant: myParticipant || { userId, assignedIdentityId: null, isDiscovered: false, display_name: 'Anonyme' },
      myAssignedProfile: myAssignedProfile || assignedProfileFallback,
    });
  } catch (error) {
    console.error('Get current game error:', error);
    return NextResponse.json({ error: 'Error fetching game' }, { status: 500 });
  }
}
