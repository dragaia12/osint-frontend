import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types';

/** Récupère le profil de l'utilisateur courant */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

/** Vérifie si l'utilisateur courant est admin */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === 'administrateur';
}

/** Enregistre une action dans activity_logs */
export async function logActivity(
  action: string,
  resource?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    user_email: user.email!,
    action,
    resource,
    resource_id: resourceId,
    metadata: metadata || {},
  });
}
