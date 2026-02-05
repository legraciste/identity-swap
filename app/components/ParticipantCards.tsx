'use client';

import { useState, useEffect, useRef } from 'react';
import { useAPI } from '@/app/hooks/useAPI';

interface ParticipantCardsProps {
  participants: any[];
  currentUserId: string;
  gameId?: string;
}

export default function ParticipantCards({ participants, currentUserId, gameId }: ParticipantCardsProps) {
  const { fetchWithAuth } = useAPI();
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const lastParticipantIdsRef = useRef<string>('');

  useEffect(() => {
    const otherIds = participants
      .filter((p) => p.userId !== currentUserId)
      .map((p) => p.userId)
      .sort()
      .join('|');

    if (otherIds === lastParticipantIdsRef.current || otherIds === '') return;
    lastParticipantIdsRef.current = otherIds;

    const loadProfiles = async () => {
      try {
        setLoading(true);
        const profilesData: Record<string, any> = {};
        
        for (const participant of participants) {
          if (participant.userId !== currentUserId) {
            try {
              const query = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
              const profile = await fetchWithAuth(`/profiles/user/${participant.userId}${query}`);
              profilesData[participant.userId] = profile;
            } catch (error) {
              console.error(`Error loading profile for ${participant.userId}:`, error);
            }
          }
        }

        setProfiles((prev) => ({ ...prev, ...profilesData }));
      } catch (error) {
        console.error('Error loading participant profiles:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfiles();
  }, [participants, currentUserId, fetchWithAuth]);

  if (loading && Object.keys(profiles).length === 0) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const otherParticipants = participants.filter((p) => p.userId !== currentUserId);

  if (otherParticipants.length === 0) {
    return (
      <div className="text-center text-gray-700 py-4 text-xs font-medium">
        Pas d&apos;autres participants pour le moment.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {otherParticipants.map((participant) => {
        const profile = profiles[participant.userId];
        const displayName = profile?.displayName || participant.display_name || 'Anonyme';
        const avatar = displayName?.[0]?.toUpperCase() || '?';
        
        return (
          <div
            key={participant.userId}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md p-2 border border-blue-200 flex-shrink-0"
          >
            <div className="flex items-start gap-2 mb-1">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {avatar}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-xs text-gray-900 truncate">
                  {displayName}
                </h3>
              </div>
            </div>

            {profile?.bio && (
              <div className="mb-1">
                <p className="text-xs text-gray-800 line-clamp-1">{profile.bio}</p>
              </div>
            )}

            {profile?.interests && profile.interests.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {profile.interests.slice(0, 2).map((interest: string, i: number) => (
                  <span
                    key={i}
                    className="inline-block bg-blue-200 text-blue-900 text-xs px-1.5 py-0.5 rounded-full font-medium"
                  >
                    {interest}
                  </span>
                ))}
                {profile.interests.length > 2 && (
                  <span className="inline-block text-xs text-gray-700 px-1 font-medium">
                    +{profile.interests.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
