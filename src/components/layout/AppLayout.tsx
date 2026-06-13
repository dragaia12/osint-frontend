import React, { useState } from 'react';
import { useAuthContext } from '../../lib/AuthContext';
import type { SearchStrategy } from '../../types';

type View = 'search' | 'dashboard' | 'dossiers' | 'admin';

interface AppLayoutProps {
  currentView: View;
  currentStrategy: SearchStrategy;
  onViewChange: (v: View) => void;
  onStrategyChange: (s: SearchStrategy) => void;
  sessionStats: { searches: number; results: number };
  children: React.ReactNode;
}

const STRATEGIES: { id: SearchStrategy; icon: string; label: string; desc: string }[] = [
  { id: 'balanced',       icon: '⚖',  label: 'Équilibré',    desc: 'Précision + vitesse' },
  { id: 'deep',           icon: '🔬', label: 'Profond',      desc: 'Analyse exhaustive' },
  { id: 'quick',          icon: '⚡', label: 'Rapide',       desc: 'Résultats immédiats' },
  { id: 'social',         icon: '👤', label: 'Social',       desc: 'Réseaux & comptes' },
  { id: 'infrastructure', icon: '🌐', label: 'Infrastructure', desc: 'DNS, IP, serveurs' },
];

const NAV_ITEMS: { view: View; label: string; adminOnly?: boolean }[] = [
  { view: 'search',    label: 'Recherche' },
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'dossiers',  label: 'Dossiers' },
  { view: 'admin',     label: 'Admin', adminOnly: true },
];

function RoleBadge({ isAdmin }: { isAdmin: boolean }) {
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 3, fontSize: 8, fontFamily: 'IBM Plex Mono, monospace',
      fontWeight: 700, letterSpacing: '0.1em',
      background: isAdmin ? 'rgba(251,191,36,0.12)' : 'rgba(74,222,128,0.08)',
      border: `1px solid ${isAdmin ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.2)'}`,
      color: isAdmin ? '#fbbf24' : '#4ade80',
    }}>
      {isAdmin ? 'ADMIN' : 'USER'}
    </span>
  );
}

function SidebarContent({
  currentStrategy, onStrategyChange, sessionStats, isAdmin, onClose,
}: {
  currentStrategy: SearchStrategy;
  onStrategyChange: (s: SearchStrategy) => void;
  sessionStats: { searches: number; results: number };
  isAdmin: boolean;
  onClose?: () => void;
}) {
  return (
    <>
      <div style={{ padding: '0 12px 20px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', color: '#444', textTransform: 'uppercase', padding: '0 4px', marginBottom: 8 }}>
          Stratégie
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {STRATEGIES.map(s => (
            <div key={s.id}
              onClick={() => { onStrategyChange(s.id); onClose?.(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                border: `1px solid ${currentStrategy === s.id ? 'rgba(230,213,184,0.2)' : 'transparent'}`,
                background: currentStrategy === s.id ? 'rgba(230,213,184,0.08)' : 'transparent',
                transition: 'all .12s',
              }}
            >
              <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: currentStrategy === s.id ? '#E6D5B8' : '#fff' }}>{s.label}</div>
                <div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: '#2a2a2a', margin: '0 12px 20px' }} />

      <div style={{ padding: '0 12px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', color: '#444', textTransform: 'uppercase', padding: '0 4px', marginBottom: 8 }}>
          Session
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: 'Analyses', value: sessionStats.searches, color: '#4ade80' },
            { label: 'Résultats', value: sessionStats.results, color: '#fff' },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 4, background: '#0a0a0a', border: '1px solid #2a2a2a' }}>
              <span style={{ fontSize: 10, color: '#444' }}>{stat.label}</span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 600, color: stat.color }}>{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {isAdmin && (
        <>
          <div style={{ height: 1, background: '#2a2a2a', margin: '20px 12px 0' }} />
          <div style={{ padding: '12px 12px 0' }}>
            <div style={{ padding: '8px 10px', borderRadius: 4, background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12 }}>⚡</span>
              <div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.1em' }}>MODE ADMIN</div>
                <div style={{ fontSize: 9, color: '#555', marginTop: 1 }}>Accès complet activé</div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function AppLayout({ currentView, currentStrategy, onViewChange, onStrategyChange, sessionStats, children }: AppLayoutProps) {
  const { user, isAdmin, signOut } = useAuthContext();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const userInitials = user?.email?.charAt(0).toUpperCase() || 'A';

  const visibleNav = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  return (
    <>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeUp .22s ease forwards}
        .spin{animation:spin .8s linear infinite}
        .pulse-dot{animation:pulse 2s ease-in-out infinite}
        @media(max-width:768px){
          .sidebar-desktop{display:none!important}
          .burger-btn{display:flex!important}
          .topbar-meta-wrap{display:none!important}
        }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, display: 'grid', gridTemplateRows: '48px 1fr', gridTemplateColumns: '260px 1fr', background: '#000' }}>

        {/* ── Topbar ── */}
        <header style={{
          gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', borderBottom: '1px solid #2a2a2a', background: '#000', zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="burger-btn" onClick={() => setDrawerOpen(true)}
              style={{ display: 'none', width: 32, height: 32, border: '1px solid #2a2a2a', borderRadius: 4, background: 'none', cursor: 'pointer', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {[0,1,2].map(i => <span key={i} style={{ display: 'block', width: 14, height: 1, background: '#888' }} />)}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: '#fff' }}>
              <div style={{ width: 24, height: 24, border: '1px solid #3d3d3d', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 4, border: '1px solid #E6D5B8', opacity: 0.5 }} />
                <div style={{ width: 8, height: 8, background: '#E6D5B8', clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)' }} />
              </div>
              OSINTHUB<span style={{ color: '#E6D5B8', fontSize: 9, opacity: 0.6, marginLeft: -4 }}>v7</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="topbar-meta-wrap" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#444', padding: '0 12px', borderRight: '1px solid #2a2a2a', marginRight: 4 }}>
              <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'block' }} />
              <span>{sessionStats.searches} analyses</span>
            </div>

            <div style={{ display: 'flex', gap: 2 }}>
              {visibleNav.map(({ view, label }) => (
                <button key={view} onClick={() => onViewChange(view)}
                  style={{
                    padding: '5px 12px', borderRadius: 4, background: 'none',
                    border: `1px solid ${currentView === view ? (view === 'admin' ? '#fbbf24' : '#E6D5B8') : 'transparent'}`,
                    backgroundColor: currentView === view ? (view === 'admin' ? 'rgba(251,191,36,0.08)' : 'rgba(230,213,184,0.08)') : 'transparent',
                    color: currentView === view ? (view === 'admin' ? '#fbbf24' : '#E6D5B8') : (view === 'admin' ? '#fbbf2466' : '#444'),
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, letterSpacing: '0.06em',
                    cursor: 'pointer', transition: 'all .12s', textTransform: 'uppercase',
                  }}
                >{label}</button>
              ))}
            </div>

            <button onClick={signOut}
              style={{ padding: '5px 12px', borderRadius: 4, background: 'none', border: '1px solid #2a2a2a', color: '#444', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, letterSpacing: '0.06em', cursor: 'pointer', transition: 'all .12s' }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#f87171'; (e.target as HTMLButtonElement).style.borderColor = '#f87171'; }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#444'; (e.target as HTMLButtonElement).style.borderColor = '#2a2a2a'; }}
            >Déconnexion</button>
          </div>
        </header>

        {/* ── Sidebar desktop ── */}
        <nav className="sidebar-desktop" style={{ background: '#000', borderRight: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
            <SidebarContent currentStrategy={currentStrategy} onStrategyChange={onStrategyChange} sessionStats={sessionStats} isAdmin={isAdmin} />
          </div>
          <div style={{ padding: 12, borderTop: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 4, background: '#0a0a0a', border: '1px solid #2a2a2a' }}>
              <div style={{ width: 28, height: 28, borderRadius: 2, background: isAdmin ? 'rgba(251,191,36,0.12)' : 'rgba(230,213,184,0.08)', border: `1px solid ${isAdmin ? '#fbbf24' : '#E6D5B8'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 700, color: isAdmin ? '#fbbf24' : '#E6D5B8', flexShrink: 0 }}>
                {userInitials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <RoleBadge isAdmin={isAdmin} />
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* ── Main ── */}
        <main style={{ display: 'grid', gridTemplateRows: '1fr', overflow: 'hidden', background: '#000' }}>
          {children}
        </main>
      </div>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)' }}
        />
      )}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 280, zIndex: 201,
        background: '#000', borderRight: '1px solid #2a2a2a',
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .25s ease', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.1em' }}>OSINTHUB</span>
          <button onClick={() => setDrawerOpen(false)} style={{ width: 28, height: 28, border: '1px solid #333', borderRadius: 4, background: 'none', color: '#888', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
          <SidebarContent currentStrategy={currentStrategy} onStrategyChange={onStrategyChange} sessionStats={sessionStats} isAdmin={isAdmin} onClose={() => setDrawerOpen(false)} />
        </div>
      </div>
    </>
  );
}
