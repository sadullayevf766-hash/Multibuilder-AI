import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
  user:    User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

// Dev bypass — faqat VITE_TEST_BYPASS_AUTH=true bo'lganda
const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_TEST_BYPASS_AUTH === 'true';
const DEV_FAKE_USER = DEV_BYPASS
  ? ({ id: '00000000-0000-0000-0000-000000000001', email: 'dev@test.com' } as User)
  : null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(DEV_FAKE_USER);
  const [loading, setLoading] = useState(!DEV_FAKE_USER);
  // dev bypass mode da signOut qilinganini track qilish
  const [devSignedOut, setDevSignedOut] = useState(false);

  useEffect(() => {
    if (DEV_FAKE_USER && !devSignedOut) return; // bypass aktiv va chiqilmagan

    // Real Supabase auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [devSignedOut]);

  const signOut = useCallback(async () => {
    // Dev bypass da — fake user ni o'chirish va real auth ga o'tish
    if (DEV_BYPASS && !devSignedOut) {
      setUser(null);
      setDevSignedOut(true);
      return;
    }
    // Real Supabase signOut
    await supabase.auth.signOut();
    localStorage.removeItem('floorplan_auth_token');
    setUser(null);
  }, [devSignedOut]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// ProtectedRoute — auth bo'lmasa /login ga redirect
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
          <p className="text-white/30 text-sm">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Hook — navigate bilan birga signOut
export function useSignOut() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return useCallback(async () => {
    await signOut();
    navigate('/login', { replace: true });
  }, [signOut, navigate]);
}
