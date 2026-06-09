import React, { useEffect, useState } from 'react';
import { getDashboardStats } from '../../services/recherches.service';
import type { DashboardStats } from '../../types';

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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(e => setError(e.message || 'Erreur chargement stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#444' }}>
        <SpinLoader /> Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: '10px 14px', borderRadius: 4, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
          ⚠ {error}
        </div>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#444' }}>
          Vérifiez la connexion Supabase dans le fichier <code>.env</code>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Dossiers', value: stats?.total_dossiers || 0, color: '#E6D5B8' },
    { label: 'Analyses', value: stats?.total_recherches || 0, color: '#4ade80' },
    { label: 'Entités', value: stats?.total_entites || 0, color: '#fbbf24' },
  ];

  return (
    <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: '#444', textTransform: 'uppercase' }}>
        Intelligence Dashboard
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {statCards.map(card => (
          <div key={card.label} style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 22, fontWeight: 700, color: card.color, lineHeight: 1.2 }}>
              {card.value.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Recent searches */}
      <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ padding: '9px 12px', borderBottom: '1px solid #2a2a2a', fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444' }}>
          Analyses récentes
        </div>

        {!stats?.recent_recherches?.length ? (
          <div style={{ padding: '20px 12px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#333' }}>
            Aucune analyse enregistrée
          </div>
        ) : (
          stats.recent_recherches.map((r, i) => {
            const time = new Date(r.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 12px', borderBottom: i < stats.recent_recherches.length - 1 ? '1px solid #2a2a2a' : 'none', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, transition: 'background .12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#111')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: '#333', width: 100, flexShrink: 0 }}>{time}</span>
                <span style={{ flex: 1, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.query}</span>
                <span style={{ color: '#444', fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#111', border: '1px solid #2a2a2a', flexShrink: 0 }}>
                  {normalizeName(r.input_type)}
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

      {/* Tips */}
      <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '14px 16px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444', marginBottom: 12 }}>
          Guide rapide
        </div>
        {[
          { icon: '📁', text: 'Créez des dossiers pour organiser vos investigations' },
          { icon: '🔍', text: 'Recherchez emails, usernames, IPs, domaines et numéros de téléphone' },
          { icon: '⚡', text: 'Le cache évite de relancer des analyses récentes' },
          { icon: '🔬', text: 'Utilisez la stratégie "Profond" pour une analyse exhaustive' },
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
