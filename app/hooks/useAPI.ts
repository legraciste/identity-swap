'use client';

import { useAuth } from '@/app/contexts/AuthContext';
import { useCallback } from 'react';

export function useAPI() {
  const { token } = useAuth();
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const normalizedBase = apiBase.endsWith('/api') ? apiBase : `${apiBase}/api`;

  const fetchWithAuth = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${normalizedBase}${endpoint}`, {
        ...options,
        headers,
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        try {
          const error = await response.json();
          throw new Error(error.error || 'API Error');
        } catch {
          throw new Error(`HTTP ${response.status}`);
        }
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('HTTP')) {
        throw error;
      }
      console.error('Fetch error:', error);
      throw new Error('Network request failed');
    }
  }, [token, normalizedBase]);

  return { fetchWithAuth };
}
