'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAPI } from '@/app/hooks/useAPI';
import { useAuth } from '@/app/contexts/AuthContext';
import { toast } from 'sonner';
import ParticipantCards from './ParticipantCards';

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];

const TEEN_GAMES = [
  { 
    id: 'action-verite', 
    title: 'Action ou Vérité', 
    summary: 'Choisis action ou vérité et réponds honnêtement !',
    actions: [
      'Fais 10 pompes',
      'Chante une chanson pendant 30 secondes',
      'Imite un animal au choix des autres',
      'Fais une danse embarrassante',
      'Parle avec un accent pendant 2 minutes',
      'Fais le poirier contre un mur',
      'Raconte une blague',
      'Fais un compliment à chaque participant'
    ],
    verites: [
      'Quel est ton plus gros secret ?',
      'Qui est ton crush secret ?',
      'Quelle est la chose la plus embarrassante que tu aies faite ?',
      'Quelle est ta plus grande peur ?',
      'As-tu déjà menti à tes parents ? À propos de quoi ?',
      'Quel est ton rêve le plus fou ?',
      'Quelle est la dernière personne à qui tu as menti ?',
      'Si tu pouvais être quelqu\'un d\'autre, qui serais-tu ?'
    ]
  },
  { 
    id: 'icebreaker', 
    title: 'Icebreaker express', 
    summary: 'Chacun dit un fait cool en 10 secondes.',
    prompts: [
      'Dis un fait intéressant sur toi',
      'Partage ton dernier fou rire',
      'Raconte un moment embarrassant',
      'Quelle est ta passion secrète ?',
      'Quel est ton talent caché ?'
    ]
  },
  { 
    id: 'quiz', 
    title: 'Quiz flash', 
    summary: '3 questions rapides de culture pop.',
    questions: [
      {
        question: 'Quel est le vrai nom de Spider-Man ?',
        answers: ['Peter Parker', 'Bruce Wayne', 'Clark Kent', 'Tony Stark'],
        correct: 0
      },
      {
        question: 'Quelle est la capitale de la France ?',
        answers: ['Lyon', 'Marseille', 'Paris', 'Bordeaux'],
        correct: 2
      },
      {
        question: 'Combien de planètes dans le système solaire ?',
        answers: ['7', '8', '9', '10'],
        correct: 1
      },
      {
        question: 'Qui a chanté "Shape of You" ?',
        answers: ['Justin Bieber', 'Ed Sheeran', 'Shawn Mendes', 'Harry Styles'],
        correct: 1
      },
      {
        question: 'Quelle est la couleur du cheval blanc d\'Henri IV ?',
        answers: ['Noir', 'Marron', 'Blanc', 'Gris'],
        correct: 2
      }
    ]
  },
  { id: 'mime', title: 'Mime minute', summary: 'Mime un objet, les autres devinent.' },
  { id: 'pictionary', title: 'Dessin éclair', summary: 'Dessine un mot simple en 30 secondes.' },
  { id: 'mot-interdit', title: 'Mot interdit', summary: 'Fais deviner un mot sans 3 mots interdits.' },
  { id: 'emoji', title: 'Histoire en emojis', summary: 'Raconte une mini‑histoire avec 5 emojis.' },
  { id: 'vitesse', title: 'Réponse éclair', summary: 'Réponds le plus vite à une question simple.' },
  { id: 'voix', title: 'Défi voix', summary: 'Dis une phrase avec une voix drôle.' },
  { id: 'association', title: 'Association', summary: 'Enchaîne 5 mots liés sans hésiter.' },
  { id: 'photo', title: 'Photo thème', summary: 'Trouve un objet qui correspond au thème.' },
];

interface GameRoomProps {
  game: any;
}

export default function GameRoom({ game: initialGame }: GameRoomProps) {
  const [game, setGame] = useState(initialGame);
  const [newPost, setNewPost] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [votingResults, setVotingResults] = useState<any>(null);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [showGame, setShowGame] = useState(true);
  const [voteProgress, setVoteProgress] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<'chat' | 'games'>('chat');
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastChatSeenAt, setLastChatSeenAt] = useState<number>(0);
  const [clues, setClues] = useState<any[]>([]);
  const [cluesHistory, setCluesHistory] = useState<any[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('icebreaker');
  const [selectedTargetUserId, setSelectedTargetUserId] = useState<string>('');
  const [newGameTitle, setNewGameTitle] = useState('');
  const [newGameSummary, setNewGameSummary] = useState('');
  const [winnerUserId, setWinnerUserId] = useState<string>('');
  const [gameChoice, setGameChoice] = useState<'action' | 'verite' | null>(null);
  const [currentChallenge, setCurrentChallenge] = useState<string>('');
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizQuestion, setQuizQuestion] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [miniGameState, setMiniGameState] = useState<any>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [bottleRotation, setBottleRotation] = useState(0);
  const { fetchWithAuth } = useAPI();
  const { token } = useAuth();
  const votesStreamRef = useRef<EventSource | null>(null);
  const gameSyncStreamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const handleReturnToLobby = () => {
      setVotingResults(null);
      setShowGame(false);
      if (votesStreamRef.current) {
        votesStreamRef.current.close();
        votesStreamRef.current = null;
      }
      if (gameSyncStreamRef.current) {
        gameSyncStreamRef.current.close();
        gameSyncStreamRef.current = null;
      }
    };
    window.addEventListener('returnToLobby', handleReturnToLobby);
    return () => window.removeEventListener('returnToLobby', handleReturnToLobby);
  }, []);

  useEffect(() => {
    if (game?.status === 'voting') {
      setVotingResults(null);
      setVoteProgress(null);
      setVotes({});
    }
  }, [game?.status]);

  // UNIFIED GAME SYNC STREAM - All game changes broadcast to all players
  useEffect(() => {
    if (!game?.id || !token) return;

    const stream = new EventSource(`/api/stream/game-sync?gameId=${game.id}&token=${token}`);
    gameSyncStreamRef.current = stream;

    stream.onmessage = (event) => {
      try {
        const data = event.data ? JSON.parse(event.data) : null;
        if (data?.game) {
          // Update game state immediately when any player makes a change
          setGame(data.game);
          
          // Update derived state based on new game data
          if (data.game.winnerId) {
            setWinnerUserId(data.game.winnerId);
          }
          if (data.game.miniGameState) {
            setMiniGameState(data.game.miniGameState);
          }
          if (data.game.status === 'voting') {
            setVotingResults(null);
            setVoteProgress(null);
            setVotes({});
          }
        }
      } catch {
        // ignore malformed events
      }
    };

    stream.onerror = () => {
      stream.close();
      gameSyncStreamRef.current = null;
    };

    return () => {
      stream.close();
      gameSyncStreamRef.current = null;
    };
  }, [game?.id, token]);

  const myParticipant = game?.myParticipant;
  const myAssignedProfile = game?.myAssignedProfile;
  const isCreator = game?.creatorId === myParticipant?.userId;
  const getPostTime = (post: any) => new Date(post.createdAt || post.timestamp || 0).getTime();
  const requiredPerVoterGlobal = voteProgress?.requiredPerVoter || (game?.participants?.length || 0);
  const totalRequiredVotesGlobal = voteProgress?.totalRequiredVotes ?? (requiredPerVoterGlobal * (game?.participants?.length || 0));
  const totalVotesCastGlobal = voteProgress?.totalVotesCast ?? 0;
  const allVotesIn = totalRequiredVotesGlobal > 0
    ? totalVotesCastGlobal >= totalRequiredVotesGlobal
    : (votingResults?.results?.length && game?.participants?.length
      ? votingResults.results.length >= game.participants.length
      : false);
  const isVotingPhase = game?.status === 'voting' || (game?.status === 'finished' && !allVotesIn);
  // Helper function to get participant display name
  const getParticipantName = (userId: string) => {
    const p = (game?.participants || []).find((x: any) => x.userId === userId);
    return p?.display_name || "Anonyme";
  };




  const loadClues = useCallback(async () => {
    if (!game?.id) return;
    try {
      const data = await fetchWithAuth(`/games/my-clues?gameId=${game.id}`);
      setClues(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading clues:', error);
    }
  }, [fetchWithAuth, game?.id]);

  const loadClueHistory = useCallback(async () => {
    if (!game?.id) return;
    try {
      const data = await fetchWithAuth(`/games/clues/${game.id}`);
      setCluesHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading clue history:', error);
    }
  }, [fetchWithAuth, game]);


  const loadVoteProgress = useCallback(async () => {
    if (!game?.id) return;
    try {
      const progress = await fetchWithAuth(`/votes/progress/${game.id}`);
      setVoteProgress(progress);
    } catch (error) {
      console.error('Error loading vote progress:', error);
    }
  }, [fetchWithAuth, game]);

  // Game updates come from SSE stream in page.tsx, no polling needed here

  useEffect(() => {
    if (!game?.id) return;
    const stream = new EventSource(`/api/stream/posts?gameId=${game.id}&token=${token}`);
    stream.onmessage = (event) => {
      try {
        const data = event.data ? JSON.parse(event.data) : null;
        setPosts(Array.isArray(data) ? data : []);
      } catch {
        // ignore malformed events
      }
    };
    stream.onerror = () => stream.close();
    return () => stream.close();
  }, [game?.id, token]);

  useEffect(() => {
    if (!Array.isArray(posts) || posts.length === 0) return;
    const latestTime = Math.max(...posts.map(getPostTime));

    if (activeSection === 'chat') {
      setUnreadCount(0);
    } else {
      const count = posts.filter((p) => getPostTime(p) > lastChatSeenAt).length;
      setUnreadCount(count);
    }
  }, [posts, activeSection, lastChatSeenAt]);

  useEffect(() => {
    if (!game?.id) return;
    if (votingResults?.results?.length) return;
    if (!['voting', 'finished'].includes(game.status)) return;

    const stream = new EventSource(`/api/stream/votes/results?gameId=${game.id}&token=${token}`);
    votesStreamRef.current = stream;
    stream.onmessage = (event) => {
      try {
        const data = event.data ? JSON.parse(event.data) : null;
        if (data?.results && data.results.length > 0) {
          setVotingResults(data);
          setGame((prevGame: any) => ({ ...prevGame, status: 'finished' }));
          stream.close();
          votesStreamRef.current = null;
        }
      } catch {
        // ignore malformed events
      }
    };
    stream.onerror = () => {
      stream.close();
      votesStreamRef.current = null;
    };
    return () => {
      stream.close();
      votesStreamRef.current = null;
    };
  }, [game?.status, game?.id, token, votingResults?.results?.length]);

  useEffect(() => {
    if (!isVotingPhase) return;
    const stream = new EventSource(`/api/stream/votes/progress?gameId=${game.id}&token=${token}`);
    stream.onmessage = (event) => {
      try {
        const data = event.data ? JSON.parse(event.data) : null;
        setVoteProgress(data);
      } catch {
        // ignore malformed events
      }
    };
    stream.onerror = () => stream.close();
    return () => stream.close();
  }, [isVotingPhase, game?.id, token]);

  useEffect(() => {
    if (!game?.id) return;
    loadClues();
    loadClueHistory();
  }, [game?.id, loadClues, loadClueHistory]);

  useEffect(() => {
    if (!game?.id) return;
    loadClues();
    loadClueHistory();

    // Also setup SSE for real-time clues updates from other players claiming clues
    const cluesInterval = setInterval(() => {
      loadClues();
    }, 5000); // Check every 5 seconds instead of 3

    return () => clearInterval(cluesInterval);
  }, [game?.id, loadClues, loadClueHistory]);

  // Mini-game state updates come from game-sync stream above, no need for separate endpoint

  useEffect(() => {
    if (!game?.participants?.length) return;
    if (!myParticipant?.userId) return;
    if (selectedTargetUserId) return;
    const firstTarget = game.participants.find((p: any) => p.userId !== myParticipant.userId);
    if (firstTarget) {
      setSelectedTargetUserId(firstTarget.userId);
    }
  }, [game?.participants, myParticipant?.userId, selectedTargetUserId]);

  useEffect(() => {
    if (game?.winnerId) {
      setWinnerUserId(game.winnerId);
    }
  }, [game?.winnerId, myParticipant?.userId]);

  useEffect(() => {
    const list = game?.miniGames && game.miniGames.length > 0 ? game.miniGames : TEEN_GAMES;
    if (!list.find((g: any) => g.id === selectedGameId)) {
      setSelectedGameId(list[0]?.id || 'icebreaker');
    }
  }, [game?.miniGames, selectedGameId]);

  if (!game || !myParticipant || !game.participants) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!showGame) {
    return null;
  }

  const assignedParticipant = game?.participants?.find((p: any) => p.userId === myParticipant?.assignedIdentityId);
  const normalizedAssignedProfile = myAssignedProfile ? {
    display_name: myAssignedProfile.displayName || myAssignedProfile.display_name || assignedParticipant?.display_name || 'Chargement...',
    bio: myAssignedProfile.bio || 'Aucune bio'
  } : (assignedParticipant ? {
    display_name: assignedParticipant.display_name || 'Chargement...',
    bio: 'Aucune bio'
  } : null);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    try {
      const result = await fetchWithAuth('/posts/create', {
        method: 'POST',
        body: JSON.stringify({
          gameId: game.id,
          content: newPost.trim(),
        }),
      });
      const now = new Date().toISOString();
      const optimisticPost = {
        _id: result?.id || `temp-${Date.now()}`,
        id: result?.id || `temp-${Date.now()}`,
        gameId: game.id,
        authorId: myParticipant.userId,
        content: newPost.trim(),
        createdAt: now,
        timestamp: now,
        displayProfile: {
          displayName: normalizedAssignedProfile?.display_name || myParticipant.display_name || 'Anonyme',
          display_name: normalizedAssignedProfile?.display_name || myParticipant.display_name || 'Anonyme',
        },
        reactions: {},
        userReactions: [],
      };
      setPosts((prevPosts) => [optimisticPost, ...prevPosts]);
      setNewPost('');
      // Post added, SSE stream will automatically update posts
    } catch (error) {
      toast.error('Erreur lors de la création du post');
    }
  };

  const handleDeclareWinner = async () => {
    if (!winnerUserId) {
      toast.error('Choisissez un gagnant');
      return;
    }

    try {
      await fetchWithAuth('/games/declare-winner', {
        method: 'POST',
        body: JSON.stringify({ gameId: game.id, winnerUserId })
      });
      
      toast.success('Gagnant déclaré ! Il peut maintenant réclamer un indice.');
      // Game state will update automatically via game-sync stream
      setWinnerUserId(''); // Reset selection
    } catch (error) {
      toast.error('Erreur lors de la déclaration du gagnant');
    }
  };

  const handleSaveMiniGames = async (miniGames: any[]) => {
    try {
      await fetchWithAuth('/games/mini-games', {
        method: 'POST',
        body: JSON.stringify({ gameId: game.id, miniGames })
      });
      toast.success('Mini‑jeux mis à jour');
      // Game state will update automatically via game-sync stream
    } catch (error) {
      toast.error('Erreur lors de la mise à jour des mini‑jeux');
    }
  };

  const handleAwardClue = async () => {
    if (!selectedTargetUserId) {
      toast.error('Choisissez un joueur pour recevoir un indice');
      return;
    }

    try {
      const result = await fetchWithAuth('/games/award-clue', {
        method: 'POST',
        body: JSON.stringify({ gameId: game.id, targetUserId: selectedTargetUserId })
      });

      if (result?.letter) {
        toast.success(`Indice gagné: lettre "${result.letter}" sur ${getParticipantName(selectedTargetUserId)}`);
        // Game state updates via game-sync stream, clues load from SSE
        setSelectedTargetUserId(''); // Reset selection after success
      } else {
        toast.error('Erreur: aucune lettre retournée');
      }
    } catch (error) {
      console.error('Award clue error:', error);
      toast.error('Erreur lors de l\'attribution de l\'indice');
    }
  };

  const handleReaction = async (postId: string, emoji: string, hasReacted: boolean) => {
    try {
      let result;
      if (hasReacted) {
        result = await fetchWithAuth('/posts/remove-reaction', {
          method: 'POST',
          body: JSON.stringify({ postId, emoji }),
        });
      } else {
        result = await fetchWithAuth('/posts/add-reaction', {
          method: 'POST',
          body: JSON.stringify({ postId, emoji }),
        });
      }

      if (result?.reactions !== undefined) {
        setPosts(prevPosts => prevPosts.map(post =>
          post._id === postId || post.id === postId
            ? { ...post, reactions: result.reactions, userReactions: result.userReactions || [] }
            : post
        ));
      }

      // Reaction added, SSE stream will automatically update posts
    } catch (error) {
      console.error('Reaction error:', error);
      toast.error('Erreur lors de la réaction');
    }
  };

  const handleLaunchMiniGame = async (gameId: string) => {
    setSelectedGameId(gameId);

    if (gameId === 'action-verite') {
      // Initialize Action ou Vérité for all players
      const initialState = {
        gameType: 'action-verite',
        phase: 'idle',
        selectedPlayer: null,
        challenge: null,
        choice: null
      };
      setMiniGameState(initialState);
      await updateMiniGameState(initialState);
    } else if (gameId === 'icebreaker') {
      const gameData = TEEN_GAMES.find((g: any) => g.id === gameId);
      if (gameData?.prompts) {
        const randomPrompt = gameData.prompts[Math.floor(Math.random() * gameData.prompts.length)];
        setCurrentChallenge(randomPrompt);
      }
    } else if (gameId === 'quiz') {
      const gameData = TEEN_GAMES.find((g: any) => g.id === gameId);
      if (gameData?.questions) {
        const randomQuestion = gameData.questions[Math.floor(Math.random() * gameData.questions.length)];
        setQuizQuestion(randomQuestion);
        setQuizAnswer(null);
        setShowResult(false);
      }
    }
  };

  const updateMiniGameState = async (state: any) => {
    try {
      await fetchWithAuth('/games/mini-game-state', {
        method: 'POST',
        body: JSON.stringify({ gameId: game.id, miniGameState: state })
      });
    } catch (error) {
      console.error('Error updating mini-game state:', error);
    }
  };

  const handleSpinBottle = async () => {
    if (isSpinning) return;
    
    setIsSpinning(true);
    const participants = game.participants || [];
    const randomIndex = Math.floor(Math.random() * participants.length);
    const selectedPlayer = participants[randomIndex];
    
    // Calculate rotation: multiple full spins + final position
    const spins = 3 + Math.random() * 2; // 3-5 full rotations
    const anglePerPlayer = 360 / participants.length;
    const finalAngle = randomIndex * anglePerPlayer;
    const totalRotation = (spins * 360) + finalAngle;
    
    setBottleRotation(totalRotation);

    // Wait for animation to complete
    setTimeout(async () => {
      setIsSpinning(false);
      await updateMiniGameState({
        gameType: 'action-verite',
        phase: 'choosing',
        selectedPlayer: selectedPlayer.userId,
        selectedPlayerName: selectedPlayer.display_name,
        challenge: null,
        choice: null
      });
    }, 3000);
  };

  const handleActionVeriteChoice = async (choice: 'action' | 'verite') => {
    const gameData = TEEN_GAMES.find((g: any) => g.id === 'action-verite');
    if (!gameData) return;

    let challenge = '';
    if (choice === 'action' && gameData.actions) {
      challenge = gameData.actions[Math.floor(Math.random() * gameData.actions.length)];
    } else if (choice === 'verite' && gameData.verites) {
      challenge = gameData.verites[Math.floor(Math.random() * gameData.verites.length)];
    }

    await updateMiniGameState({
      gameType: 'action-verite',
      phase: 'showing',
      selectedPlayer: miniGameState?.selectedPlayer,
      selectedPlayerName: miniGameState?.selectedPlayerName,
      challenge,
      choice
    });
  };

  const handleResetBottleGame = async () => {
    await updateMiniGameState({
      gameType: 'action-verite',
      phase: 'idle',
      selectedPlayer: null,
      challenge: null,
      choice: null
    });
    setBottleRotation(0);
  };

  const handleQuizAnswer = (answerIndex: number) => {
    setQuizAnswer(answerIndex);
    setShowResult(true);
  };

  const handleStartVoting = async () => {
    try {
      await fetchWithAuth('/games/start-voting', {
        method: 'POST',
        body: JSON.stringify({ gameId: game.id }),
      });
      toast.success('Phase de vote démarrée !');
      setVotingResults(null);
      setVoteProgress(null);
      setVotes({});
      // Game state will update automatically via game-sync stream
    } catch (error) {
      toast.error('Erreur lors du démarrage du vote');
    }
  };

  const handleVote = async (targetUserId: string, guessedIdentityId: string) => {
    const requiredPerVoter = voteProgress?.requiredPerVoter || (game?.participants?.length || 0);
    const myVotesCount = myParticipant?.userId
      ? (voteProgress?.perVoter?.[myParticipant.userId] ?? Object.keys(votes).length)
      : Object.keys(votes).length;

    if (requiredPerVoter > 0 && myVotesCount >= requiredPerVoter) {
      toast.info('Vous avez terminé vos votes. Attendez que les autres terminent.');
      return;
    }

    try {
      await fetchWithAuth('/votes/submit', {
        method: 'POST',
        body: JSON.stringify({
          gameId: game.id,
          targetUserId,
          guessedIdentityId,
        }),
      });
      setVotes({...votes, [targetUserId]: guessedIdentityId });
      // Vote progress updates via SSE stream, no need to fetch
      toast.success('Vote enregistré !');
    } catch (error) {
      toast.error('Erreur lors du vote');
    }
  };

  const handleRemoveParticipant = async (participantUserId: string) => {
    try {
      await fetchWithAuth('/games/remove-participant', {
        method: 'POST',
        body: JSON.stringify({ gameId: game.id, participantUserId }),
      });
      toast.success('Joueur supprimé');
      // Game state will update automatically via game-sync stream
    } catch (error) {
      toast.error('Erreur lors de la suppression du joueur');
    }
  };

  const handleStartGame = async () => {
    try {
      await fetchWithAuth('/games/start', {
        method: 'POST',
        body: JSON.stringify({ gameId: game.id }),
      });
      toast.success('Partie démarrée !');
      // Game state will update automatically via game-sync stream
    } catch (error) {
      toast.error('Erreur lors du démarrage de la partie');
    }
  };

  if (game.status === 'waiting') {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">En attente de joueurs...</h2>
        <p className="text-gray-700 mb-4 font-medium">
          Partie: {game.name} ({game.participants?.length || 0}/15 joueurs)
        </p>

        <div className="space-y-2 mb-6">
          {game.participants?.map((participant: any, index: number) => (
            <div key={`${participant.userId}-${index}`} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-md">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {participant.display_name?.[0] || "?"}
                </div>
                <span className="text-gray-800 font-medium">{participant.display_name || "Anonyme"}</span>
              </div>
              {isCreator && participant.userId !== myParticipant?.userId && (
                <button
                  onClick={() => handleRemoveParticipant(participant.userId)}
                  className="text-red-600 hover:text-red-800 font-semibold text-sm px-3 py-1 hover:bg-red-100 rounded transition"
                >
                  Supprimer
                </button>
              )}
            </div>
          ))}
        </div>

        {isCreator ? (
          <button
            onClick={handleStartGame}
            disabled={!game.participants || game.participants.length < 2}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Démarrer la partie
          </button>
        ) : (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-gray-700 font-medium">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>En attente du créateur pour démarrer la partie...</span>
            </div>
          </div>
        )}

        <div className="text-center mt-4">
          <button
            onClick={() => window.dispatchEvent(new Event('returnToLobby'))}
            className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
          >
            Retourner au lobby
          </button>
        </div>
      </div>
    );
  }

  if (game.status === 'active') {
    const miniGames = (game.miniGames && game.miniGames.length > 0) ? game.miniGames : TEEN_GAMES;
    const selectedGame = miniGames.find((g: any) => g.id === selectedGameId) || miniGames[0];
    const participantsExceptMe = (game.participants || []).filter((p: any) => p.userId !== myParticipant.userId);
    return (
      <div className="relative md:fixed md:inset-0 md:top-16 flex flex-col md:flex-row h-[calc(100vh-4rem)] gap-3 px-3 py-3 w-full bg-gray-50 overflow-y-auto md:overflow-hidden">
        {/* Colonne gauche - Participants */}
        <div className="w-full md:w-40 flex flex-col flex-shrink-0 overflow-hidden order-3 md:order-1">
          <div className="bg-white rounded-lg shadow-md p-3 overflow-y-auto flex-1 max-h-56 md:max-h-none">
            <h3 className="text-sm font-bold mb-3 text-gray-900">Participants</h3>
            <div className="text-xs">
              <ParticipantCards
                participants={game.participants || []}
                currentUserId={myParticipant.userId}
                gameId={game.id}
              />
            </div>
          </div>
        </div>

        {/* Colonne centre - Chat/Jeux */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 order-2">
          
          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-md p-2 flex-shrink-0">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveSection("chat")}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-semibold transition ${
                  activeSection === "chat" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                }`}
              >
                Chat
                {activeSection !== "chat" && unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveSection("games")}
                className={`px-3 py-1 rounded-md text-sm font-semibold transition ${
                  activeSection === "games" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                }`}
              >
                Jeux
              </button>
            </div>
          </div>

          {/* Contenu Chat/Jeux */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeSection === "chat" ? (
              <div className="h-full flex flex-col">
                {/* Zone scrollable pour les posts */}
                <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-2">
                  {posts.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-4 text-center">
                      <p className="text-sm text-gray-500">Aucun post pour le moment. Soyez le premier à poster !</p>
                    </div>
                  ) : (
                    posts.map((post) => {
                      const displayName = post.displayProfile?.displayName || post.displayProfile?.display_name || "Anonyme";
                      const postTime = post.timestamp || post.createdAt || post.created_at;
                      const postDate = postTime ? new Date(postTime) : null;
                      const postDateLabel = postDate && !Number.isNaN(postDate.getTime())
                        ? postDate.toLocaleString('fr-FR')
                        : '';

                      return (
                      <div key={post._id} className="bg-white rounded-lg shadow-md p-4">
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                            {displayName?.[0] || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-gray-900">
                                {displayName}
                              </span>
                              {postDateLabel && (
                                <span className="text-gray-700 text-xs">
                                  {postDateLabel}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-900 mb-2 text-sm">{post.content}</p>
                            <div className="flex items-center gap-1 flex-wrap">
                              {EMOJI_REACTIONS.map(emoji => {
                                const count = post.reactions?.[emoji] || 0;
                                const userHasThisReaction = Array.isArray(post.userReactions)
                                  ? post.userReactions.includes(emoji)
                                  : false;
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() => handleReaction(post._id, emoji, userHasThisReaction)}
                                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs transition-colors ${
                                      userHasThisReaction
                                        ? 'bg-blue-100 text-blue-600'
                                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                    }`}
                                  >
                                    <span className="text-sm">{emoji}</span>
                                    <span className="font-medium text-xs">{count}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                    })
                  )}
                </div>

                {/* Formulaire fixe en bas */}
                <div className="bg-white rounded-lg shadow-md p-3 flex-shrink-0 mt-3">
                  <form onSubmit={handleCreatePost} className="flex gap-2">
                    <input
                      type="text"
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Postez en tant que ${normalizedAssignedProfile?.display_name || "..."}`}
                      maxLength={280}
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-4 py-1.5 text-sm rounded-md hover:bg-blue-700"
                    >
                      Poster
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto bg-white rounded-lg shadow-md p-4 space-y-4">
                <div>
                  <h3 className="text-lg font-bold mb-1 text-gray-900">Mini‑jeux</h3>
                  <p className="text-xs text-gray-800">Choisissez un jeu, jouez, puis le gagnant peut réclamer un indice.</p>
                </div>

                {isCreator && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="font-semibold text-sm mb-2 text-gray-900">Personnaliser les mini‑jeux</div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={newGameTitle}
                        onChange={(e) => setNewGameTitle(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md"
                        placeholder="Titre du mini‑jeu"
                        maxLength={60}
                      />
                      <input
                        type="text"
                        value={newGameSummary}
                        onChange={(e) => setNewGameSummary(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md"
                        placeholder="Résumé (1 phrase)"
                        maxLength={120}
                      />
                      <button
                        onClick={() => {
                          if (!newGameTitle.trim() || !newGameSummary.trim()) {
                            toast.error("Titre et résumé requis");
                            return;
                          }
                          const newItem = {
                            id: `custom-${Date.now()}`,
                            title: newGameTitle.trim(),
                            summary: newGameSummary.trim()
                          };

                          const updated = [...miniGames, newItem];
                          handleSaveMiniGames(updated);
                          setNewGameTitle("");
                          setNewGameSummary("");
                        }}
                        className="bg-blue-600 text-white px-3 py-1 text-sm rounded-md hover:bg-blue-700"
                      >
                        Ajouter
                      </button>
                    </div>

                    <div className="mt-2 space-y-1">
                      {miniGames.map((g: any) => (
                        <div key={g.id} className="flex items-center justify-between text-xs bg-white border border-gray-200 rounded-md px-2 py-1">
                          <div>
                            <div className="font-semibold text-gray-900">{g.title}</div>
                            <div className="text-gray-800">{g.summary}</div>
                          </div>
                          <button
                            onClick={() => handleSaveMiniGames(miniGames.filter((x: any) => x.id !== g.id))}
                            className="text-red-600 hover:text-red-800 font-semibold ml-2 flex-shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {miniGames.map((gameItem: any) => (
                    <button
                      key={gameItem.id}
                      onClick={() => handleLaunchMiniGame(gameItem.id)}
                      className={`p-2 rounded-lg border-2 text-left transition text-xs ${
                        selectedGameId === gameItem.id
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 hover:border-blue-400"
                      }`}
                    >
                      <div className="font-semibold text-gray-900">{gameItem.title}</div>
                      <div className="text-gray-800 text-xs mt-0.5">{gameItem.summary}</div>
                    </button>
                  ))}
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="font-semibold text-sm text-gray-900 mb-3">Jeu sélectionné : {selectedGame.title}</div>
                  
                  {selectedGameId === 'action-verite' && (
                    <div className="space-y-4">
                      {(!miniGameState || miniGameState?.gameType !== 'action-verite') && (
                        <div className="text-center py-8">
                          <button
                            onClick={() => handleLaunchMiniGame('action-verite')}
                            className="bg-gradient-to-r from-orange-500 to-purple-500 text-white px-6 py-3 rounded-lg font-bold text-lg hover:from-orange-600 hover:to-purple-600 shadow-lg"
                          >
                            🎯 Démarrer Action ou Vérité
                          </button>
                        </div>
                      )}

                      {miniGameState?.gameType === 'action-verite' && miniGameState.phase === 'idle' && (
                        <div className="space-y-4">
                          <div className="relative w-full aspect-square max-w-md mx-auto bg-white rounded-full border-4 border-gray-300 p-8">
                            {/* Players arranged in circle */}
                            {game.participants.map((participant: any, index: number) => {
                              const angle = (index * 360) / game.participants.length;
                              const radius = 45; // percentage
                              const x = 50 + radius * Math.cos((angle - 90) * Math.PI / 180);
                              const y = 50 + radius * Math.sin((angle - 90) * Math.PI / 180);
                              
                              return (
                                <div
                                  key={participant.userId}
                                  className="absolute text-xs font-semibold text-gray-900 bg-blue-100 px-2 py-1 rounded-full transform -translate-x-1/2 -translate-y-1/2 z-10"
                                  style={{ left: `${x}%`, top: `${y}%` }}
                                >
                                  {participant.display_name}
                                </div>
                              );
                            })}
                            
                            {/* Bottle in center - points upward to top of circle */}
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                              <div 
                                className="w-3 h-32 bg-gradient-to-t from-green-900 to-green-600 rounded-full transition-transform duration-[3000ms] ease-out origin-bottom"
                                style={{ 
                                  transform: `rotate(${bottleRotation}deg)`,
                                  transformOrigin: 'center 50%'
                                }}
                              >
                                {/* Bottle cap (top pointer) */}
                                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-green-600"></div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Spin button outside circle */}
                          <div className="text-center">
                            <button
                              onClick={handleSpinBottle}
                              disabled={isSpinning}
                              className="bg-green-600 text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transition-all hover:scale-105"
                            >
                              {isSpinning ? '🔄 Rotation...' : '🎯 Faire tourner'}
                            </button>
                          </div>
                        </div>
                      )}

                      {miniGameState?.phase === 'choosing' && (
                        <div className="bg-white p-6 rounded-lg border-2 border-blue-300 text-center space-y-4">
                          <p className="text-xl font-bold text-gray-900">
                            🎯 {miniGameState.selectedPlayerName}
                          </p>
                          <p className="text-gray-700">Choisis Action ou Vérité !</p>
                          
                          {miniGameState.selectedPlayer === myParticipant?.userId && (
                            <div className="grid grid-cols-2 gap-3 mt-4">
                              <button
                                onClick={() => handleActionVeriteChoice('action')}
                                className="bg-orange-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-orange-600"
                              >
                                🎭 Action
                              </button>
                              <button
                                onClick={() => handleActionVeriteChoice('verite')}
                                className="bg-purple-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-purple-600"
                              >
                                💬 Vérité
                              </button>
                            </div>
                          )}
                          
                          {miniGameState.selectedPlayer !== myParticipant?.userId && (
                            <p className="text-sm text-gray-600 italic">En attente du choix...</p>
                          )}
                        </div>
                      )}

                      {miniGameState?.phase === 'showing' && (
                        <div className="bg-white p-6 rounded-lg border-2 border-green-300 space-y-4">
                          <div className="text-center">
                            <p className="text-lg font-bold text-gray-900 mb-2">
                              {miniGameState.selectedPlayerName}
                            </p>
                            <div className={`inline-block px-4 py-2 rounded-full text-white font-semibold ${
                              miniGameState.choice === 'action' ? 'bg-orange-500' : 'bg-purple-500'
                            }`}>
                              {miniGameState.choice === 'action' ? '🎭 Action' : '💬 Vérité'}
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-gray-800 text-center font-medium">
                              {miniGameState.challenge}
                            </p>
                          </div>
                          
                          <button
                            onClick={handleResetBottleGame}
                            className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-600 w-full font-semibold"
                          >
                            🔄 Nouveau tour
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedGameId === 'icebreaker' && currentChallenge && (
                    <div className="bg-white p-4 rounded-lg border-2 border-gray-300">
                      <p className="text-gray-800 text-sm mb-3 font-semibold">{currentChallenge}</p>
                      <button
                        onClick={() => handleLaunchMiniGame('icebreaker')}
                        className="bg-blue-500 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-600 w-full"
                      >
                        Nouvelle question
                      </button>
                    </div>
                  )}

                  {selectedGameId === 'quiz' && quizQuestion && (
                    <div className="bg-white p-4 rounded-lg border-2 border-gray-300 space-y-3">
                      <p className="font-semibold text-gray-900 mb-3">{quizQuestion.question}</p>
                      <div className="space-y-2">
                        {quizQuestion.answers.map((answer: string, index: number) => (
                          <button
                            key={index}
                            onClick={() => handleQuizAnswer(index)}
                            disabled={showResult}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm border-2 transition ${
                              showResult
                                ? index === quizQuestion.correct
                                  ? 'bg-green-100 border-green-500 text-green-900'
                                  : index === quizAnswer
                                  ? 'bg-red-100 border-red-500 text-red-900'
                                  : 'bg-gray-100 border-gray-300 text-gray-600'
                                : 'bg-white border-gray-300 hover:border-blue-500 text-gray-900'
                            }`}
                          >
                            {answer}
                            {showResult && index === quizQuestion.correct && ' ✓'}
                            {showResult && index === quizAnswer && index !== quizQuestion.correct && ' ✗'}
                          </button>
                        ))}
                      </div>
                      {showResult && (
                        <button
                          onClick={() => handleLaunchMiniGame('quiz')}
                          className="bg-blue-500 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-600 w-full mt-3"
                        >
                          Question suivante
                        </button>
                      )}
                    </div>
                  )}

                  {!['action-verite', 'icebreaker', 'quiz'].includes(selectedGameId) && (
                    <div className="text-xs text-gray-800 mt-0.5">{selectedGame.summary}</div>
                  )}
                </div>

                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="font-semibold text-sm mb-2 text-gray-900">Validation du gagnant</div>
                  {game.winnerId ? (
                    <p className="text-xs text-gray-900">
                      Gagnant : <span className="font-semibold">{getParticipantName(game.winnerId)}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-800">Aucun gagnant déclaré.</p>
                  )}

                  {isCreator && (
                    <div className="mt-2 flex flex-col gap-2">
                      <select
                        value={winnerUserId}
                        onChange={(e) => setWinnerUserId(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md text-gray-900"
                      >
                        <option value="">Choisir un gagnant</option>
                        {game.participants.map((p: any) => (
                          <option key={p.userId} value={p.userId}>
                            {p.display_name || "Anonyme"}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleDeclareWinner}
                        className="bg-green-600 text-white px-3 py-1 text-sm rounded-md hover:bg-green-700"
                      >
                        Déclarer gagnant
                      </button>
                    </div>
                  )}
                </div>

                <div className={`p-4 rounded-lg border-2 ${
                  game.winnerId === myParticipant?.userId
                    ? "bg-gradient-to-r from-yellow-100 to-yellow-200 border-yellow-400 shadow-lg"
                    : "bg-gray-100 border-gray-300 opacity-60"
                }`}>
                  <div className={`font-bold text-base mb-2 ${
                    game.winnerId === myParticipant?.userId ? "text-yellow-900" : "text-gray-600"
                  }`}>
                    🎁 {game.winnerId === myParticipant?.userId ? "Félicitations ! Vous avez gagné !" : "Réclamer un indice"}
                  </div>
                  <p className={`text-sm mb-3 ${
                    game.winnerId === myParticipant?.userId ? "text-yellow-800" : "text-gray-600"
                  }`}>
                    {game.winnerId === myParticipant?.userId
                      ? "Choisissez un joueur pour découvrir une lettre de son vrai nom."
                      : "Gagnez un mini-jeu pour débloquer cette fonctionnalité."}
                  </p>
                  <div className="flex flex-col gap-2">
                    <select
                      value={selectedTargetUserId}
                      onChange={(e) => setSelectedTargetUserId(e.target.value)}
                      disabled={game.winnerId !== myParticipant?.userId}
                      className="flex-1 px-3 py-2 text-sm border-2 rounded-md text-gray-900 bg-white disabled:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Choisir un joueur</option>
                      {participantsExceptMe.map((p: any) => (
                        <option key={p.userId} value={p.userId}>
                          {p.display_name || "Anonyme"}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAwardClue}
                      disabled={game.winnerId !== myParticipant?.userId || !selectedTargetUserId}
                      className="px-4 py-2 text-sm font-semibold rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed bg-yellow-600 text-white hover:bg-yellow-700"
                    >
                      🎯 Obtenir l&apos;indice
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="font-bold text-sm mb-2 text-gray-900">Mes indices</div>
                  {clues.length === 0 ? (
                    <p className="text-xs text-gray-500">Aucun indice pour le moment.</p>
                  ) : (
                    <ul className="space-y-1">
                      {clues.map((clue: any) => (
                        <li key={clue.id || clue._id} className="text-xs text-gray-700">
                          Lettre &quot;{clue.letter}&quot; sur {getParticipantName(clue.targetUserId)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite - Bannière avec bio et joueur incarné */}
        <div className="w-full md:w-48 flex flex-col flex-shrink-0 order-1 md:order-3">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg shadow-md p-4 text-white">
            <h2 className="text-lg font-bold mb-3">{game.name}</h2>

            <div className="space-y-2">
              <div>
                <p className="text-blue-100 text-xs mb-0.5">Vous incarnez</p>
                <p className="text-sm font-bold">
                  {normalizedAssignedProfile?.display_name || "Chargement..."}
                </p>
              </div>

              {normalizedAssignedProfile && (
                <div>
                  <p className="text-blue-100 text-xs mb-0.5">Biographie</p>
                  <p className="text-xs">
                    {normalizedAssignedProfile.bio || "Aucune bio"}
                  </p>
                </div>
              )}
            </div>

            {isCreator && (
              <button
                onClick={handleStartVoting}
                className="w-full mt-3 bg-orange-600 text-white px-2 py-1 rounded-md hover:bg-orange-700 font-semibold text-xs"
              >
                Démarrer les votes
              </button>
            )}

            {game.winnerId === myParticipant.userId && (
              <div className="mt-3 p-3 bg-yellow-400 rounded-md border-2 border-yellow-500">
                <div className="font-bold text-xs mb-2 text-gray-900">🎁 Vous avez gagné !</div>
                <p className="text-xs text-gray-800 mb-2">Réclamez votre indice dans l&apos;onglet Jeux</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (game.status === "finished" && (!allVotesIn || !votingResults?.results?.length) && !isVotingPhase) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-3xl font-bold mb-4 text-center text-gray-900">
          🏁 Fin de la partie
        </h2>
        <p className="text-gray-700 mb-6 text-center text-lg">
          En attente des votes des autres joueurs…
        </p>
        <div className="flex justify-center mb-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        <div className="text-center">
          <button
            onClick={() => window.dispatchEvent(new Event('returnToLobby'))}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-bold text-lg shadow-lg transition-all hover:scale-105"
          >
            🏠 Retourner aux parties
          </button>
        </div>
      </div>
    );
  }

  if (game.status === "finished" && allVotesIn && votingResults?.results?.length) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-3xl font-bold mb-4 text-center bg-gradient-to-r from-yellow-400 to-orange-500 text-transparent bg-clip-text">
          🎉 Résultats de la partie 🎉
        </h2>
        <p className="text-gray-600 mb-8 text-center text-lg">
          Classement des meilleurs détectives !
        </p>

        <div className="space-y-4 mb-8">
          {votingResults.results
            .sort((a: any, b: any) => b.correctGuesses - a.correctGuesses)
            .map((result: any, index: number) => {
              const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
              const bgColor = index === 0
                ? 'from-yellow-100 to-yellow-200 border-yellow-400'
                : index === 1
                ? 'from-gray-100 to-gray-200 border-gray-400'
                : index === 2
                ? 'from-orange-100 to-orange-200 border-orange-400'
                : 'from-blue-50 to-indigo-50 border-blue-200';

              return (
                <div key={result.userId} className={`p-5 bg-gradient-to-r ${bgColor} border-2 rounded-lg shadow-md transition-all hover:scale-102`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl font-bold">
                        {medal}
                      </div>
                      <div>
                        <p className="font-bold text-xl text-gray-800">{result.userProfile?.displayName || result.userName}</p>
                        <p className="text-sm text-gray-600">
                          Incarnait: <span className="font-semibold text-blue-600">{result.assignedProfile?.displayName || "Inconnu"}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-green-600">{result.correctGuesses}</p>
                      <p className="text-sm text-gray-500">bonnes réponses sur {result.totalVotes}</p>
                    </div>
                  </div>

                  {result.votes && result.votes.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Détails des votes :</p>
                      <div className="space-y-1">
                        {result.votes.map((vote: any, voteIndex: number) => (
                          <div key={voteIndex} className="flex items-center gap-2 text-sm">
                            <span className={vote.isCorrect ? 'text-green-600' : 'text-red-500'}>
                              {vote.isCorrect ? '✓' : '✗'}
                            </span>
                            <span className="text-gray-700">
                              {vote.targetProfile?.displayName} → {vote.guessedProfile?.displayName}
                              {vote.isCorrect && ' ✅'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <div className="text-center">
          <button
            onClick={() => window.dispatchEvent(new Event('returnToLobby'))}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-bold text-lg shadow-lg transition-all hover:scale-105"
          >
            🏠 Retourner aux parties
          </button>
        </div>
      </div>
    );
  }

  if (isVotingPhase) {
    const participantNameById = new Map(
      game.participants.map((p: any) => [p.userId, p.display_name || 'Anonyme'])
    );
    const getAssignedName = (assignedId?: string | null) =>
      (assignedId ? participantNameById.get(assignedId) : null) || 'Inconnu';

    const allAssignedIdentities = game.participants.map((p: any) => ({
      userId: p.userId,
      displayName: getAssignedName(p.assignedIdentityId),
    }));

    const myAssignedName = normalizedAssignedProfile?.display_name || getAssignedName(myParticipant?.assignedIdentityId);

    const requiredPerVoter = voteProgress?.requiredPerVoter || game.participants.length;
    const myVotesCount = voteProgress?.perVoter?.[myParticipant.userId] ?? Object.keys(votes).length;
    const totalVotesCast = voteProgress?.totalVotesCast ?? 0;
    const totalRequiredVotes = voteProgress?.totalRequiredVotes ?? (requiredPerVoter * game.participants.length);
    const myProgressPercent = Math.min(100, Math.round((myVotesCount / requiredPerVoter) * 100));
    const totalProgressPercent = Math.min(100, Math.round((totalVotesCast / totalRequiredVotes) * 100));
    const isVotingComplete = requiredPerVoter > 0 && myVotesCount >= requiredPerVoter;

    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">🗳️ Phase de vote</h2>
        <p className="text-gray-600 mb-6">
          Devinez quelle identité chaque joueur incarnait ! Vous incarniez:
          <span className="font-semibold text-blue-600 ml-1">
            {myAssignedName}
          </span>
        </p>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
                <span>Vos votes</span>
                <span>{myVotesCount}/{requiredPerVoter}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${myProgressPercent}%` }}></div>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
                <span>Votes reçus</span>
                <span>{totalVotesCast}/{totalRequiredVotes}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-green-600 h-2.5 rounded-full transition-all" style={{ width: `${totalProgressPercent}%` }}></div>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">La partie se termine automatiquement quand tous les votes sont reçus.</p>
        </div>

        {isVotingComplete && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            ✅ Vous avez terminé vos votes. Attendez que les autres joueurs terminent.
          </div>
        )}

        <div className="space-y-4">
          {game.participants
            .filter((participant: any) => participant.userId !== myParticipant.userId)
            .map((participant: any) => (
            <div key={participant.userId} className="p-4 border-2 border-gray-200 rounded-lg bg-gradient-to-r from-white to-gray-50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {participant.display_name?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <span className="font-bold text-lg text-gray-800">{participant.display_name || "Anonyme"}</span>
                  <span className="text-gray-600 ml-2">incarnait :</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allAssignedIdentities
                  .filter((identity: any) => identity.userId !== participant.userId)
                  .map((identity: any) => (
                    <button
                      key={identity.userId}
                      disabled={isVotingComplete}
                      onClick={() => handleVote(participant.userId, identity.userId)}
                      className={`p-3 text-sm font-medium rounded-lg border-2 transition-all ${
                        votes[participant.userId] === identity.userId
                          ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-105'
                          : isVotingComplete
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-400'
                      }`}
                    >
                      {identity.displayName}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold">{game.name}</h2>
            <p className="text-gray-600">
              Vous jouez:<span className="font-semibold text-blue-600">
                {normalizedAssignedProfile?.display_name || "Chargement..."}
              </span>
            </p>
            {normalizedAssignedProfile && (
              <p className="text-sm text-gray-500 mt-1">
                Bio: {normalizedAssignedProfile.bio || "Aucune bio"}
              </p>
            )}
          </div>
          {isCreator && (
            <button
              onClick={handleStartVoting}
              className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
            >
              Démarrer les votes
            </button>
          )}
        </div>

        <form onSubmit={handleCreatePost} className="flex gap-2">
          <input
            type="text"
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={`Postez en tant que ${normalizedAssignedProfile?.display_name || "..."}...`}
            maxLength={280}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Poster
          </button>
        </form>
      </div>
    </div>
  );
}
