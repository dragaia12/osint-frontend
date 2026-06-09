# OSINT HUB v7

Plateforme d'investigation OSINT robuste et évolutive.

## Stack
- React 18 + TypeScript
- Supabase (Auth + PostgreSQL)
- IBM Plex Mono / Inter

## Structure
```
src/
  types/        Types TypeScript partagés
  lib/          supabase.ts, AuthContext.tsx
  hooks/        useAuth.ts, useSearch.ts
  services/     auth, dossiers, entites, recherches
  components/
    auth/       AuthPage, ProtectedRoute
    layout/     AppLayout
    search/     SearchPage
    dashboard/  DashboardPage
    dossiers/   DossiersPage
```

## Setup

1. Copier `.env.example` → `.env` et renseigner les clés Supabase
2. Exécuter `migration.sql` dans Supabase SQL Editor
3. `npm install && npm start`

## Base de données

Le fichier `migration.sql` contient :
- ENUMs : entity_type, trust_level, search_status, search_strategy, dossier_statut, pivot_type, artifact_type
- Tables : dossiers, recherches (immutables), entites_trouvees, pivots, notes, artefacts, cache_modules
- Index optimisés, triggers updated_at, nettoyage cache expiré
- RLS complet : isolation totale par utilisateur

## Variables d'environnement

```
REACT_APP_SUPABASE_URL=https://xxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
REACT_APP_BACKEND_URL=https://your-backend.onrender.com  # optionnel
```

Sans `REACT_APP_BACKEND_URL`, l'app tourne en mode démo avec données fictives.
