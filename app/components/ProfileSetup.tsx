'use client';

import { useState } from 'react';
import { useAPI } from '@/app/hooks/useAPI';
import { toast } from 'sonner';

interface ProfileSetupProps {
  gameId?: string | null;
  onProfileCreated?: (profile: any) => void;
}

export default function ProfileSetup({ gameId, onProfileCreated }: ProfileSetupProps) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState('');
  const { fetchWithAuth } = useAPI();

  const handleAddInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setInterests(interests.filter((i) => i !== interest));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Le nom d'affichage est requis");
      return;
    }
    if (!gameId) {
      toast.error('Game ID manquant pour le profil');
      return;
    }

    try {
      const response = await fetchWithAuth('/profiles/create-or-update', {
        method: 'POST',
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim(),
          interests,
          gameId,
        }),
      });
      toast.success('Profil créé avec succès !');
      if (onProfileCreated) {
        onProfileCreated(response || { displayName: displayName.trim(), bio, interests });
      } else {
        window.location.reload();
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la création du profil');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="profile-setup-title">Créez votre profil</h2>
      <p className="text-gray-600 text-center mb-6">
        Votre profil sera utilisé comme identité dans les parties.
        Soyez créatif, les autres joueurs devront vous incarner !
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom d'affichage *
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-700"
            placeholder="Votre nom d'affichage"
            maxLength={50}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-700"
            placeholder="Parlez-nous de vous..."
            rows={3}
            maxLength={200}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Centres d'intérêt
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-700"
              placeholder="Ajouter un intérêt"
              maxLength={30}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInterest())}
            />
            <button
              type="button"
              onClick={handleAddInterest}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {interests.map((interest) => (
              <span
                key={interest}
                className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {interest}
                <button
                  type="button"
                  onClick={() => handleRemoveInterest(interest)}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 font-medium"
        >
          Créer mon profil
        </button>
      </form>
    </div>
  );
}
