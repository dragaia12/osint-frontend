CREATE TYPE public.app_role AS ENUM ('administrateur', 'utilisateur');
CREATE TYPE public.entity_type AS ENUM ('email','phone','ip','domain','username','url','hash','crypto','name','organization','social_profile','location','document','certificate');
CREATE TYPE public.trust_level AS ENUM ('VERIFIED','PROBABLE','CANDIDATE');
CREATE TYPE public.search_status AS ENUM ('pending','running','done','error');
CREATE TYPE public.search_strategy AS ENUM ('balanced','deep','quick','social','infrastructure');
CREATE TYPE public.dossier_statut AS ENUM ('actif','archivé','clos');
CREATE TYPE public.pivot_type AS ENUM ('leads_to','related_to','part_of','same_as','source_of');
CREATE TYPE public.artifact_type AS ENUM ('json','csv','markdown','screenshot','report');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'utilisateur',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role),
  UNIQUE (user_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'administrateur'));

CREATE TABLE public.dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titre text NOT NULL CHECK (char_length(titre) BETWEEN 1 AND 255),
  description text,
  tags text[] NOT NULL DEFAULT '{}',
  statut public.dossier_statut NOT NULL DEFAULT 'actif',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dossiers TO authenticated;
GRANT ALL ON public.dossiers TO service_role;
ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own dossiers" ON public.dossiers FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrateur')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrateur'));

CREATE TABLE public.recherches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  query text NOT NULL CHECK (char_length(query) BETWEEN 1 AND 1000),
  input_type public.entity_type NOT NULL,
  strategy public.search_strategy NOT NULL DEFAULT 'balanced',
  statut public.search_status NOT NULL DEFAULT 'pending',
  resultats_raw jsonb,
  nb_resultats integer NOT NULL DEFAULT 0,
  duree_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recherches TO authenticated;
GRANT ALL ON public.recherches TO service_role;
ALTER TABLE public.recherches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own searches" ON public.recherches FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrateur')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrateur'));

CREATE TABLE public.entites_trouvees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recherche_id uuid NOT NULL REFERENCES public.recherches(id) ON DELETE CASCADE,
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type_entite public.entity_type NOT NULL,
  valeur text NOT NULL CHECK (char_length(valeur) BETWEEN 1 AND 2000),
  trust_level public.trust_level NOT NULL DEFAULT 'CANDIDATE',
  platform text,
  url text,
  note text,
  sources text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dossier_id, type_entite, valeur)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entites_trouvees TO authenticated;
GRANT ALL ON public.entites_trouvees TO service_role;
ALTER TABLE public.entites_trouvees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own entities" ON public.entites_trouvees FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrateur')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrateur'));

CREATE TABLE public.pivots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  entite_source_id uuid NOT NULL REFERENCES public.entites_trouvees(id) ON DELETE CASCADE,
  entite_cible_id uuid NOT NULL REFERENCES public.entites_trouvees(id) ON DELETE CASCADE,
  type_pivot public.pivot_type NOT NULL,
  confiance integer NOT NULL DEFAULT 50 CHECK (confiance BETWEEN 0 AND 100),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entite_source_id, entite_cible_id, type_pivot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pivots TO authenticated;
GRANT ALL ON public.pivots TO service_role;
ALTER TABLE public.pivots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pivots" ON public.pivots FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrateur')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrateur'));

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  recherche_id uuid REFERENCES public.recherches(id) ON DELETE SET NULL,
  entite_id uuid REFERENCES public.entites_trouvees(id) ON DELETE SET NULL,
  contenu text NOT NULL CHECK (char_length(contenu) >= 1),
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes" ON public.notes FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrateur')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrateur'));

CREATE TABLE public.artefacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  recherche_id uuid REFERENCES public.recherches(id) ON DELETE SET NULL,
  nom text NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 255),
  type_artefact public.artifact_type NOT NULL,
  contenu text NOT NULL,
  taille_bytes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artefacts TO authenticated;
GRANT ALL ON public.artefacts TO service_role;
ALTER TABLE public.artefacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own artifacts" ON public.artefacts FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrateur')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrateur'));

CREATE TABLE public.cache_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cache_key text NOT NULL,
  query text NOT NULL,
  input_type public.entity_type NOT NULL,
  strategy public.search_strategy NOT NULL,
  resultats jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cache_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cache_modules TO authenticated;
GRANT ALL ON public.cache_modules TO service_role;
ALTER TABLE public.cache_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cache" ON public.cache_modules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read cache" ON public.cache_modules FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'administrateur'));

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  action text NOT NULL,
  resource text,
  resource_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users write own logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'administrateur'));

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER set_user_roles_updated_at BEFORE UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_dossiers_updated_at BEFORE UPDATE ON public.dossiers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_dossiers_user_created ON public.dossiers(user_id, created_at DESC);
CREATE INDEX idx_recherches_user_created ON public.recherches(user_id, created_at DESC);
CREATE INDEX idx_recherches_dossier ON public.recherches(dossier_id);
CREATE INDEX idx_entites_recherche ON public.entites_trouvees(recherche_id);
CREATE INDEX idx_entites_dossier ON public.entites_trouvees(dossier_id);
CREATE INDEX idx_entites_type_trust ON public.entites_trouvees(type_entite, trust_level);
CREATE INDEX idx_logs_created ON public.activity_logs(created_at DESC);
CREATE INDEX idx_cache_expiration ON public.cache_modules(expires_at);

CREATE OR REPLACE FUNCTION public.ensure_user_role(p_email text)
RETURNS public.app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_role public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  INSERT INTO public.user_roles(user_id, email, role) VALUES (auth.uid(), p_email, 'utilisateur') ON CONFLICT (user_id) DO NOTHING;
  SELECT role INTO current_role FROM public.user_roles WHERE user_id = auth.uid();
  RETURN current_role;
END; $$;
GRANT EXECUTE ON FUNCTION public.ensure_user_role(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id uuid, new_role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'administrateur') THEN RAISE EXCEPTION 'Accès administrateur requis'; END IF;
  UPDATE public.user_roles SET role = new_role WHERE user_id = target_user_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_recherche_result(p_id uuid, p_resultats jsonb, p_nb_resultats integer, p_duree_ms integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.recherches SET statut = 'done', resultats_raw = p_resultats, nb_resultats = p_nb_resultats, duree_ms = p_duree_ms
  WHERE id = p_id AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrateur'));
END; $$;
GRANT EXECUTE ON FUNCTION public.update_recherche_result(uuid, jsonb, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'administrateur') THEN RAISE EXCEPTION 'Accès administrateur requis'; END IF;
  RETURN jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.user_roles),
    'total_dossiers', (SELECT count(*) FROM public.dossiers),
    'total_recherches', (SELECT count(*) FROM public.recherches),
    'total_entites', (SELECT count(*) FROM public.entites_trouvees),
    'total_notes', (SELECT count(*) FROM public.notes),
    'total_artefacts', (SELECT count(*) FROM public.artefacts),
    'users_by_role', (SELECT coalesce(jsonb_object_agg(role, amount), '{}'::jsonb) FROM (SELECT role, count(*) amount FROM public.user_roles GROUP BY role) grouped),
    'recherches_today', (SELECT count(*) FROM public.recherches WHERE created_at >= current_date),
    'active_users_7d', (SELECT count(DISTINCT user_id) FROM public.recherches WHERE created_at >= now() - interval '7 days')
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE(id uuid, email text, role public.app_role, created_at timestamptz, nb_dossiers bigint, nb_recherches bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'administrateur') THEN RAISE EXCEPTION 'Accès administrateur requis'; END IF;
  RETURN QUERY SELECT u.user_id, u.email, u.role, u.created_at, count(DISTINCT d.id), count(DISTINCT r.id)
  FROM public.user_roles u LEFT JOIN public.dossiers d ON d.user_id = u.user_id LEFT JOIN public.recherches r ON r.user_id = u.user_id
  GROUP BY u.user_id, u.email, u.role, u.created_at ORDER BY u.created_at DESC;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;