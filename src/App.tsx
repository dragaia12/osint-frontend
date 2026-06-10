import React, { useState } from 'react';
import { AuthProvider } from './lib/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import AppLayout from './components/layout/AppLayout';
import SearchPage from './components/search/SearchPage';
import DashboardPage from './components/dashboard/DashboardPage';
import DossiersPage from './components/dossiers/DossiersPage';
import AdminPage from './components/admin/AdminPage';
import type { SearchStrategy } from './types';

type View = 'search' | 'dashboard' | 'dossiers' | 'admin';

function AppContent() {
  const [view, setView] = useState<View>('search');
  const [strategy, setStrategy] = useState<SearchStrategy>('balanced');
  const [sessionStats, setSessionStats] = useState({ searches: 0, results: 0 });

  const handleResultSaved = (_query: string, nbResults: number) => {
    setSessionStats(prev => ({ searches: prev.searches + 1, results: prev.results + nbResults }));
  };

  return (
    <AppLayout
      currentView={view}
      currentStrategy={strategy}
      onViewChange={setView}
      onStrategyChange={setStrategy}
      sessionStats={sessionStats}
    >
      {view === 'search'    && <SearchPage strategy={strategy} onResultSaved={handleResultSaved} />}
      {view === 'dashboard' && <DashboardPage />}
      {view === 'dossiers'  && <DossiersPage />}
      {view === 'admin'     && (
        <AdminRoute>
          <AdminPage />
        </AdminRoute>
      )}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <AppContent />
      </ProtectedRoute>
    </AuthProvider>
  );
}
