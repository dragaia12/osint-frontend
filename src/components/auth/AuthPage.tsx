import React, { useState } from 'react';
import { useAuthContext } from '../../lib/AuthContext';

const S = {
  root: {
    position: 'fixed' as const, inset: 0, background: '#000',
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
  },
  gridBg: {
    position: 'absolute' as const, inset: 0, pointerEvents: 'none' as const,
    backgroundImage:
      'linear-gradient(rgba(230,213,184,.03) 1px,transparent 1px),' +
      'linear-gradient(90deg,rgba(230,213,184,.03) 1px,transparent 1px)',
    backgroundSize: '60px 60px',
  },
  vignette: {
    position: 'absolute' as const, inset: 0, pointerEvents: 'none' as const,
    background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 40%, #000 100%)',
  },
  inner: {
    position: 'relative' as const, zIndex: 1,
    width: '100%', maxWidth: 420, padding: '0 24px',
    display: 'flex', flexDirection: 'column' as const, gap: 32,
  },
};

export default function AuthPage() {
  const { signIn, signUp } = useAuthContext();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null); setLoading(true);
    if (mode === 'login') {
      const err = await signIn(email, password);
      if (err) setError(err);
    } else {
      const err = await signUp(email, password);
      if (err) setError(err);
      else setInfo('Compte créé. Vérifiez votre email pour confirmer, puis connectez-vous.');
    }
    setLoading(false);
  };

  return (
    <div style={S.root}>
      <div style={S.gridBg} />
      <div style={S.vignette} />
      <div style={S.inner}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, border: '1px solid #3d3d3d', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 6, border: '1px solid #E6D5B8', opacity: 0.4 }} />
            <div style={{ width: 14, height: 14, background: '#E6D5B8', clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 32, fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1 }}>
              OSINT<span style={{ color: '#E6D5B8' }}>HUB</span>
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, letterSpacing: '0.25em', color: '#444', textTransform: 'uppercase', marginTop: 6 }}>
              Plateforme de renseignement v7
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 1, marginBottom: 4 }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} type="button"
                onClick={() => { setMode(m); setError(null); setInfo(null); }}
                style={{
                  flex: 1, padding: '8px 0',
                  background: mode === m ? 'rgba(230,213,184,0.08)' : '#0a0a0a',
                  border: `1px solid ${mode === m ? 'rgba(230,213,184,0.2)' : '#2a2a2a'}`,
                  color: mode === m ? '#E6D5B8' : '#666',
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: 10,
                  letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                  cursor: 'pointer', transition: 'all .15s', borderRadius: 3,
                }}
              >{m === 'login' ? 'Connexion' : 'Inscription'}</button>
            ))}
          </div>

          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required
            style={{ width: '100%', padding: '13px 14px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, borderRadius: 4, outline: 'none' }}
          />
          <input type="password"
            placeholder={mode === 'register' ? 'Mot de passe (min. 8 caractères)' : 'Mot de passe'}
            value={password} onChange={e => setPassword(e.target.value)}
            required minLength={mode === 'register' ? 8 : 1}
            style={{ width: '100%', padding: '13px 14px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, borderRadius: 4, outline: 'none' }}
          />

          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 4, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 }}>
              ⚠ {error}
            </div>
          )}
          {info && (
            <div style={{ padding: '8px 12px', borderRadius: 4, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 }}>
              ✓ {info}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ padding: '14px', background: '#E6D5B8', border: 'none', color: '#000', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, cursor: loading ? 'not-allowed' : 'pointer', borderRadius: 4, opacity: loading ? 0.7 : 1, transition: 'all .15s' }}
          >
            {loading ? '…' : mode === 'login' ? 'Accéder à la plateforme' : 'Créer le compte'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#2a2a2a', letterSpacing: '0.1em' }}>
          OSINT HUB v7 — Usage restreint aux professionnels autorisés
        </div>
      </div>
    </div>
  );
}
