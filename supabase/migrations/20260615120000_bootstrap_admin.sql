-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECTION : Bootstrap du premier administrateur
-- ═══════════════════════════════════════════════════════════════════════════
-- Problème de la v7.4 : set_user_role() exige déjà d'être admin pour promouvoir
-- quelqu'un, et ensure_user_role() force tout le monde à 'utilisateur'.
-- Résultat : PERSONNE ne peut jamais devenir admin la première fois.
--
-- Solution : une fonction qui promeut automatiquement le TOUT PREMIER utilisateur
-- inscrit en administrateur (si aucun admin n'existe encore). Ensuite, seuls les
-- admins existants peuvent promouvoir d'autres comptes (via set_user_role).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ensure_user_role(p_email text)
RETURNS public.app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_role public.app_role;
  admin_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  -- Insère le rôle 'utilisateur' si la ligne n'existe pas encore
  INSERT INTO public.user_roles(user_id, email, role)
  VALUES (auth.uid(), p_email, 'utilisateur')
  ON CONFLICT (user_id) DO NOTHING;

  -- CORRECTION : si AUCUN admin n'existe encore, on promeut ce premier utilisateur
  SELECT count(*) INTO admin_count FROM public.user_roles WHERE role = 'administrateur';
  IF admin_count = 0 THEN
    UPDATE public.user_roles SET role = 'administrateur' WHERE user_id = auth.uid();
  END IF;

  SELECT role INTO current_role FROM public.user_roles WHERE user_id = auth.uid();
  RETURN current_role;
END; $$;

GRANT EXECUTE ON FUNCTION public.ensure_user_role(text) TO authenticated, service_role;

-- Note : pour promouvoir manuellement un compte précis plus tard, exécutez
-- directement dans le SQL Editor de Supabase :
--   UPDATE public.user_roles SET role = 'administrateur' WHERE email = 'vous@exemple.com';
