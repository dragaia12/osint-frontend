import { supabase } from '../lib/supabase';
import type { AdminStats, AdminUserRow, ActivityLog, UserRole } from '../types';

/** Statistiques globales (admin uniquement) */
export async function getAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) throw new Error(error.message);
  return data as AdminStats;
}

/** Liste de tous les utilisateurs avec leur activité (admin) */
export async function getAllUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('get_all_users');
  if (error) throw new Error(error.message);
  return (data || []) as AdminUserRow[];
}

/** Changer le rôle d'un utilisateur (admin) */
export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase.rpc('set_user_role', {
    target_user_id: userId,
    new_role: role,
  });
  if (error) throw new Error(error.message);
}

/** Journaux d'activité (admin) */
export async function getActivityLogs(limit = 100): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as ActivityLog[];
}

/** Journaux filtrés par utilisateur */
export async function getActivityLogsByUser(userId: string, limit = 50): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as ActivityLog[];
}
