import { supabase } from '../lib/supabase';
import type { Recherche, SearchResult, EntityType, SearchStrategy } from '../types';
import { logActivity } from './profile.service';

// TTL cache par type (ms)
const CACHE_TTL: Record<string, number> = {
  email: 6 * 3600 * 1000,
  username: 4 * 3600 * 1000,
  domain: 12 * 3600 * 1000,
  ip: 2 * 3600 * 1000,
  phone: 8 * 3600 * 1000,
  hash: 24 * 3600 * 1000,
  crypto: 1 * 3600 * 1000,
  url: 2 * 3600 * 1000,
  name: 3 * 3600 * 1000,
  default: 2 * 3600 * 1000,
};

function simpleSha256(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0') +
    str.length.toString(16).padStart(8, '0') +
    btoa(str.substring(0, 12)).replace(/[^a-z0-9]/gi, '').substring(0, 16);
}

function cacheKey(query: string, type: EntityType, strategy: SearchStrategy): string {
  const raw = `${type}:${query.toLowerCase().trim()}:${strategy}`;
  return simpleSha256(raw).substring(0, 32);
}

export async function checkCache(
  query: string,
  inputType: EntityType,
  strategy: SearchStrategy
): Promise<SearchResult | null> {
  const key = cacheKey(query, inputType, strategy);
  const { data } = await supabase
    .from('cache_modules')
    .select('resultats, expires_at')
    .eq('cache_key', key)
    .single();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('cache_modules').delete().eq('cache_key', key);
    return null;
  }
  return data.resultats as SearchResult;
}

export async function saveCache(
  query: string,
  inputType: EntityType,
  strategy: SearchStrategy,
  resultats: SearchResult
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const key = cacheKey(query, inputType, strategy);
  const ttl = CACHE_TTL[inputType] || CACHE_TTL.default;
  const expiresAt = new Date(Date.now() + ttl).toISOString();

  await supabase.from('cache_modules').upsert({
    user_id: user.id,
    cache_key: key,
    query: query.trim(),
    input_type: inputType,
    strategy,
    resultats,
    expires_at: expiresAt,
  }, { onConflict: 'user_id,cache_key' });
}

export async function createRecherche(
  dossierId: string,
  query: string,
  inputType: EntityType,
  strategy: SearchStrategy
): Promise<Recherche> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await supabase
    .from('recherches')
    .insert({
      dossier_id: dossierId,
      user_id: user.id,
      query: query.trim(),
      input_type: inputType,
      strategy,
      statut: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Log activité (best-effort)
  void logActivity('search', 'recherches', data.id, {
    query: query.trim(),
    input_type: inputType,
    strategy,
    dossier_id: dossierId,
  });

  return data;
}

export async function updateRechercheResult(
  id: string,
  resultats: SearchResult,
  nbResultats: number,
  dureMs: number
): Promise<void> {
  const { error } = await supabase.rpc('update_recherche_result', {
    p_id: id,
    p_resultats: resultats,
    p_nb_resultats: nbResultats,
    p_duree_ms: dureMs,
  });
  if (error) {
    // Fallback direct si la RPC n'existe pas encore
    await supabase.from('recherches')
      .update({ statut: 'done', resultats_raw: resultats, nb_resultats: nbResultats, duree_ms: dureMs })
      .eq('id', id);
  }
}

export async function getRecherchesByDossier(dossierId: string): Promise<Recherche[]> {
  const { data, error } = await supabase
    .from('recherches').select('*').eq('dossier_id', dossierId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getDashboardStats() {
  const [dossiersRes, rechercheRes, entiteRes, recentRes] = await Promise.all([
    supabase.from('dossiers').select('id', { count: 'exact', head: true }),
    supabase.from('recherches').select('id', { count: 'exact', head: true }),
    supabase.from('entites_trouvees').select('id', { count: 'exact', head: true }),
    supabase.from('recherches')
      .select('id, query, input_type, nb_resultats, duree_ms, created_at, dossiers(titre)')
      .order('created_at', { ascending: false }).limit(10),
  ]);

  return {
    total_dossiers: dossiersRes.count || 0,
    total_recherches: rechercheRes.count || 0,
    total_entites: entiteRes.count || 0,
    recent_recherches: (recentRes.data || []).map((r: any) => ({ ...r, dossier: r.dossiers })),
  };
}
