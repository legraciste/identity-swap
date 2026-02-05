'use client';

import { useAuth } from '@/app/contexts/AuthContext';
import SignInForm from '@/app/components/SignInForm';
import SignOutButton from '@/app/components/SignOutButton';
import GameLobby from '@/app/components/GameLobby';
import GameRoom from '@/app/components/GameRoom';
import { useEffect, useState } from 'react';
import { useAPI } from '@/app/hooks/useAPI';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <h2 className="text-xl font-semibold text-blue-600">🎭 Identity Swap</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 p-4">
        <Content />
      </main>
    </div>
  );
}

function Content() {
  const { isAuthenticated, isLoading, token, userId } = useAuth();
  const { fetchWithAuth } = useAPI();
  const [myProfile, setMyProfile] = useState<any>(null);
  const [currentGame, setCurrentGame] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [gameLoading, setGameLoading] = useState(true);
  const [dismissedGameId, setDismissedGameId] = useState<string | null>(null);

  // Load dismissed game from localStorage when userId is available
  useEffect(() => {
    if (userId && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`dismissedGame_${userId}`);
      if (stored) {
        setDismissedGameId(stored);
      }
    }
  }, [userId]);

  useEffect(() => {
    const handleReturnToLobby = () => {
      if (currentGame?.id && userId) {
        const gameId = currentGame.id;
        setDismissedGameId(gameId);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`dismissedGame_${userId}`, gameId);
        }
      }
      setCurrentGame(null);
    };

    window.addEventListener('returnToLobby', handleReturnToLobby);
    return () => window.removeEventListener('returnToLobby', handleReturnToLobby);
  }, [currentGame?.id, userId]);

  const loadProfile = async () => {
    try {
      const profile = await fetchWithAuth('/profiles/my-profile');
      setMyProfile(profile);
    } catch (_error) {
      setMyProfile(null);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    setProfileLoading(true);
    setGameLoading(true);

    loadProfile().finally(() => setProfileLoading(false));
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isAuthenticated || isLoading || !token) return;

    const stream = new EventSource(`/api/stream/games/current?token=${encodeURIComponent(token)}`);

    stream.onmessage = (event) => {
      try {
        const data = event.data ? JSON.parse(event.data) : null;

        const isDismissed = data?.id && dismissedGameId === data.id;

        if (isDismissed) {
          // Once dismissed, never show this game again regardless of status
          setCurrentGame(null);
        } else {
          setCurrentGame(data || null);
        }

        setGameLoading(false);
      } catch {
        // ignore malformed events
      }
    };

    stream.onerror = () => {
      stream.close();
    };

    return () => stream.close();
  }, [isAuthenticated, isLoading, dismissedGameId, token, userId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {!isAuthenticated ? (
        <div className="text-center py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">🎭 Identity Swap</h1>
          <p className="text-xl text-gray-600 mb-8">
            Un jeu social mystère où des joueurs échangent d'identité !
          </p>
          <p className="text-gray-500 mb-8">
            Rejoignez une partie, incarnez secrètement l'identité d'un autre joueur,
            et tentez de deviner qui joue qui !
          </p>
          <div className="max-w-md mx-auto w-full">
            <SignInForm />
          </div>
        </div>
      ) : (
        <>
          {profileLoading || gameLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : !myProfile ? (
            <GameLobby />
          ) : currentGame ? (
            <GameRoom game={currentGame} />
          ) : (
            <GameLobby />
          )}
        </>
      )}
    </div>
  );
}
