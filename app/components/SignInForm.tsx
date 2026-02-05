'use client';

import { useAuth } from '@/app/contexts/AuthContext';
import { useState } from 'react';
import { toast } from 'sonner';

export default function SignInForm() {
  const { signIn, signInAnonymously } = useAuth();
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn');
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (flow === 'signIn') {
        await signIn(email, password);
        toast.success('Connecté !');
      } else {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error);
        }

        await response.json();

        toast.success('Inscription réussie !');
        setFlow('signIn');
        setEmail('');
        setPassword('');
      }
    } catch (error: any) {
      let toastTitle = '';
      if (error.message.includes('Invalid credentials')) {
        toastTitle = 'Échec de connexion : identifiant invalide';
      } else if (error.message.includes('Invalid password')) {
        toastTitle = 'Mot de passe invalide. Veuillez réessayer.';
      } else {
        toastTitle =
          flow === 'signIn'
            ? error.message || 'Impossible de se connecter'
            : error.message || "Impossible de s'inscrire";
      }
      toast.error(toastTitle);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnonymous = async () => {
    setSubmitting(true);
    try {
      await signInAnonymously();
      toast.success('Connecté anonymement !');
    } catch (error: any) {
      toast.error(error.message || 'Erreur de connexion anonyme');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <form className="flex flex-col gap-form-field" onSubmit={handleSubmit}>
        <input
          className="auth-input-field"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          className="auth-input-field"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          required
        />
        <button className="auth-button" type="submit" disabled={submitting}>
          {flow === 'signIn' ? 'Se connecter' : "S'inscrire"}
        </button>
        <div className="text-center text-sm text-secondary">
          <span>
            {flow === 'signIn'
              ? 'Pas de compte ? '
              : 'Vous avez un compte ? '}
          </span>
          <button
            type="button"
            className="text-primary hover:text-primary-hover hover:underline font-medium cursor-pointer"
            onClick={() => setFlow(flow === 'signIn' ? 'signUp' : 'signIn')}
          >
            {flow === 'signIn' ? "S'inscrire" : 'Se connecter'}
          </button>
        </div>
      </form>
      <div className="flex items-center justify-center my-3">
        <hr className="my-4 grow border-gray-200" />
        <span className="mx-4 text-secondary">ou</span>
        <hr className="my-4 grow border-gray-200" />
      </div>
      <button className="auth-button" onClick={handleAnonymous} disabled={submitting}>
        Se connecter anonymement
      </button>
    </div>
  );
}
