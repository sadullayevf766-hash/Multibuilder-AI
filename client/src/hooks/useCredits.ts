import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { apiUrl } from '../lib/api';

export interface UserProfile {
  id: string;
  email: string;
  plan_id: 'free' | 'pro' | 'business';
  credits: number;
  credits_reset_at: string;
  total_generated: number;
  plan_name: string;
  credits_per_week: number;
  credits_per_month: number;
  max_projects: number;
  max_mega_modules: number;
  has_dxf_export: boolean;
  has_watermark: boolean;
  costs: Record<string, number>;
}

interface CreditsContextType {
  profile:  UserProfile | null;
  loading:  boolean;
  error:    string | null;
  refresh:  () => Promise<void>;
  canAfford: (action: string) => boolean;
  getCost:   (action: string) => number;
  resetAt:  Date | null;
}

// Context — AppProvider ichida ishlatiladi
import { createContext as _cc } from 'react';
export const CreditsContext = _cc<CreditsContextType>({
  profile: null, loading: false, error: null,
  refresh: async () => {}, canAfford: () => false,
  getCost: () => 0, resetAt: null,
});

export function useCredits() {
  return useContext(CreditsContext);
}

// Hook — CreditsProvider ichida ishlatiladi
export function useCreditsState(): CreditsContextType {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const getAuthHeader = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    return `Bearer ${session.access_token}`;
  }, []);

  const refresh = useCallback(async () => {
    const auth = await getAuthHeader();
    if (!auth) { setProfile(null); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/credits/profile'), {
        headers: { Authorization: auth },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  // Auth o'zgarganda refresh
  useEffect(() => {
    refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') refresh();
      if (event === 'SIGNED_OUT') setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const canAfford = useCallback((action: string): boolean => {
    if (!profile) return false;
    const cost = profile.costs?.[action] ?? 0;
    return profile.credits >= cost;
  }, [profile]);

  const getCost = useCallback((action: string): number => {
    return profile?.costs?.[action] ?? 0;
  }, [profile]);

  const resetAt = profile?.credits_reset_at ? new Date(profile.credits_reset_at) : null;

  return { profile, loading, error, refresh, canAfford, getCost, resetAt };
}
