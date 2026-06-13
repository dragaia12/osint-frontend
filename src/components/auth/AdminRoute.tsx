import React from 'react';
import { useAuthContext } from '../../lib/AuthContext';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuthContext();

  if (loading) return null;

  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', flexDirection: 'column', gap: 16,
        fontFamily: 'IBM Plex Mono, monospace',
      }}>
        <div style={{
          padding: '20px 28px', border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 6, background: 'rgba(248,113,113,0.06)',
          display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', letterSpacing: '0.12em' }}>
            ⛔ ACCÈS REFUSÉ
          </div>
          <div style={{ fontSize: 10, color: '#666', lineHeight: 1.7 }}>
            Cette section est réservée aux administrateurs.<br />
            Contactez un administrateur pour obtenir les droits d'accès.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
