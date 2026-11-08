import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { clearDashboardSnapshots } from '../../lib/dashboardCache';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  error: null,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  clearError: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const nextUser = session?.user ?? null;
      setUser((currentUser) => currentUser?.id === nextUser?.id ? currentUser : nextUser);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') clearDashboardSnapshots();
      setSession(session);
      const nextUser = session?.user ?? null;
      setUser((currentUser) => currentUser?.id === nextUser?.id && event !== 'USER_UPDATED' ? currentUser : nextUser);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    supabase.from('profiles').select('preferred_currency').eq('id', userId).maybeSingle().then(({ data }) => {
      if (!active || !['USD', 'EUR', 'GEL'].includes(data?.preferred_currency ?? '')) return;
      let previous: Record<string, unknown> = {};
      try { previous = JSON.parse(localStorage.getItem('user_preferences') || '{}'); } catch { /* ignore malformed legacy preference */ }
      localStorage.setItem('user_preferences', JSON.stringify({ ...previous, currency: data!.preferred_currency }));
      window.dispatchEvent(new Event('f-dash:preferences-changed'));
    });
    return () => { active = false; };
  }, [userId]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const msg = 'Invalid email or password. Please try again.';
      setError(msg);
      return { error: msg };
    }
    return { error: null };
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError('Failed to sign out. Please try again.');
    } else {
      setSession(null);
      setUser(null);
    }
    setLoading(false);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ session, user, loading, error, signIn, signOut, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
