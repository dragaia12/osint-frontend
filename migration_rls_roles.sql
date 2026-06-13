-- ═══════════════════════════════════════════════════════════════════════════
-- OSINT HUB — Migration : Gestion des rôles & RLS renforcé
-- À exécuter APRÈS migration.sql dans le SQL Editor Supabase
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Table profiles (rôles utilisateurs) ───────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'utilisateur'
                CHECK (role IN ('utilisateur', 'administrateur')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 2. Trigger : création automatique du profil à l'inscription ──────────
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

-- ─── 3. Fonction helper : is_admin() ─────────────────────────────────────
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

-- ─── 4. RLS sur profiles ──────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Un utilisateur voit uniquement son profil ; admin voit tout
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR is_admin()
  );

-- Un utilisateur modifie uniquement son propre profil (champs non-rôle)
-- Seul un admin peut changer le rôle
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- L'utilisateur normal ne peut pas s'auto-promouvoir
      role = (SELECT role FROM profiles WHERE id = auth.uid())
      OR is_admin()
    )
  );

-- Admin peut tout modifier (inclus changement de rôle)
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (is_admin());

-- Insert géré uniquement par le trigger (SECURITY DEFINER)
DROP POLICY IF EXISTS "profiles_insert_trigger" ON profiles;
CREATE POLICY "profiles_insert_trigger" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ─── 5. RLS renforcé sur toutes les tables ───────────────────────────────
-- Suppression des anciennes politiques simples et remplacement
-- par des politiques prenant en compte le rôle admin

-- === dossiers ===
DROP POLICY IF EXISTS "dossiers_own" ON dossiers;

-- Utilisateur : ses dossiers uniquement
CREATE POLICY "dossiers_user_own" ON dossiers
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin : accès total en lecture/écriture
CREATE POLICY "dossiers_admin_all" ON dossiers
  FOR ALL USING (is_admin());

-- === recherches ===
DROP POLICY IF EXISTS "recherches_own" ON recherches;

CREATE POLICY "recherches_user_own" ON recherches
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recherches_admin_all" ON recherches
  FOR ALL USING (is_admin());

-- === entites_trouvees ===
DROP POLICY IF EXISTS "entites_own" ON entites_trouvees;

CREATE POLICY "entites_user_own" ON entites_trouvees
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "entites_admin_all" ON entites_trouvees
  FOR ALL USING (is_admin());

-- === pivots ===
DROP POLICY IF EXISTS "pivots_own" ON pivots;

CREATE POLICY "pivots_user_own" ON pivots
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pivots_admin_all" ON pivots
  FOR ALL USING (is_admin());

-- === notes ===
DROP POLICY IF EXISTS "notes_own" ON notes;

CREATE POLICY "notes_user_own" ON notes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes_admin_all" ON notes
  FOR ALL USING (is_admin());

-- === artefacts ===
DROP POLICY IF EXISTS "artefacts_own" ON artefacts;

CREATE POLICY "artefacts_user_own" ON artefacts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "artefacts_admin_all" ON artefacts
  FOR ALL USING (is_admin());

-- === cache_modules ===
DROP POLICY IF EXISTS "cache_own" ON cache_modules;

CREATE POLICY "cache_user_own" ON cache_modules
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin voit tout le cache (lecture seulement, pas d'écriture inter-user)
CREATE POLICY "cache_admin_read" ON cache_modules
  FOR SELECT USING (is_admin());

-- ─── 6. Table activity_logs (journaux admin) ──────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email  TEXT NOT NULL,
  action      TEXT NOT NULL,   -- 'sign_in', 'sign_out', 'search', 'create_dossier', etc.
  resource    TEXT,             -- table ou ressource concernée
  resource_id UUID,
  metadata    JSONB DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON activity_logs(created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Seul l'admin peut lire les logs
CREATE POLICY "logs_admin_read" ON activity_logs
  FOR SELECT USING (is_admin());

-- N'importe quel utilisateur authentifié peut insérer ses propres logs
CREATE POLICY "logs_user_insert" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── 7. Fonction RPC : stats globales admin ───────────────────────────────
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

-- ─── 8. Fonction RPC : liste des utilisateurs (admin) ─────────────────────
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
  id          UUID,
  email       TEXT,
  role        TEXT,
  created_at  TIMESTAMPTZ,
  nb_dossiers BIGINT,
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
    COUNT(DISTINCT d.id) AS nb_dossiers,
    COUNT(DISTINCT r.id) AS nb_recherches
  FROM profiles p
  LEFT JOIN dossiers d ON d.user_id = p.id
  LEFT JOIN recherches r ON r.user_id = p.id
  GROUP BY p.id, p.email, p.role, p.created_at
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 9. Fonction RPC : changer le rôle d'un utilisateur ──────────────────
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 10. Backfill : créer les profils manquants pour les users existants ──
INSERT INTO profiles (id, email, role)
SELECT id, email, 'utilisateur'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

