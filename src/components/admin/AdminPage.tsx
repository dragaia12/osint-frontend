import React, { useEffect, useState, useCallback } from 'react';
import { getAdminStats, getAllUsers, setUserRole, getActivityLogs } from '../../services/admin.service';
import type { AdminStats, AdminUserRow, ActivityLog, UserRole } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function SpinLoader() {
  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 18, height: 18, border: '2px solid #2a2a2a', borderTopColor: '#E6D5B8', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
    </>
  );
}

function Badge({ role }: { role: UserRole }) {
  const isAdmin = role === 'administrateur';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 3, fontSize: 9, fontFamily: 'IBM Plex Mono, monospace',
      fontWeight: 700, letterSpacing: '0.1em',
      background: isAdmin ? 'rgba(251,191,36,0.12)' : 'rgba(74,222,128,0.08)',
      border: `1px solid ${isAdmin ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.2)'}`,
      color: isAdmin ? '#fbbf24' : '#4ade80',
    }}>
      {isAdmin ? 'ADMIN' : 'USER'}
    </span>
  );
}

type AdminTab = 'stats' | 'users' | 'logs';

// ─── Stats panel ──────────────────────────────────────────────────────────────
function StatsPanel({ stats }: { stats: AdminStats }) {
  const cards = [
    { label: 'Utilisateurs',  value: stats.total_users,       color: '#E6D5B8' },
    { label: 'Dossiers',      value: stats.total_dossiers,    color: '#60a5fa' },
    { label: 'Analyses',      value: stats.total_recherches,  color: '#4ade80' },
    { label: 'Entités',       value: stats.total_entites,     color: '#fbbf24' },
    { label: 'Notes',         value: stats.total_notes,       color: '#a78bfa' },
    { label: 'Artefacts',     value: stats.total_artefacts,   color: '#f472b6' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 24, fontWeight: 700, color: c.color, lineHeight: 1.1 }}>
              {c.value.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Activité */}
      <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#444', textTransform: 'uppercase' }}>
          Activité
        </div>
        {[
          { label: 'Analyses aujourd\'hui', value: stats.recherches_today, color: '#4ade80' },
          { label: 'Utilisateurs actifs (7j)', value: stats.active_users_7d, color: '#60a5fa' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 4, background: '#111', border: '1px solid #1f1f1f' }}>
            <span style={{ fontSize: 11, color: '#888' }}>{s.label}</span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Répartition des rôles */}
      <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '14px 16px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#444', textTransform: 'uppercase', marginBottom: 10 }}>
          Répartition des rôles
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.entries(stats.users_by_role || {}).map(([role, count]) => (
            <div key={role} style={{ flex: 1, padding: '8px 10px', borderRadius: 4, background: '#111', border: '1px solid #1f1f1f', textAlign: 'center' }}>
              <Badge role={role as UserRole} />
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 6 }}>
                {String(count)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Users panel ─────────────────────────────────────────────────────────────
function UsersPanel({ users, onRoleChange }: {
  users: AdminUserRow[];
  onRoleChange: (userId: string, role: UserRole) => Promise<void>;
}) {
  const [changing, setChanging] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleChange = async (userId: string, newRole: UserRole) => {
    setChanging(userId);
    try { await onRoleChange(userId, newRole); }
    finally { setChanging(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Barre de recherche */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Filtrer par email…"
        style={{
          background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 4,
          padding: '8px 12px', color: '#fff', fontSize: 11,
          fontFamily: 'IBM Plex Mono, monospace', outline: 'none', width: '100%', boxSizing: 'border-box',
        }}
      />

      {/* Tableau */}
      <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 140px', gap: 8, padding: '7px 12px', borderBottom: '1px solid #2a2a2a', fontFamily: 'IBM Plex Mono, monospace', fontSize: 8, fontWeight: 700, color: '#444', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          <span>Email</span>
          <span>Rôle</span>
          <span>Dossiers</span>
          <span>Analyses</span>
          <span>Action</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 10, color: '#333', fontFamily: 'IBM Plex Mono, monospace' }}>
            Aucun utilisateur
          </div>
        ) : filtered.map((u, i) => (
          <div key={u.id} style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 140px', gap: 8,
            padding: '8px 12px', alignItems: 'center',
            borderBottom: i < filtered.length - 1 ? '1px solid #1a1a1a' : 'none',
          }}>
            <span style={{ fontSize: 11, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.email}
            </span>
            <span><Badge role={u.role} /></span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#888' }}>{u.nb_dossiers}</span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#888' }}>{u.nb_recherches}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {changing === u.id ? (
                <SpinLoader />
              ) : u.role === 'utilisateur' ? (
                <button
                  onClick={() => handleChange(u.id, 'administrateur')}
                  style={{ padding: '3px 8px', borderRadius: 3, border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.06)', color: '#fbbf24', fontSize: 9, fontFamily: 'IBM Plex Mono, monospace', cursor: 'pointer', letterSpacing: '0.06em' }}
                >
                  → ADMIN
                </button>
              ) : (
                <button
                  onClick={() => handleChange(u.id, 'utilisateur')}
                  style={{ padding: '3px 8px', borderRadius: 3, border: '1px solid rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.04)', color: '#4ade80', fontSize: 9, fontFamily: 'IBM Plex Mono, monospace', cursor: 'pointer', letterSpacing: '0.06em' }}
                >
                  → USER
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#333', textAlign: 'right' }}>
        {filtered.length} / {users.length} utilisateurs
      </div>
    </div>
  );
}

// ─── Logs panel ──────────────────────────────────────────────────────────────
function LogsPanel({ logs }: { logs: ActivityLog[] }) {
  const ACTION_COLORS: Record<string, string> = {
    sign_in: '#4ade80', sign_out: '#f87171', search: '#60a5fa',
    create_dossier: '#E6D5B8', delete_dossier: '#f87171',
    create_note: '#a78bfa', create_artefact: '#f472b6',
  };

  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '7px 12px', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#444', textTransform: 'uppercase' }}>
          Journal d'activité
        </span>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#333' }}>
          {logs.length} entrées
        </span>
      </div>

      <div style={{ maxHeight: 480, overflowY: 'auto' }}>
        {logs.length === 0 ? (
          <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 10, color: '#333', fontFamily: 'IBM Plex Mono, monospace' }}>
            Aucune activité enregistrée
          </div>
        ) : logs.map((log, i) => {
          const time = new Date(log.created_at).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
          });
          return (
            <div key={log.id} style={{
              display: 'grid', gridTemplateColumns: '130px 1fr 90px 80px', gap: 10,
              padding: '6px 12px', alignItems: 'center',
              borderBottom: i < logs.length - 1 ? '1px solid #111' : 'none',
              fontFamily: 'IBM Plex Mono, monospace',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#111')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 9, color: '#333' }}>{time}</span>
              <span style={{ fontSize: 10, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.user_email}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                color: ACTION_COLORS[log.action] || '#666',
              }}>
                {log.action.toUpperCase()}
              </span>
              <span style={{ fontSize: 9, color: '#444' }}>
                {log.resource || '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── AdminPage ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, u, l] = await Promise.all([
        getAdminStats(),
        getAllUsers(),
        getActivityLogs(200),
      ]);
      setStats(s);
      setUsers(u);
      setLogs(l);
    } catch (e: any) {
      setError(e.message || 'Erreur chargement admin');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (userId: string, role: UserRole) => {
    await setUserRole(userId, role);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    // Refresh stats
    try {
      const s = await getAdminStats();
      setStats(s);
    } catch { /* non-critique */ }
  };

  const TABS: { id: AdminTab; label: string }[] = [
    { id: 'stats', label: 'Statistiques' },
    { id: 'users', label: `Utilisateurs${users.length ? ` (${users.length})` : ''}` },
    { id: 'logs',  label: 'Journaux' },
  ];

  return (
    <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: '#fbbf24', textTransform: 'uppercase', marginBottom: 4 }}>
            ⚡ Administration
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, fontWeight: 700, color: '#fff' }}>
            Panneau d'administration
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ padding: '6px 14px', borderRadius: 4, border: '1px solid #2a2a2a', background: 'none', color: loading ? '#333' : '#888', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.06em' }}
        >
          {loading ? '…' : '↻ Rafraîchir'}
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 4, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
          ⚠ {error}
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #2a2a2a', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '6px 14px', borderRadius: '4px 4px 0 0', border: 'none',
              background: tab === t.id ? '#0a0a0a' : 'transparent',
              borderBottom: tab === t.id ? '2px solid #E6D5B8' : '2px solid transparent',
              color: tab === t.id ? '#E6D5B8' : '#444',
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, cursor: 'pointer',
              letterSpacing: '0.06em', transition: 'all .12s',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Contenu */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 20, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#444' }}>
          <SpinLoader /> Chargement…
        </div>
      ) : (
        <>
          {tab === 'stats' && stats && <StatsPanel stats={stats} />}
          {tab === 'users' && <UsersPanel users={users} onRoleChange={handleRoleChange} />}
          {tab === 'logs'  && <LogsPanel logs={logs} />}
        </>
      )}
    </div>
  );
}
