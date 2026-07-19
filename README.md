# OSINT HUB — Frontend (Option B : DuckDB-Wasm)

## Architecture

```
build_database.py  →  database.db  →  CDN/public/  →  Navigateur (DuckDB-Wasm)
```

Aucun backend FastAPI requis en production. La base de données tourne directement
dans le navigateur via WebAssembly.

## Démarrage rapide

```bash
# 1. Générer la base (backend/)
pip install duckdb==1.5.4 --break-system-packages
python3 build_database.py --input "./osint_data/**/*" --output database.db

# 2. Copier database.db dans public/ pour le dev local
cp database.db public/

# 3. Configurer l'environnement
cp .env.example .env.local
# Remplir VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY
# VITE_OSINT_DB_URL est déjà sur /database.db

# 4. Installer et lancer
npm install
npm run dev
```

## Production

1. Déposer `database.db` sur un CDN (S3, Cloudflare R2, Netlify, GitHub Pages…)
2. Mettre `VITE_OSINT_DB_URL=https://votre-cdn.com/database.db` dans les variables d'env
3. `npm run build` → déployer le dossier `dist/`

### Exigences CDN pour database.db
- `Accept-Ranges: bytes` (Range Requests HTTP — OBLIGATOIRE pour DuckDB-Wasm)
- CORS : `Access-Control-Allow-Origin`, exposer `Content-Range`, `Content-Length`
- PAS de compression HTTP (gzip/br) sur ce fichier spécifique
- Cache long : `Cache-Control: public, max-age=31536000, immutable`

## Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | URL du projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Clé publique Supabase |
| `VITE_OSINT_DB_URL` | ✅ | URL vers database.db |
| `VITE_OSINT_BACKEND_URL` | ❌ | Non utilisé (option B) |
