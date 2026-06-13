import React, { useEffect, useState } from 'react';
import { getDashboardStats } from '../../services/recherches.service';
import { getDbStats, getRecherches } from '../../services/duckdb.service';
import type { DashboardStats } from '../../types';
import type { DbStats, DbRecherche } from '../../services/duckdb.service';

function normalizeName(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function SpinLoader() {
  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 20, height: 20, border: '2px solid #2a2a2a', borderTopColor: '#E6D5B8', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
    </>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 22, fontWeight: 700, color, lineHeight: 1.2 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: '#444', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [supaStats, setSupaStats] = useState<DashboardStats | null>(null);
  const [dbStats, setDbStats]     = useState<DbStats | null>(null);
  const [dbHistory, setDbHistory] = useState<DbRecherche[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL;

    Promise.allSettled([
      getDashboardStats(),
      backendUrl ? getDbStats() : Promise.resolve(null),
      backendUrl ? getRecherches({ limit: 10 }) : Promise.resolve([]),
    ]).then(([supaRes, dbRes, histRes]) => {
      if (supaRes.status === 'fulfilled') setSupaStats(supaRes.value);
      if (dbRes.status === 'fulfilled' && dbRes.value) setDbStats(dbRes.value as DbStats);
      if (histRes.status === 'fulfilled') setDbHistory(histRes.value as DbRecherche[]);
      if (supaRes.status === 'rejected' && dbRes.status === 'rejected') {
        setError('Impossible de charger les statistiques');
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#444' }}>
        <SpinLoader /> Chargement…
      </div>
    );
  }

  // Sources de vérité : Supabase (dossiers) + DuckDB (recherches raw)
  const totalDossiers    = supaStats?.total_dossiers    || 0;
  const totalRecherches  = dbStats?.total_recherches    ?? supaStats?.total_recherches ?? 0;
  const totalEntites     = dbStats?.total_entites       ?? supaStats?.total_entites    ?? 0;
  const cacheEntries     = dbStats?.cache?.valid        ?? 0;
  const avgDuree         = dbStats?.avg_duree_ms ? `${Math.round(dbStats.avg_duree_ms / 1000)}s` : '—';

  // Historique : priorité DuckDB puis Supabase
  const recentList = dbHistory.length > 0
    ? dbHistory
    : (supaStats?.recent_recherches || []).map((r: any) => ({
        id: r.id, query: r.query, input_type: r.input_type,
        nb_resultats: r.nb_resultats, created_at: new Date(r.created_at).getTime() / 1000,
        strategy: r.strategy || 'balanced', statut: r.statut || 'done',
      }));

  return (
    <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: '#444', textTransform: 'uppercase' }}>
        Intelligence Dashboard
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 4, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
          ⚠ {error}
        </div>
      )}

      {/* Stats principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatCard label="Dossiers"  value={totalDossiers}   color="#E6D5B8" />
        <StatCard label="Analyses"  value={totalRecherches} color="#4ade80" sub={`moy. ${avgDuree}`} />
        <StatCard label="Entités"   value={totalEntites}    color="#fbbf24" />
      </div>

      {/* Stats DuckDB */}
      {dbStats && (
        <div style={{ background: '#0a0a0a', border: '1px solid #1a3a2a', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '9px 12px', borderBottom: '1px solid #1a3a2a', fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4ade80' }}>
            🦆 Base DuckDB locale
          </div>
          <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {/* Cache */}
            <div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#444', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cache persistant</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 }}>
                  <span style={{ color: '#666' }}>Entrées valides</span>
                  <span style={{ color: '#4ade80' }}>{dbStats.cache.valid}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 }}>
                  <span style={{ color: '#666' }}>Hits totaux</span>
                  <span style={{ color: '#E6D5B8' }}>{dbStats.cache.total_hits}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 }}>
                  <span style={{ color: '#666' }}>Expirées</span>
                  <span style={{ color: '#444' }}>{dbStats.cache.expired}</span>
                </div>
              </div>
            </div>
            {/* Types d'entités */}
            <div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#444', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Top entités</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {Object.entries(dbStats.entites_by_type).slice(0, 4).map(([type, count]) => (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 }}>
                    <span style={{ color: '#666' }}>{normalizeName(type)}</span>
                    <span style={{ color: '#fbbf24' }}>{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Types de requêtes */}
          {Object.keys(dbStats.by_input_type).length > 0 && (
            <div style={{ padding: '0 12px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(dbStats.by_input_type).map(([type, count]) => (
                <div key={type} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, padding: '2px 7px', borderRadius: 3, background: '#111', border: '1px solid #2a2a2a', color: '#888' }}>
                  {normalizeName(type)} · {count as number}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Historique des recherches */}
      <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ padding: '9px 12px', borderBottom: '1px solid #2a2a2a', fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Analyses récentes</span>
          {dbHistory.length > 0 && (
            <span style={{ color: '#4ade80', fontSize: 8 }}>via DuckDB</span>
          )}
        </div>

        {!recentList.length ? (
          <div style={{ padding: '20px 12px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#333' }}>
            Aucune analyse enregistrée
          </div>
        ) : (
          recentList.map((r: any, i) => {
            const ts = typeof r.created_at === 'number'
              ? new Date(r.created_at * 1000)
              : new Date(r.created_at);
            const timeStr = ts.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 12px', borderBottom: i < recentList.length - 1 ? '1px solid #2a2a2a' : 'none', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, transition: 'background .12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#111')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: '#333', width: 100, flexShrink: 0 }}>{timeStr}</span>
                <span style={{ flex: 1, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.query}</span>
                <span style={{ color: '#444', fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#111', border: '1px solid #2a2a2a', flexShrink: 0 }}>
                  {normalizeName(r.input_type || '')}
                </span>
                <span style={{ color: r.nb_resultats > 0 ? '#4ade80' : '#444', flexShrink: 0 }}>{r.nb_resultats} rés.</span>
                {r.dossier && (
                  <span style={{ color: '#E6D5B8', fontSize: 9, flexShrink: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📁 {r.dossier.titre}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Guide */}
      <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '14px 16px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444', marginBottom: 12 }}>
          Guide rapide
        </div>
        {[
          { icon: '📁', text: 'Créez des dossiers pour organiser vos investigations (Supabase)' },
          { icon: '🔍', text: 'Recherchez emails, usernames, IPs, domaines et numéros de téléphone' },
          { icon: '🦆', text: 'Chaque résultat est persisté dans DuckDB local + mis en cache' },
          { icon: '⚡', text: 'Le cache L1 (mémoire) + L2 (DuckDB) évite de relancer des analyses récentes' },
        ].map(tip => (
          <div key={tip.text} style={{ display: 'flex', gap: 10, fontSize: 11, color: '#888', lineHeight: 1.5, marginBottom: 8 }}>
            <span style={{ flexShrink: 0 }}>{tip.icon}</span>
            <span>{tip.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
