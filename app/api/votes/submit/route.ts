import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId, targetUserId, guessedIdentityId } = await request.json();
    if (!gameId || !targetUserId || !guessedIdentityId) {
      return NextResponse.json({ error: 'Game ID, target user ID, and guessed identity ID required' }, { status: 400 });
    }

    const db = await getMongoDb();
    const votes = db.collection('votes');
    const games = db.collection('games');
    const v4 = (await import('uuid')).v4;

    const game = await games.findOne({ id: gameId });
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const existingVote = await votes.findOne({
      gameId,
      voterId: userId,
      targetUserId,
    });

    let voteId: string;
    if (existingVote) {
      voteId = existingVote.id;
      await votes.updateOne(
        { id: voteId },
        {
          $set: {
            guessedIdentityId,
            createdAt: new Date(),
          },
        }
      );
    } else {
      voteId = v4();
      await votes.insertOne({
        id: voteId,
        gameId,
        voterId: userId,
        targetUserId,
        guessedIdentityId,
        createdAt: new Date(),
      });
    }

    const participants = game.participants || [];
    const requiredPerVoter = participants.length - 1;
    const totalRequiredVotes = requiredPerVoter * participants.length;
    const totalVotesCast = await votes.countDocuments({ gameId });

    if (totalVotesCast >= totalRequiredVotes && game.status !== 'finished') {
      const votesPerVoter = await votes
        .aggregate([
          { $match: { gameId } },
          { $group: { _id: '$voterId', count: { $sum: 1 } } },
        ])
        .toArray();

      const allVotersComplete = participants.every((p: any) =>
        votesPerVoter.some((v: any) => v._id === p.userId && v.count >= requiredPerVoter)
      );

      if (allVotersComplete) {
        await games.updateOne({ id: gameId }, { $set: { status: 'finished', finishedAt: new Date() } });
      }
    }

    return NextResponse.json({ id: voteId, success: true });
  } catch (error) {
    console.error('Submit vote error:', error);
    return NextResponse.json({ error: 'Error submitting vote' }, { status: 500 });
  }
}
