import React from 'react';

interface State { hasError: boolean; error: string; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, color: '#f87171', letterSpacing: '0.15em' }}>
          ERREUR APPLICATION
        </div>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#666', maxWidth: 480, textAlign: 'center', lineHeight: 1.7 }}>
          {this.state.error}
        </div>
        <button onClick={() => window.location.reload()}
          style={{ marginTop: 8, padding: '8px 20px', background: '#E6D5B8', border: 'none', color: '#000', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', borderRadius: 4 }}>
          RECHARGER
        </button>
      </div>
    );
  }
}
