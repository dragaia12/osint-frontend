import React from 'react';
import { useAuthContext } from '../../lib/AuthContext';
import AuthPage from './AuthPage';

function UnconfiguredBanner() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 52, height: 52, border: '1px solid #3d3d3d', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 6, border: '1px solid #E6D5B8', opacity: 0.4 }} />
          <div style={{ width: 14, height: 14, background: '#E6D5B8', clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)' }} />
        </div>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 22, fontWeight: 700, letterSpacing: '0.08em' }}>
          OSINT<span style={{ color: '#E6D5B8' }}>HUB</span><span style={{ color: '#E6D5B8', fontSize: 11, opacity: 0.6 }}>v7</span>
        </div>
      </div>

      <div style={{ background: '#0a0a0a', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 6, padding: '16px 20px', maxWidth: 480, width: '100%' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.12em', marginBottom: 10 }}>
          ⚡ CONFIGURATION REQUISE
        </div>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#888', lineHeight: 1.8 }}>
          Définissez les variables d'environnement dans Cloudflare :<br/>
          <span style={{ color: '#E6D5B8' }}>REACT_APP_SUPABASE_URL</span><br/>
          <span style={{ color: '#E6D5B8' }}>REACT_APP_SUPABASE_ANON_KEY</span>
        </div>
      </div>

      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#333', letterSpacing: '0.1em', textAlign: 'center', lineHeight: 1.8 }}>
        Cloudflare Dashboard → Workers → Settings → Variables<br/>
        Puis relancez : npx wrangler deploy
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuthContext();

  if (!configured) return <UnconfiguredBanner />;

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #2a2a2a', borderTopColor: '#E6D5B8', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#444', letterSpacing: '0.15em' }}>CHARGEMENT…</div>
      </div>
    );
  }

  if (!user) return <AuthPage />;
  return <>{children}</>;
}
