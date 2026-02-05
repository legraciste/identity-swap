'use client';

import { useAuth } from '@/app/contexts/AuthContext';
import { toast } from 'sonner';

export default function SignOutButton() {
  const { isAuthenticated, signOut } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="px-4 py-2 rounded bg-white text-secondary border border-gray-200 font-semibold hover:bg-gray-50 hover:text-secondary-hover transition-colors shadow-sm hover:shadow"
      onClick={() => {
        signOut();
        toast.success('Déconnexion réussie');
      }}
    >
      Se déconnecter
    </button>
  );
}
