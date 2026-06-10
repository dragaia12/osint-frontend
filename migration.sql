-- ═══════════════════════════════════════════════════════════════════════════
-- OSINT HUB — Migration Supabase complète
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMs stricts ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE entity_type AS ENUM (
    'email','phone','ip','domain','username','url',
    'hash','crypto','name','organization','social_profile',
    'location','document','certificate'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trust_level AS ENUM ('VERIFIED','PROBABLE','CANDIDATE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE search_status AS ENUM ('pending','running','done','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE search_strategy AS ENUM ('balanced','deep','quick','social','infrastructure');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dossier_statut AS ENUM ('actif','archivé','clos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pivot_type AS ENUM ('leads_to','related_to','part_of','same_as','source_of');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE artifact_type AS ENUM ('json','csv','markdown','screenshot','report');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Table: dossiers ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dossiers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titre       TEXT NOT NULL CHECK (length(titre) BETWEEN 1 AND 255),
  description TEXT,
  tags        TEXT[] DEFAULT '{}',
  statut      dossier_statut DEFAULT 'actif',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Table: recherches (IMMUTABLES) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recherches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dossier_id      UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query           TEXT NOT NULL CHECK (length(query) BETWEEN 1 AND 1000),
  input_type      entity_type NOT NULL,
  strategy        search_strategy NOT NULL DEFAULT 'balanced',
  statut          search_status DEFAULT 'pending',
  resultats_raw   JSONB,
  nb_resultats    INTEGER DEFAULT 0,
  duree_ms        INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
  -- Pas de updated_at : recherches immutables
);

-- Empêcher toute UPDATE (immutabilité)
CREATE OR REPLACE RULE recherches_no_update AS
  ON UPDATE TO recherches DO INSTEAD NOTHING;

-- ─── Table: entites_trouvees ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entites_trouvees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recherche_id    UUID NOT NULL REFERENCES recherches(id) ON DELETE CASCADE,
  dossier_id      UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type_entite     entity_type NOT NULL,
  valeur          TEXT NOT NULL CHECK (length(valeur) BETWEEN 1 AND 2000),
  trust_level     trust_level NOT NULL DEFAULT 'CANDIDATE',
  platform        TEXT,
  url             TEXT,
  note            TEXT,
  sources         TEXT[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  -- Unicité par dossier
  UNIQUE (dossier_id, type_entite, valeur)
);

-- ─── Table: pivots ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pivots (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dossier_id          UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entite_source_id    UUID NOT NULL REFERENCES entites_trouvees(id) ON DELETE CASCADE,
  entite_cible_id     UUID NOT NULL REFERENCES entites_trouvees(id) ON DELETE CASCADE,
  type_pivot          pivot_type NOT NULL,
  confiance           INTEGER DEFAULT 50 CHECK (confiance BETWEEN 0 AND 100),
  note                TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entite_source_id, entite_cible_id, type_pivot)
);

-- ─── Table: notes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dossier_id      UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recherche_id    UUID REFERENCES recherches(id) ON DELETE SET NULL,
  entite_id       UUID REFERENCES entites_trouvees(id) ON DELETE SET NULL,
  contenu         TEXT NOT NULL CHECK (length(contenu) >= 1),
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Table: artefacts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artefacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dossier_id      UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recherche_id    UUID REFERENCES recherches(id) ON DELETE SET NULL,
  nom             TEXT NOT NULL CHECK (length(nom) BETWEEN 1 AND 255),
  type_artefact   artifact_type NOT NULL,
  contenu         TEXT NOT NULL,
  taille_bytes    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Table: cache_modules ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cache_modules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_key   TEXT NOT NULL,
  query       TEXT NOT NULL,
  input_type  entity_type NOT NULL,
  strategy    search_strategy NOT NULL,
  resultats   JSONB NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, cache_key)
);

-- ─── Index optimisés ─────────────────────────────────────────────────────────
-- dossiers
CREATE INDEX IF NOT EXISTS idx_dossiers_user_id ON dossiers(user_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_statut ON dossiers(statut);
CREATE INDEX IF NOT EXISTS idx_dossiers_created_at ON dossiers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dossiers_tags ON dossiers USING GIN(tags);

-- recherches
CREATE INDEX IF NOT EXISTS idx_recherches_user_id ON recherches(user_id);
CREATE INDEX IF NOT EXISTS idx_recherches_dossier_id ON recherches(dossier_id);
CREATE INDEX IF NOT EXISTS idx_recherches_input_type ON recherches(input_type);
CREATE INDEX IF NOT EXISTS idx_recherches_statut ON recherches(statut);
CREATE INDEX IF NOT EXISTS idx_recherches_created_at ON recherches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recherches_query_trgm ON recherches USING GIN(query gin_trgm_ops);

-- entites_trouvees
CREATE INDEX IF NOT EXISTS idx_entites_user_id ON entites_trouvees(user_id);
CREATE INDEX IF NOT EXISTS idx_entites_dossier_id ON entites_trouvees(dossier_id);
CREATE INDEX IF NOT EXISTS idx_entites_recherche_id ON entites_trouvees(recherche_id);
CREATE INDEX IF NOT EXISTS idx_entites_type ON entites_trouvees(type_entite);
CREATE INDEX IF NOT EXISTS idx_entites_trust ON entites_trouvees(trust_level);
CREATE INDEX IF NOT EXISTS idx_entites_valeur ON entites_trouvees(valeur);
CREATE INDEX IF NOT EXISTS idx_entites_metadata ON entites_trouvees USING GIN(metadata);

-- pivots
CREATE INDEX IF NOT EXISTS idx_pivots_dossier_id ON pivots(dossier_id);
CREATE INDEX IF NOT EXISTS idx_pivots_source ON pivots(entite_source_id);
CREATE INDEX IF NOT EXISTS idx_pivots_cible ON pivots(entite_cible_id);

-- notes
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_dossier_id ON notes(dossier_id);
CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes USING GIN(tags);

-- artefacts
CREATE INDEX IF NOT EXISTS idx_artefacts_dossier_id ON artefacts(dossier_id);
CREATE INDEX IF NOT EXISTS idx_artefacts_type ON artefacts(type_artefact);

-- cache
CREATE INDEX IF NOT EXISTS idx_cache_user_key ON cache_modules(user_id, cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_modules(expires_at);

-- ─── Triggers: updated_at automatique ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dossiers_updated_at ON dossiers;
CREATE TRIGGER trg_dossiers_updated_at
  BEFORE UPDATE ON dossiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_notes_updated_at ON notes;
CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Cleanup automatique du cache expiré ─────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM cache_modules WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ─── RLS: Row Level Security ──────────────────────────────────────────────────
ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE recherches ENABLE ROW LEVEL SECURITY;
ALTER TABLE entites_trouvees ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivots ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE artefacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_modules ENABLE ROW LEVEL SECURITY;

-- Politique: accès uniquement à ses propres données
CREATE POLICY "dossiers_own" ON dossiers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recherches_own" ON recherches
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "entites_own" ON entites_trouvees
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pivots_own" ON pivots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes_own" ON notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "artefacts_own" ON artefacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cache_own" ON cache_modules
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
