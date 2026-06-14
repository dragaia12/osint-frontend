# OSINT HUB v7.4

Plateforme d'investigation OSINT — React SPA, Vite, Supabase.

## Stack

- **React 19** + TypeScript
- **Vite 6** (build SPA classique, zéro SSR)
- **Supabase** (auth + base de données)
- **Cloudflare Pages** (hébergement statique)

## Déploiement Cloudflare Pages

### 1. Build settings (dans le dashboard Cloudflare Pages)

| Paramètre | Valeur |
|-----------|--------|
| Framework preset | `None` (ou Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | `20` |

### 2. Variables d'environnement

Dans **Settings > Environment variables**, ajouter :

| Variable | Valeur |
|----------|--------|
| `VITE_SUPABASE_URL` | `https://VOTRE_PROJECT_ID.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| `VITE_OSINT_BACKEND_URL` | URL de votre backend WebSocket (optionnel) |

> ⚠️ Les variables Vite **doivent** commencer par `VITE_` pour être exposées au client.

### 3. Routing SPA

Le fichier `public/_redirects` contient déjà la règle pour que Cloudflare Pages serve `index.html` sur toutes les routes :
```
/* /index.html 200
```

## Développement local

```bash
npm install
# Créer un fichier .env.local avec vos variables
cp .env.example .env.local
# Éditer .env.local avec vos vraies valeurs
npm run dev
```

## Mode démo

Si `VITE_OSINT_BACKEND_URL` est absent ou vide, le moteur de recherche tourne en **mode démo** avec des données fictives. Idéal pour tester l'interface sans backend.

## Migrations Supabase

Les migrations sont dans `supabase/migrations/`. À appliquer via :
```bash
supabase db push
```
