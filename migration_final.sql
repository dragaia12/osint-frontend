-- ═══════════════════════════════════════════════════════════════════════════
-- OSINT HUB v8 — Migration finale complète
-- Ordre d'exécution : CE FICHIER SEUL suffit (inclut migration.sql + rls_roles)
-- Exécuter dans : Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── ENUMs ───────────────────────────────────────────────────────────────────
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

-- ─── Fonction updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES PRINCIPALES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── profiles (rôles utilisateurs) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'utilisateur'
                CHECK (role IN ('utilisateur', 'administrateur')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── dossiers ────────────────────────────────────────────────────────────────
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

DROP TRIGGER IF EXISTS trg_dossiers_updated_at ON dossiers;
CREATE TRIGGER trg_dossiers_updated_at
  BEFORE UPDATE ON dossiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── recherches (IMMUTABLES) ─────────────────────────────────────────────────
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
);

-- ─── entites_trouvees ────────────────────────────────────────────────────────
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
  UNIQUE (dossier_id, type_entite, valeur)
);

-- ─── pivots ───────────────────────────────────────────────────────────────────
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

-- ─── notes ────────────────────────────────────────────────────────────────────
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

DROP TRIGGER IF EXISTS trg_notes_updated_at ON notes;
CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── artefacts ────────────────────────────────────────────────────────────────
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

-- ─── cache_modules ────────────────────────────────────────────────────────────
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

-- ─── activity_logs (journaux admin) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email  TEXT NOT NULL,
  action      TEXT NOT NULL,
  resource    TEXT,
  resource_id UUID,
  metadata    JSONB DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEX
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_dossiers_user_id     ON dossiers(user_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_statut      ON dossiers(statut);
CREATE INDEX IF NOT EXISTS idx_dossiers_created_at  ON dossiers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dossiers_tags        ON dossiers USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_recherches_user_id   ON recherches(user_id);
CREATE INDEX IF NOT EXISTS idx_recherches_dossier_id ON recherches(dossier_id);
CREATE INDEX IF NOT EXISTS idx_recherches_input_type ON recherches(input_type);
CREATE INDEX IF NOT EXISTS idx_recherches_statut    ON recherches(statut);
CREATE INDEX IF NOT EXISTS idx_recherches_created_at ON recherches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recherches_query_trgm ON recherches USING GIN(query gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entites_user_id      ON entites_trouvees(user_id);
CREATE INDEX IF NOT EXISTS idx_entites_dossier_id   ON entites_trouvees(dossier_id);
CREATE INDEX IF NOT EXISTS idx_entites_recherche_id ON entites_trouvees(recherche_id);
CREATE INDEX IF NOT EXISTS idx_entites_type         ON entites_trouvees(type_entite);
CREATE INDEX IF NOT EXISTS idx_entites_trust        ON entites_trouvees(trust_level);
CREATE INDEX IF NOT EXISTS idx_entites_valeur       ON entites_trouvees(valeur);
CREATE INDEX IF NOT EXISTS idx_entites_metadata     ON entites_trouvees USING GIN(metadata);

CREATE INDEX IF NOT EXISTS idx_pivots_dossier_id    ON pivots(dossier_id);
CREATE INDEX IF NOT EXISTS idx_pivots_source        ON pivots(entite_source_id);
CREATE INDEX IF NOT EXISTS idx_pivots_cible         ON pivots(entite_cible_id);

CREATE INDEX IF NOT EXISTS idx_notes_user_id        ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_dossier_id     ON notes(dossier_id);
CREATE INDEX IF NOT EXISTS idx_notes_tags           ON notes USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_artefacts_dossier_id ON artefacts(dossier_id);
CREATE INDEX IF NOT EXISTS idx_artefacts_type       ON artefacts(type_artefact);

CREATE INDEX IF NOT EXISTS idx_cache_user_key       ON cache_modules(user_id, cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires        ON cache_modules(expires_at);

CREATE INDEX IF NOT EXISTS idx_logs_user_id         ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_action          ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_created_at      ON activity_logs(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS MÉTIER
-- ═══════════════════════════════════════════════════════════════════════════

-- Création automatique du profil à l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'utilisateur')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Nettoyage automatique du cache expiré
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM cache_modules WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- FONCTION HELPER : is_admin()
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'administrateur'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS : ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE dossiers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recherches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE entites_trouvees  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE artefacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_modules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs     ENABLE ROW LEVEL SECURITY;

-- ── profiles ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select"          ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"      ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin"    ON profiles;
DROP POLICY IF EXISTS "profiles_insert_trigger"  ON profiles;

-- Lecture : son propre profil OU admin voit tout
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());

-- Mise à jour propre : un utilisateur ne peut PAS s'auto-promouvoir
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      role = (SELECT role FROM profiles WHERE id = auth.uid())
      OR is_admin()
    )
  );

-- Admin peut tout modifier (changement de rôle inclus)
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (is_admin());

-- Insert géré uniquement par le trigger SECURITY DEFINER
CREATE POLICY "profiles_insert_trigger" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ── dossiers ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dossiers_own"        ON dossiers;
DROP POLICY IF EXISTS "dossiers_user_own"   ON dossiers;
DROP POLICY IF EXISTS "dossiers_admin_all"  ON dossiers;

-- Utilisateur : ses dossiers uniquement
CREATE POLICY "dossiers_user_own" ON dossiers
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin : accès total
CREATE POLICY "dossiers_admin_all" ON dossiers
  FOR ALL USING (is_admin());

-- ── recherches ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "recherches_own"       ON recherches;
DROP POLICY IF EXISTS "recherches_user_own"  ON recherches;
DROP POLICY IF EXISTS "recherches_admin_all" ON recherches;

CREATE POLICY "recherches_user_own" ON recherches
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recherches_admin_all" ON recherches
  FOR ALL USING (is_admin());

-- ── entites_trouvees ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "entites_own"       ON entites_trouvees;
DROP POLICY IF EXISTS "entites_user_own"  ON entites_trouvees;
DROP POLICY IF EXISTS "entites_admin_all" ON entites_trouvees;

CREATE POLICY "entites_user_own" ON entites_trouvees
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "entites_admin_all" ON entites_trouvees
  FOR ALL USING (is_admin());

-- ── pivots ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pivots_own"       ON pivots;
DROP POLICY IF EXISTS "pivots_user_own"  ON pivots;
DROP POLICY IF EXISTS "pivots_admin_all" ON pivots;

CREATE POLICY "pivots_user_own" ON pivots
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pivots_admin_all" ON pivots
  FOR ALL USING (is_admin());

-- ── notes ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notes_own"       ON notes;
DROP POLICY IF EXISTS "notes_user_own"  ON notes;
DROP POLICY IF EXISTS "notes_admin_all" ON notes;

CREATE POLICY "notes_user_own" ON notes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes_admin_all" ON notes
  FOR ALL USING (is_admin());

-- ── artefacts ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "artefacts_own"       ON artefacts;
DROP POLICY IF EXISTS "artefacts_user_own"  ON artefacts;
DROP POLICY IF EXISTS "artefacts_admin_all" ON artefacts;

CREATE POLICY "artefacts_user_own" ON artefacts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "artefacts_admin_all" ON artefacts
  FOR ALL USING (is_admin());

-- ── cache_modules ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cache_own"        ON cache_modules;
DROP POLICY IF EXISTS "cache_user_own"   ON cache_modules;
DROP POLICY IF EXISTS "cache_admin_read" ON cache_modules;

-- Utilisateur : son propre cache (lecture + écriture)
CREATE POLICY "cache_user_own" ON cache_modules
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin : lecture seule sur tout le cache (monitoring)
CREATE POLICY "cache_admin_read" ON cache_modules
  FOR SELECT USING (is_admin());

-- ── activity_logs ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "logs_admin_read"   ON activity_logs;
DROP POLICY IF EXISTS "logs_user_insert"  ON activity_logs;

-- Admin : lecture de tous les logs
CREATE POLICY "logs_admin_read" ON activity_logs
  FOR SELECT USING (is_admin());

-- Tout utilisateur authentifié peut insérer ses propres logs
CREATE POLICY "logs_user_insert" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- FONCTIONS RPC
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Mise à jour résultat de recherche (contourne l'immutabilité du client) ────
CREATE OR REPLACE FUNCTION update_recherche_result(
  p_id           UUID,
  p_resultats    JSONB,
  p_nb_resultats INTEGER,
  p_duree_ms     INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- Vérifie que l'utilisateur possède la recherche (ou est admin)
  IF NOT EXISTS (
    SELECT 1 FROM recherches
    WHERE id = p_id
    AND (user_id = auth.uid() OR is_admin())
  ) THEN
    RAISE EXCEPTION 'Accès refusé ou recherche introuvable';
  END IF;

  UPDATE recherches
  SET
    statut        = 'done',
    resultats_raw = p_resultats,
    nb_resultats  = p_nb_resultats,
    duree_ms      = p_duree_ms
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Statistiques globales (admin) ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : rôle administrateur requis';
  END IF;

  SELECT json_build_object(
    'total_users',       (SELECT COUNT(*) FROM profiles),
    'total_dossiers',    (SELECT COUNT(*) FROM dossiers),
    'total_recherches',  (SELECT COUNT(*) FROM recherches),
    'total_entites',     (SELECT COUNT(*) FROM entites_trouvees),
    'total_notes',       (SELECT COUNT(*) FROM notes),
    'total_artefacts',   (SELECT COUNT(*) FROM artefacts),
    'users_by_role',     (
      SELECT json_object_agg(role, cnt)
      FROM (SELECT role, COUNT(*) as cnt FROM profiles GROUP BY role) t
    ),
    'recherches_today',  (
      SELECT COUNT(*) FROM recherches
      WHERE created_at >= CURRENT_DATE
    ),
    'active_users_7d',   (
      SELECT COUNT(DISTINCT user_id) FROM recherches
      WHERE created_at >= NOW() - INTERVAL '7 days'
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Liste des utilisateurs (admin) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
  id            UUID,
  email         TEXT,
  role          TEXT,
  created_at    TIMESTAMPTZ,
  nb_dossiers   BIGINT,
  nb_recherches BIGINT
) AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : rôle administrateur requis';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.role,
    p.created_at,
    COUNT(DISTINCT d.id)  AS nb_dossiers,
    COUNT(DISTINCT r.id)  AS nb_recherches
  FROM profiles p
  LEFT JOIN dossiers   d ON d.user_id = p.id
  LEFT JOIN recherches r ON r.user_id = p.id
  GROUP BY p.id, p.email, p.role, p.created_at
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Changer le rôle d'un utilisateur (admin) ──────────────────────────────────
CREATE OR REPLACE FUNCTION set_user_role(target_user_id UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : rôle administrateur requis';
  END IF;

  IF new_role NOT IN ('utilisateur', 'administrateur') THEN
    RAISE EXCEPTION 'Rôle invalide : %', new_role;
  END IF;

  UPDATE profiles SET role = new_role WHERE id = target_user_id;

  -- Log le changement de rôle
  INSERT INTO activity_logs (user_id, user_email, action, resource, resource_id, metadata)
  SELECT
    auth.uid(),
    (SELECT email FROM profiles WHERE id = auth.uid()),
    'set_user_role',
    'profiles',
    target_user_id,
    json_build_object('new_role', new_role)::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════
-- BACKFILL : profils pour les utilisateurs existants
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO profiles (id, email, role)
SELECT id, email, 'utilisateur'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION FINALE
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '✅ Migration OSINT HUB v8 appliquée avec succès';
  RAISE NOTICE '   Tables     : profiles, dossiers, recherches, entites_trouvees,';
  RAISE NOTICE '                pivots, notes, artefacts, cache_modules, activity_logs';
  RAISE NOTICE '   RLS        : activé sur toutes les tables';
  RAISE NOTICE '   Rôles      : utilisateur (défaut) | administrateur';
  RAISE NOTICE '   Fonctions  : is_admin, update_recherche_result,';
  RAISE NOTICE '                get_admin_stats, get_all_users, set_user_role';
  RAISE NOTICE '';
  RAISE NOTICE '👉 Pour créer le premier admin :';
  RAISE NOTICE '   UPDATE profiles SET role = ''administrateur'' WHERE email = ''votre@email.com'';';
END $$;
