# OSINT HUB v8 — Guide de déploiement

## Architecture

```
Frontend  → Cloudflare Workers (wrangler)
Backend   → Render (datalyra)
Base      → Supabase (PostgreSQL + Auth + RLS)
```

## 1. Base de données Supabase

### Migration (à exécuter UNE SEULE FOIS)

Ouvrir **Supabase Dashboard → SQL Editor** et coller le contenu de `migration_final.sql`.

Ce fichier crée :
- Toutes les tables avec contraintes
- Les ENUMs stricts
- Les index optimisés
- Les règles RLS pour l'isolation complète des données
- Les fonctions RPC sécurisées
- Le trigger de création automatique de profil

### Créer le premier administrateur

Après inscription, dans le SQL Editor :

```sql
UPDATE profiles
SET role = 'administrateur'
WHERE email = 'votre@email.com';
```

## 2. Variables d'environnement

Copier `.env.example` en `.env` :

```bash
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

## 3. Build & déploiement Cloudflare Workers

```bash
npm install
npm run build
npx wrangler deploy
```

Variables dans Cloudflare Dashboard → Workers → Settings → Variables :
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

## Gestion des rôles

### Rôles disponibles

| Rôle | Accès |
|------|-------|
| `utilisateur` | Ses dossiers, recherches, notes, artefacts uniquement |
| `administrateur` | Tous les dossiers, tous les utilisateurs, stats globales, journaux |

### Isolation des données (RLS)

Chaque table possède deux politiques :

- **`*_user_own`** : `auth.uid() = user_id` — chaque utilisateur voit uniquement ses données
- **`*_admin_all`** : `is_admin()` — l'admin voit tout

La fonction `is_admin()` est définie `SECURITY DEFINER STABLE` pour éviter les appels récursifs dans les politiques.

### Changer le rôle d'un utilisateur

Via le panneau Admin dans l'interface (onglet Utilisateurs), ou en SQL :

```sql
SELECT set_user_role('uuid-de-l-utilisateur', 'administrateur');
```

## Fonctions RPC disponibles

| Fonction | Rôle requis | Description |
|----------|-------------|-------------|
| `is_admin()` | — | Booléen : l'utilisateur courant est-il admin ? |
| `update_recherche_result(id, resultats, nb, ms)` | Propriétaire ou admin | Met à jour les résultats d'une recherche |
| `get_admin_stats()` | Admin | Statistiques globales |
| `get_all_users()` | Admin | Liste de tous les utilisateurs |
| `set_user_role(uid, role)` | Admin | Changer le rôle d'un utilisateur (loggé) |

## Journaux d'activité

Toutes les actions importantes sont enregistrées dans `activity_logs` :

| Action | Déclencheur |
|--------|-------------|
| `sign_in` | Connexion |
| `sign_out` | Déconnexion |
| `sign_up` | Inscription |
| `search` | Lancement d'une analyse |
| `create_dossier` | Création de dossier |
| `update_dossier` | Modification de dossier |
| `delete_dossier` | Suppression de dossier |
| `set_user_role` | Changement de rôle (admin) |

Seuls les administrateurs peuvent lire les journaux (`logs_admin_read`).
Tout utilisateur authentifié peut insérer ses propres logs (`logs_user_insert`).
