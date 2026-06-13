import React, { useState, useEffect } from 'react';
import { getDossiers, createDossier, updateDossier, deleteDossier } from '../../services/dossiers.service';
import type { Dossier } from '../../types';

function SpinLoader() {
  return <div style={{ width: 16, height: 16, border: '2px solid #2a2a2a', borderTopColor: '#E6D5B8', borderRadius: '50%', animation: 'spin .8s linear infinite', display: 'inline-block' }} />;
}

const statutStyle = (s: Dossier['statut']) =>
  s === 'actif' ? { color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)' }
  : s === 'clos' ? { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' }
  : { color: '#888', bg: '#1a1a1a', border: '#2a2a2a' };

export default function DossiersPage() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitre, setNewTitre] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setDossiers(await getDossiers()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitre.trim()) return;
    setCreating(true);
    try {
      const d = await createDossier(newTitre.trim(), newDesc.trim() || undefined);
      setDossiers(prev => [d, ...prev]);
      setNewTitre(''); setNewDesc('');
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  const handleArchive = async (id: string, statut: Dossier['statut']) => {
    try {
      const d = await updateDossier(id, { statut: statut === 'actif' ? 'archivé' : 'actif' });
      setDossiers(prev => prev.map(x => x.id === id ? d : x));
    } catch (e: any) { setError(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer ce dossier et toutes ses données ?')) return;
    try {
      await deleteDossier(id);
      setDossiers(prev => prev.filter(x => x.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const inputStyle = {
    padding: '9px 12px', fontSize: 12,
    background: '#0a0a0a', border: '1px solid #333',
    color: '#fff', borderRadius: 4, outline: 'none',
    fontFamily: 'IBM Plex Mono, monospace',
  } as React.CSSProperties;

  return (
    <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} .fade-in{animation:fadeUp .22s ease forwards}`}</style>

      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: '#444', textTransform: 'uppercase' }}>
        Dossiers d'investigation
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444', marginBottom: 2 }}>
          Nouveau dossier
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Titre du dossier" value={newTitre}
            onChange={e => setNewTitre(e.target.value)} maxLength={255} required
            style={{ ...inputStyle, flex: 2 }}
          />
          <input type="text" placeholder="Description (optionnel)" value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            style={{ ...inputStyle, flex: 3 }}
          />
          <button type="submit" disabled={creating || !newTitre.trim()}
            style={{ padding: '9px 16px', background: '#E6D5B8', border: 'none', color: '#000', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', borderRadius: 4, cursor: creating ? 'not-allowed' : 'pointer', opacity: !newTitre.trim() ? 0.4 : 1, transition: 'all .15s', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {creating ? <SpinLoader /> : '+ Créer'}
          </button>
        </div>
      </form>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 4, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 }}>
          ⚠ {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#444' }}>
          <SpinLoader /> Chargement…
        </div>
      ) : dossiers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#333' }}>
          Aucun dossier — créez votre première investigation
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {dossiers.map(d => {
            const sc = statutStyle(d.statut);
            const date = new Date(d.created_at).toLocaleDateString('fr-FR');
            return (
              <div key={d.id} className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, transition: 'background .12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#111')}
                onMouseLeave={e => (e.currentTarget.style.background = '#0a0a0a')}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{d.titre}</div>
                  {d.description && <div style={{ fontSize: 11, color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.description}</div>}
                  {d.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {d.tags.map(tag => (
                        <span key={tag} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, padding: '1px 5px', borderRadius: 2, background: '#1a1a1a', color: '#666', border: '1px solid #2a2a2a' }}>#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#333' }}>{date}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 3, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                    {d.statut}
                  </span>
                  <button onClick={() => handleArchive(d.id, d.statut)}
                    title={d.statut === 'actif' ? 'Archiver' : 'Réactiver'}
                    style={{ padding: '4px 8px', border: '1px solid #2a2a2a', borderRadius: 3, background: 'none', color: '#444', fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, cursor: 'pointer', transition: 'all .12s' }}
                    onMouseEnter={e => { (e.currentTarget.style.borderColor = '#E6D5B8'); (e.currentTarget.style.color = '#E6D5B8'); }}
                    onMouseLeave={e => { (e.currentTarget.style.borderColor = '#2a2a2a'); (e.currentTarget.style.color = '#444'); }}
                  >
                    {d.statut === 'actif' ? '↓ Archiver' : '↑ Réactiver'}
                  </button>
                  <button onClick={() => handleDelete(d.id)} title="Supprimer"
                    style={{ padding: '4px 8px', border: '1px solid #2a2a2a', borderRadius: 3, background: 'none', color: '#444', fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, cursor: 'pointer', transition: 'all .12s' }}
                    onMouseEnter={e => { (e.currentTarget.style.borderColor = '#f87171'); (e.currentTarget.style.color = '#f87171'); }}
                    onMouseLeave={e => { (e.currentTarget.style.borderColor = '#2a2a2a'); (e.currentTarget.style.color = '#444'); }}
                  >✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
