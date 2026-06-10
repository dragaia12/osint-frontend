import { useState, useEffect, useCallback } from 'react';
import { supabase, isConfigured } from '../lib/supabase';
import type { AuthUser, UserRole } from '../types';
import { signIn, signOut, signUp } from '../services/auth.service';
import { getCurrentProfile } from '../services/profile.service';

interface UseAuthReturn {
  user: AuthUser | null;
  role: UserRole | null;
  isAdmin: boolean;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  /** Charge le profil (rôle) pour l'utilisateur connecté */
  const loadProfile = useCallback(async (userId: string, email: string, createdAt: string) => {
    const profile = await getCurrentProfile();
    const userRole = profile?.role ?? 'utilisateur';
    setRole(userRole);
    setUser({ id: userId, email, created_at: createdAt, role: userRole });
  }, []);

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id, session.user.email!, session.user.created_at)
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user.id, session.user.email!, session.user.created_at)
          .finally(() => setLoading(false));
      } else {
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    const result = await signIn(email, password);
    return result.error;
  }, []);

  const handleSignUp = useCallback(async (email: string, password: string) => {
    const result = await signUp(email, password);
    return result.error;
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setUser(null);
    setRole(null);
  }, []);

  return {
    user,
    role,
    isAdmin: role === 'administrateur',
    loading,
    configured: isConfigured,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
  };
}
