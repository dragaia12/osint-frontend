import React, { useState } from 'react';
import { useSearch } from '../../hooks/useSearch';
import type { SearchStrategy, TrustLevel, SearchResult, IdentityCard } from '../../types';

interface SearchPageProps {
  strategy: SearchStrategy;
  onResultSaved?: (query: string, nbResults: number) => void;
}

function detectType(q: string): string {
  q = q.trim();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(q)) return 'IP';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) return 'Email';
  if (/^\+?[\d\s-]{6,15}$/.test(q)) return 'Tél';
  if (/^https?:\/\//i.test(q)) return 'URL';
  if (/^[a-fA-F0-9]{32,64}$/.test(q)) return 'Hash';
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/.test(q)) return 'Domaine';
  if (q.includes(' ')) return 'Nom';
  return 'Username';
}

function normalizeName(tool: string): string {
  return tool.replace(/_tool$/i, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}


const confStyle = (t: string) => t === 'VERIFIED'
  ? { bg: 'rgba(74,222,128,0.08)', color: '#4ade80', border: 'rgba(74,222,128,0.2)' }
  : t === 'PROBABLE'
    ? { bg: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: 'rgba(251,191,36,0.2)' }
    : { bg: '#1a1a1a', color: '#666', border: '#2a2a2a' };

const EXAMPLES = ['jean.dupont@gmail.com', 'johndoe42', '8.8.8.8', 'example.com', '+33612345678'];

function IdentityCardView({ card, query }: { card: IdentityCard; query: string }) {
  const cs = card.confidence_summary || { verified: 0, probable: 0, candidate: 0 };
  const name = card.name || query;
  return (
    <div className="fade-in" style={{ background: '#0a0a0a', border: '1px solid rgba(230,213,184,0.2)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: '#111' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 4, background: 'rgba(230,213,184,0.08)', border: '1px solid rgba(230,213,184,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, color: '#E6D5B8', fontWeight: 700 }}>
            {name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{name}</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#888', marginTop: 2 }}>{query}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {cs.verified > 0 && <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 3, background: 'rgba(74,222,128,0.08)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>✓ {cs.verified} vérifiés</span>}
          {cs.probable > 0 && <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 3, background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>~ {cs.probable} probables</span>}
        </div>
      </div>

      {Object.entries({ Emails: card.emails, Téléphones: card.phones, Domaines: card.domains, IPs: card.ips }).map(([label, items]: [string, any]) =>
        items?.length ? (
          <div key={label} style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444', marginBottom: 8 }}>{label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map((item: any, i: number) => {
                const c = confStyle(item.trust_level || 'CANDIDATE');
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 4, background: '#111', border: '1px solid #2a2a2a' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#fff', flex: 1, wordBreak: 'break-all' }}>
                      {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#E6D5B8', textDecoration: 'none' }}>{item.value}</a> : item.value}
                    </span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 8, padding: '2px 5px', borderRadius: 2, background: c.bg, color: c.color, border: `1px solid ${c.border}`, flexShrink: 0 }}>
                      {(item.trust_level || 'C').charAt(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}

export default function SearchPage({ strategy, onResultSaved }: SearchPageProps) {
  const [query, setQuery] = useState('');
  const [detectedType, setDetectedType] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<TrustLevel | 'ALL'>('ALL');
  const [showErrors, setShowErrors] = useState(false);

  const { inProgress, progress, progressLabel, toolChips, result, errors, fromCache, startSearch } = useSearch();

  const onInput = (val: string) => {
    setQuery(val);
    setDetectedType(val.trim() ? detectType(val) : '');
  };

  const doSearch = () => {
    if (!query.trim() || inProgress) return;
    startSearch(query.trim(), strategy);
    onResultSaved?.(query.trim(), 0);
    setCollapsedSections(new Set());
    setFilter('ALL');
  };

  const toggleSection = (label: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const card = result?.identity_card;
  const sections = result?.sections || [];
  const totalRes = result?.total_results || 0;

  // Export Obsidian MD
  const exportMD = (data: SearchResult, q: string) => {
    const safe = q.replace(/[^a-zA-Z0-9@._+-]/g, '_');
    const today = new Date().toISOString().split('T')[0];
    const cs = data.identity_card?.confidence_summary || { verified: 0, probable: 0, candidate: 0 };
    const lines = [
      `---\ntags: [osint, investigation]\ncible: "${q}"\ndate: ${today}\nsource: OSINT HUB v7\nrésultats: ${data.total_results || 0}\nvérifiés: ${cs.verified}\n---\n`,
      `# Enquête OSINT — ${q}\n`,
    ];
    data.sections.forEach(s => {
      if (!s.items.length) return;
      lines.push(`\n### ${s.icon || ''} ${s.label}\n`);
      s.items.forEach(item => {
        const pn = normalizeName(item.platform || item.category || '');
        const user = item.username || item.email || item.ip || '';
        const trust = item.trust_level || 'CANDIDATE';
        const em = trust === 'VERIFIED' ? '✅' : trust === 'PROBABLE' ? '🟡' : '⬜';
        lines.push(`- ${em} **${pn}**${user ? ' — `' + user + '`' : ''}${item.url ? ' — [lien](' + item.url + ')' : ''}`);
      });
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `osint_hub_${safe}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // Export CSV
  const exportCSV = (data: SearchResult, q: string) => {
    const safe = q.replace(/[^a-zA-Z0-9@._+-]/g, '_');
    const rows = [['Plateforme', 'Utilisateur', 'URL', 'Confiance', 'Sources']];
    data.sections.forEach(s => {
      s.items.forEach(item => {
        rows.push([
          normalizeName(item.platform || item.category || ''),
          item.username || item.email || item.ip || item.subdomain || '',
          item.url || '', item.trust_level || 'CANDIDATE',
          [...(item.sources || []), item.source].filter(Boolean).join('|'),
        ]);
      });
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `osint_hub_${safe}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>

      {/* ── Search zone ── */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #2a2a2a', background: '#000' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, letterSpacing: '0.15em', color: '#444', textTransform: 'uppercase', marginBottom: 10 }}>
          Cible OSINT
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#0a0a0a', border: `1px solid ${inProgress ? '#E6D5B8' : '#333'}`, borderRadius: 6, padding: '0 12px', transition: 'border-color .15s' }}>
            <span style={{ color: '#444', fontSize: 14, flexShrink: 0 }}>◎</span>
            <input
              type="text" value={query}
              onChange={e => onInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Email, username, IP, domaine, téléphone…"
              style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: 13, padding: '11px 0', fontFamily: 'IBM Plex Mono, monospace', outline: 'none' }}
            />
            {detectedType && (
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, padding: '3px 8px', borderRadius: 3, background: 'rgba(230,213,184,0.08)', color: '#E6D5B8', border: '1px solid rgba(230,213,184,0.2)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {detectedType}
              </span>
            )}
          </div>

          <button onClick={doSearch} disabled={inProgress || !query.trim()}
            style={{ padding: '11px 20px', borderRadius: 6, background: '#E6D5B8', border: 'none', color: '#000', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, cursor: inProgress || !query.trim() ? 'not-allowed' : 'pointer', letterSpacing: '0.08em', whiteSpace: 'nowrap', opacity: !query.trim() ? 0.4 : 1, transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}
          >
            {inProgress
              ? <><span className="spin" style={{ width: 12, height: 12, border: '1.5px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', display: 'inline-block' }} /> Analyse…</>
              : 'Analyser →'
            }
          </button>
        </div>

        {/* Examples */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#333', fontFamily: 'IBM Plex Mono, monospace' }}>Ex :</span>
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => onInput(ex)}
              style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', padding: '3px 8px', borderRadius: 3, background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#888', cursor: 'pointer', transition: 'all .12s' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = '#E6D5B8'; (e.target as HTMLElement).style.color = '#E6D5B8'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = '#2a2a2a'; (e.target as HTMLElement).style.color = '#888'; }}
            >{ex}</button>
          ))}
        </div>

        {/* Progress */}
        {inProgress && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#444', marginBottom: 4 }}>
              <span>{progressLabel}</span><span>{progress}%</span>
            </div>
            <div style={{ height: 2, background: '#1a1a1a', borderRadius: 1, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#E6D5B8', borderRadius: 1, width: `${progress}%`, transition: 'width .3s ease' }} />
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              {Object.entries(toolChips).map(([tool, status]) => (
                <span key={tool} style={{
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, padding: '2px 6px', borderRadius: 2,
                  border: `1px solid ${status === 'done' ? 'rgba(74,222,128,0.3)' : status === 'error' ? 'rgba(248,113,113,0.3)' : 'rgba(230,213,184,0.3)'}`,
                  color: status === 'done' ? '#4ade80' : status === 'error' ? '#f87171' : '#E6D5B8',
                }}>{normalizeName(tool)}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Empty state */}
        {!inProgress && !result && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 20px', fontFamily: 'IBM Plex Mono, monospace', color: '#444' }}>
            <div style={{ fontSize: 28, opacity: 0.2 }}>◎</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#3d3d3d', letterSpacing: '0.1em', textTransform: 'uppercase' }}>En attente d'analyse</div>
            <div style={{ fontSize: 10, textAlign: 'center', lineHeight: 1.7, maxWidth: 320 }}>
              Entrez un email, username, IP, domaine ou numéro de téléphone pour lancer l'investigation.
            </div>
            {!process.env.REACT_APP_BACKEND_URL && (
              <div style={{ marginTop: 12, padding: '8px 14px', borderRadius: 4, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', fontSize: 10, textAlign: 'center' }}>
                ⚡ Mode démo — configurez REACT_APP_BACKEND_URL pour le backend réel
              </div>
            )}
          </div>
        )}

        {/* Identity card */}
        {result && card && <IdentityCardView card={card} query={result.query} />}

        {/* Stats + filters */}
        {result && totalRes > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#888', padding: '4px 10px', borderRadius: 4, background: '#0a0a0a', border: '1px solid #2a2a2a' }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#E6D5B8' }}>{totalRes}</span> résultats
              {fromCache && <span style={{ marginLeft: 8, color: '#67e8f9' }}>⚡ Cache</span>}
            </div>
            {(['ALL', 'VERIFIED', 'PROBABLE', 'CANDIDATE'] as const).map(f => {
              const c = f === 'ALL' ? { bg: 'rgba(230,213,184,0.08)', color: '#E6D5B8', border: 'rgba(230,213,184,0.2)' } : confStyle(f);
              return (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: '3px 10px', borderRadius: 20, fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, border: `1px solid ${filter === f ? c.border : '#2a2a2a'}`, background: filter === f ? c.bg : '#0a0a0a', color: filter === f ? c.color : '#666', cursor: 'pointer', transition: 'all .12s' }}
                >{f === 'ALL' ? 'Tous' : f.charAt(0) + f.slice(1).toLowerCase()}</button>
              );
            })}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {errors.length > 0 && (
                <button onClick={() => setShowErrors(!showErrors)}
                  style={{ padding: '5px 10px', borderRadius: 4, fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', cursor: 'pointer' }}>
                  ⚠ {errors.length} erreurs
                </button>
              )}
              {result && (
                <>
                  <button onClick={() => exportMD(result, result.query)}
                    style={{ padding: '5px 10px', borderRadius: 4, fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, background: 'rgba(230,213,184,0.08)', border: '1px solid rgba(230,213,184,0.2)', color: '#E6D5B8', cursor: 'pointer' }}>
                    ↓ Obsidian
                  </button>
                  <button onClick={() => exportCSV(result, result.query)}
                    style={{ padding: '5px 10px', borderRadius: 4, fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, background: 'rgba(103,232,249,0.08)', border: '1px solid rgba(103,232,249,0.2)', color: '#67e8f9', cursor: 'pointer' }}>
                    ↓ CSV
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Errors panel */}
        {showErrors && errors.length > 0 && (
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '9px 12px', borderBottom: '1px solid #2a2a2a', fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700, color: '#f87171', letterSpacing: '0.12em' }}>
              ERREURS MODULES
            </div>
            {errors.map((err, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', borderBottom: i < errors.length - 1 ? '1px solid #2a2a2a' : 'none' }}>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 600, color: '#fff', flexShrink: 0, width: 140 }}>{normalizeName(err.tool || '')}</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#888' }}>{err.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Result sections */}
        {sections.map((section, idx) => {
          const items = section.items.filter(item => filter === 'ALL' || (item.trust_level || 'CANDIDATE') === filter);
          if (!items.length) return null;
          const verified = items.filter(i => (i.trust_level || '').toUpperCase() === 'VERIFIED').length;
          const collapsed = collapsedSections.has(section.label);

          return (
            <div key={idx} className="fade-in" style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, overflow: 'hidden' }}>
              <div onClick={() => toggleSection(section.label)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: collapsed ? 'none' : '1px solid #2a2a2a', cursor: 'pointer', transition: 'background .12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#111')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 14 }}>{section.icon || '◎'}</span>
                <span style={{ fontSize: 12, fontWeight: 600, flex: 1, letterSpacing: '0.01em' }}>{section.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {verified > 0 && <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, padding: '2px 6px', borderRadius: 2, background: 'rgba(74,222,128,0.08)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.15)' }}>✓ {verified}</span>}
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, padding: '2px 6px', borderRadius: 2, background: '#1a1a1a', color: '#666', border: '1px solid #2a2a2a' }}>{items.length}</span>
                  <span style={{ color: '#444', fontSize: 11, transition: 'transform .2s', transform: collapsed ? '' : 'rotate(90deg)' }}>▶</span>
                </div>
              </div>

              {!collapsed && (
                <div>
                  {items.map((item, i) => {
                    const trust = (item.trust_level || 'CANDIDATE').toUpperCase();
                    const c = confStyle(trust);
                    const platform = normalizeName(item.platform || item.category || 'Service');
                    const user = item.username || item.email || item.ip || item.subdomain || '';
                    const url = item.url || '';
                    const note = item.note || item.description || '';
                    const sources = [...(item.sources || []), item.source].filter(Boolean).join(', ');

                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#000', borderBottom: i < items.length - 1 ? '1px solid #2a2a2a' : 'none', transition: 'background .12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#0a0a0a')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#000')}
                      >
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 600 }}>{platform}</span>
                            {user && <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#888' }}>@{user}</span>}
                          </div>
                          {url && <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#E6D5B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
                            <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{url}</a>
                          </div>}
                          {note && <div style={{ fontSize: 9, color: '#666' }}>{note}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          {sources && <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 8, color: '#444', padding: '2px 4px', borderRadius: 2, background: '#1a1a1a' }}>{sources.substring(0, 30)}</span>}
                          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{trust}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
