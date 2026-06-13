/**
 * duckdb.service.ts — Service d'accès aux données persistées via le backend DuckDB
 *
 * Le backend stocke toutes les recherches et entités dans DuckDB (local).
 * Ce service permet au frontend d'interroger cet historique persistant
 * via les endpoints REST /api/db/*.
 *
 * Il complète Supabase : Supabase gère auth + dossiers, DuckDB gère l'historique OSINT brut.
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export interface DbRecherche {
  id: string;
  query: string;
  input_type: string;
  strategy: string;
  statut: string;
  nb_resultats: number;
  duree_ms?: number;
  created_at: number; // timestamp unix
}

export interface DbEntite {
  id: string;
  recherche_id: string;
  type_entite: string;
  valeur: string;
  trust_level?: string;
  platform?: string;
  url?: string;
  created_at: number;
}

export interface DbStats {
  total_recherches: number;
  total_entites: number;
  by_input_type: Record<string, number>;
  entites_by_type: Record<string, number>;
  avg_duree_ms: number;
  cache: {
    entries: number;
    valid: number;
    expired: number;
    total_hits: number;
  };
  db_path: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  if (!BACKEND_URL) throw new Error('REACT_APP_BACKEND_URL non configuré');
  const res = await fetch(`${BACKEND_URL}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

/** Statistiques globales de la base DuckDB */
export async function getDbStats(): Promise<DbStats> {
  return apiFetch<DbStats>('/api/db/stats');
}

/** Historique des recherches persistées */
export async function getRecherches(options?: {
  limit?: number;
  input_type?: string;
  q?: string;
}): Promise<DbRecherche[]> {
  const params = new URLSearchParams();
  if (options?.limit)      params.set('limit', String(options.limit));
  if (options?.input_type) params.set('input_type', options.input_type);
  if (options?.q)          params.set('q', options.q);
  const qs = params.toString();
  const { recherches } = await apiFetch<{ recherches: DbRecherche[] }>(
    `/api/db/recherches${qs ? `?${qs}` : ''}`
  );
  return recherches;
}

/** Détail complet d'une recherche (avec résultats bruts) */
export async function getRechercheDetail(id: string): Promise<DbRecherche & { resultats?: unknown }> {
  return apiFetch(`/api/db/recherches/${id}`);
}

/** Entités extraites et persistées */
export async function getEntites(options?: {
  limit?: number;
  type_entite?: string;
  q?: string;
}): Promise<DbEntite[]> {
  const params = new URLSearchParams();
  if (options?.limit)       params.set('limit', String(options.limit));
  if (options?.type_entite) params.set('type_entite', options.type_entite);
  if (options?.q)           params.set('q', options.q);
  const qs = params.toString();
  const { entites } = await apiFetch<{ entites: DbEntite[] }>(
    `/api/db/entites${qs ? `?${qs}` : ''}`
  );
  return entites;
}

/** Stats du cache (L1 mémoire + L2 DuckDB) */
export async function getCacheStats(): Promise<{
  l1_memory: Record<string, unknown>;
  l2_duckdb: Record<string, unknown>;
}> {
  return apiFetch('/api/cache/stats');
}

/** Vide le cache (L1 + L2) — admin seulement */
export async function clearCache(): Promise<void> {
  if (!BACKEND_URL) return;
  await fetch(`${BACKEND_URL}/api/cache`, { method: 'DELETE' });
}

/** Purge les entrées DuckDB expirées */
export async function purgeExpiredCache(): Promise<number> {
  if (!BACKEND_URL) return 0;
  const res = await fetch(`${BACKEND_URL}/api/cache/purge`, { method: 'POST' });
  const data = await res.json();
  return data.purged ?? 0;
}

/** Santé du backend */
export async function getHealth(): Promise<Record<string, unknown>> {
  return apiFetch('/api/health');
}
