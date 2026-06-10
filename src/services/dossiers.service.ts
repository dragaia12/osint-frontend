import { supabase } from '../lib/supabase';
import type { Dossier } from '../types';
import { logActivity } from './profile.service';

export async function getDossiers(): Promise<Dossier[]> {
  const { data, error } = await supabase
    .from('dossiers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createDossier(
  titre: string,
  description?: string,
  tags: string[] = []
): Promise<Dossier> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await supabase
    .from('dossiers')
    .insert({ titre: titre.trim(), description, tags, user_id: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Log activité (best-effort)
  void logActivity('create_dossier', 'dossiers', data.id, { titre: data.titre });

  return data;
}

export async function updateDossier(
  id: string,
  updates: Partial<Pick<Dossier, 'titre' | 'description' | 'tags' | 'statut'>>
): Promise<Dossier> {
  const { data, error } = await supabase
    .from('dossiers').update(updates).eq('id', id).select().single();
  if (error) throw new Error(error.message);

  // Log activité (best-effort)
  void logActivity('update_dossier', 'dossiers', id, { updates });

  return data;
}

export async function deleteDossier(id: string): Promise<void> {
  // Log avant suppression (pour garder la trace)
  void logActivity('delete_dossier', 'dossiers', id, {});

  const { error } = await supabase.from('dossiers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getDossierWithStats(id: string) {
  const [dossierRes, rechercheRes, entiteRes] = await Promise.all([
    supabase.from('dossiers').select('*').eq('id', id).single(),
    supabase.from('recherches').select('id, query, input_type, nb_resultats, created_at')
      .eq('dossier_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('entites_trouvees').select('id, type_entite, valeur, trust_level').eq('dossier_id', id),
  ]);
  return {
    dossier: dossierRes.data,
    recherches: rechercheRes.data || [],
    entites: entiteRes.data || [],
  };
}
