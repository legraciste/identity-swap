'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAPI } from '@/app/hooks/useAPI';
import { useAuth } from '@/app/contexts/AuthContext';
import { toast } from 'sonner';
import ProfileSetup from './ProfileSetup';

interface AvailableGame {
  id: string;
  name: string;
  creator_id: string;
  creator_name: string;
  creator_profile?: {
    displayName: string;
    bio?: string;
    interests?: string[];
  } | null;
  current_players: number;
  max_players: number;
}

export default function GameLobby() {
  const [gameName, setGameName] = useState('');
  const [games, setGames] = useState<AvailableGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [profileGameId, setProfileGameId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: 'join' | 'create'; gameId?: string } | null>(null);
  const { fetchWithAuth } = useAPI();
  const { user } = useAuth();

  const loadGames = useCallback(async () => {
    try {
      const availableGames = await fetchWithAuth('/games/available');
      setGames(availableGames);
    } catch {
      console.error('Error loading games');
    }
  }, [fetchWithAuth]);

  const loadProfileForGame = useCallback(async (gameId: string) => {
    try {
      const profile = await fetchWithAuth(`/profiles/my-profile?gameId=${encodeURIComponent(gameId)}`);
      return profile;
    } catch {
      return null;
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    const stream = new EventSource('/api/stream/games/available');

    stream.onmessage = (event) => {
      try {
        const data = event.data ? JSON.parse(event.data) : null;
        if (Array.isArray(data)) {
          setGames(data);
        }
      } catch {
        // ignore malformed events
      }
    };

    stream.onerror = () => {
      stream.close();
    };

    return () => stream.close();
  }, []);

  const handleCreateGameClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameName.trim()) {
      toast.error('Le nom de la partie est requis');
      return;
    }
    executeCreateGame();
  };

  const executeCreateGame = async () => {
    setLoading(true);
    try {
      const created = await fetchWithAuth('/games', {
        method: 'POST',
        body: JSON.stringify({ name: gameName.trim() }),
      });
      toast.success('Partie créée !');
      setGameName('');
      loadGames();
      if (created?.id) {
        setPendingAction({ type: 'create', gameId: created.id });
        setProfileGameId(created.id);
        setShowProfileSetup(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGameClick = (gameId: string) => {
    loadProfileForGame(gameId).then((profile) => {
      if (!profile) {
        setPendingAction({ type: 'join', gameId });
        setProfileGameId(gameId);
        setShowProfileSetup(true);
      } else {
        executeJoinGame(gameId);
      }
    });
  };

  const executeJoinGame = async (gameId: string) => {
    setLoading(true);
    try {
      // Clear dismissed game from localStorage before joining
      if (typeof window !== 'undefined') {
        const userId = localStorage.getItem('auth_user');
        if (userId) {
          const parsedUser = JSON.parse(userId);
          localStorage.removeItem(`dismissedGame_${parsedUser.id}`);
        }
      }
      
      await fetchWithAuth(`/games/join`, {
        method: 'POST',
        body: JSON.stringify({ gameId }),
      });
      toast.success('Vous avez rejoint la partie !');
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileCreated = async () => {
    setShowProfileSetup(false);
    if (pendingAction?.gameId) {
      if (pendingAction.type === 'join' || pendingAction.type === 'create') {
        setTimeout(() => executeJoinGame(pendingAction.gameId!), 300);
      }
    }
    setPendingAction(null);
    setProfileGameId(null);
  };

  const handleCancelProfileSetup = async () => {
    const shouldDeleteGame = pendingAction?.type === 'create' && pendingAction?.gameId;
    setShowProfileSetup(false);
    setPendingAction(null);
    setProfileGameId(null);

    if (shouldDeleteGame) {
      try {
        await fetchWithAuth('/games/delete', {
          method: 'POST',
          body: JSON.stringify({ gameId: pendingAction?.gameId }),
        });
        toast.success('Création de la partie annulée');
        loadGames();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erreur');
      }
    }
  };

  return (
    <div className="space-y-6">
      {showProfileSetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b sticky top-0 bg-white flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Complétez votre profil</h2>
                <p className="text-sm text-gray-700 font-semibold">Avant de créer ou rejoindre une partie</p>
              </div>
              <button
                onClick={handleCancelProfileSetup}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <ProfileSetup gameId={profileGameId} onProfileCreated={handleProfileCreated} />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4 mt-2">🎭 Salon des parties</h1>
          <p className="text-gray-800 font-medium">Créez une nouvelle partie ou rejoignez une partie existante (4 joueurs max)</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Parties disponibles</h2>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              Créer une partie
            </button>
          </div>

          <form onSubmit={handleCreateGameClick} className="mb-6 p-4 bg-gray-50 rounded-md">
            <div className="flex gap-2">
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="Donnez un nom à votre partie..."
                maxLength={50}
                disabled={loading}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-800 text-gray-900"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Créer
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {games.length === 0 ? (
              <p className="text-gray-800 text-center py-8 font-semibold">Aucune partie disponible. Créez-en une !</p>
            ) : (
              games.map((game) => (
                <div key={game.id} className="flex flex-col gap-3 p-4 border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{game.name}</h3>
                      <p className="text-sm text-gray-800 mt-1">
                        Créée par <span className="font-semibold">{game.creator_name}</span> • <span className="font-semibold">{game.current_players}/{game.max_players}</span> joueurs
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {user?.id === game.creator_id && (
                        <button
                          onClick={async () => {
                            try {
                              await fetchWithAuth('/games/delete', {
                                method: 'POST',
                                body: JSON.stringify({ gameId: game.id }),
                              });
                              toast.success('Partie supprimée');
                              loadGames();
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : 'Erreur');
                            }
                          }}
                          className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 font-medium"
                          disabled={loading}
                        >
                          Supprimer
                        </button>
                      )}
                      <button
                        onClick={() => handleJoinGameClick(game.id)}
                        disabled={game.current_players >= game.max_players || loading}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                      >
                        {game.current_players >= game.max_players ? 'Complète' : 'Rejoindre'}
                      </button>
                    </div>
                  </div>

                  {game.creator_profile && (
                    <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-md p-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                        {game.creator_profile.displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{game.creator_profile.displayName}</p>
                        {game.creator_profile.bio && (
                          <p className="text-sm text-gray-800 truncate">{game.creator_profile.bio}</p>
                        )}
                        {game.creator_profile.interests && game.creator_profile.interests.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {game.creator_profile.interests.slice(0, 2).map((interest) => (
                              <span key={interest} className="text-xs bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full font-medium">
                                {interest}
                              </span>
                            ))}
                            {game.creator_profile.interests.length > 2 && (
                              <span className="text-xs text-gray-700 font-medium">+{game.creator_profile.interests.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
