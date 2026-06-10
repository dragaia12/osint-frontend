import { supabase } from '../lib/supabase';
import type { AuthUser } from '../types';

export interface AuthResult {
  user: AuthUser | null;
  error: string | null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Sanitize contre XSS */
export function sanitize(input: string): string {
  return input
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;').trim();
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!isValidEmail(email)) return { user: null, error: 'Email invalide.' };
  if (password.length < 8) return { user: null, error: 'Mot de passe trop court (min. 8 caractères).' };

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { user: null, error: error.message };
  if (!data.user) return { user: null, error: 'Erreur lors de la création du compte.' };

  // Log activité (best-effort — le profil est créé par le trigger DB)
  void Promise.resolve(supabase.from('activity_logs').insert({
    user_id: data.user.id,
    user_email: data.user.email!,
    action: 'sign_up',
    resource: 'auth',
    metadata: {},
  }));

  return {
    user: { id: data.user.id, email: data.user.email!, created_at: data.user.created_at },
    error: null,
  };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!isValidEmail(email)) return { user: null, error: 'Email invalide.' };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { user: null, error: 'Identifiants incorrects.' };
  if (!data.user) return { user: null, error: 'Erreur de connexion.' };

  // Log activité (best-effort)
  void Promise.resolve(supabase.from('activity_logs').insert({
    user_id: data.user.id,
    user_email: data.user.email!,
    action: 'sign_in',
    resource: 'auth',
    metadata: {},
  }));

  return {
    user: { id: data.user.id, email: data.user.email!, created_at: data.user.created_at },
    error: null,
  };
}

export async function signOut(): Promise<void> {
  // Log activité avant déconnexion (best-effort)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    void Promise.resolve(supabase.from('activity_logs').insert({
      user_id: user.id,
      user_email: user.email!,
      action: 'sign_out',
      resource: 'auth',
      metadata: {},
    }));
  }
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email!, created_at: data.user.created_at };
}
