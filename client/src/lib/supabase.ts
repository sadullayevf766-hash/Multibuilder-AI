import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    storageKey: 'floorplan_auth_token',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
});

// Get current user's JWT token from localStorage
export function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('floorplan_auth_token');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}

// Get current user id synchronously from localStorage
export function getCurrentUserId(): string | null {
  try {
    const raw = localStorage.getItem('floorplan_auth_token');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user?.id ?? null;
  } catch {
    return null;
  }
}
